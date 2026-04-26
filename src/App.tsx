import { useState, useEffect, useRef } from 'react'
import type { ProjectHandle } from '@/fs/projectHandle'
import { openProject, wrapHandle } from '@/fs/projectHandle'
import { buildStyleMarkdown, buildStoryboardMarkdown } from '@/pack/build_from_guide'
import cinemaTemplate from '@/templates/cinematography/style.md?raw'
import bmwTemplate from '@/templates/bmw/style.md?raw'
import { parseStyle, parseStoryboard, buildPack } from '@/pack/parse'
import { serialiseStoryboard } from '@/pack/serialise'
import { cascade } from '@/pack/cascade'
import { bootProviders, primeKeys } from '@/providers'
import { initVault } from '@/vault/keys'
import { listVendors } from '@/vault/vendor_keys'
import { store, useStore } from '@/state/store'
import { Gallery } from '@/components/Gallery'
import { Lightbox } from '@/components/Lightbox'
import { ChipComposer } from '@/components/ChipComposer'
import { RefBin } from '@/components/RefBin'
import { PackView } from '@/components/PackView'
import { CostGuardView } from '@/components/CostGuardView'
import { GlassPill } from '@/components/GlassPill'
import { Settings } from '@/components/Settings'
import { QueueDrawer } from '@/components/QueueDrawer'
import { StartScreen } from '@/components/StartScreen'
import { GuideContainer, type GuideState } from '@/components/guide/GuideContainer'
import { enqueueActiveShot, enqueueAllShots, generationQueue } from '@/actions/queue_instance'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { ShotCard } from '@/components/ShotCard'

interface FailToast { id: string; error: string; vendor: string; addedAt: number }

export default function App() {
  const pack = useStore(s => s.pack)
  const project = useStore(s => s.project)
  const [editInitial, setEditInitial] = useState<Partial<GuideState> | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [pass, setPass] = useState('')
  const [showPackView, setShowPackView] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failToasts, setFailToasts] = useState<FailToast[]>([])
  const seenFailIds = useRef(new Set<string>())
  const [composerMin, setComposerMin] = useState(() => sessionStorage.getItem('pf:chipMinimised') === '1')
  const [showGuide, setShowGuide] = useState(false)
  const [guideMode, setGuideMode] = useState<'create' | 'edit'>('create')
  const [hasKeys, setHasKeys] = useState(false)

  // Refresh the "has keys" flag whenever the Settings modal closes — the
  // user might have just saved one. Also runs on first unlock.
  const refreshHasKeys = async () => {
    const stored = await listVendors()
    setHasKeys(stored.length > 0)
  }

  // subscribe to queue — surface failed items as dismissable toasts
  useEffect(() => {
    return generationQueue.subscribe(() => {
      const items = generationQueue.snapshot()
      const fresh = items.filter(i => i.status === 'failed' && i.error && !seenFailIds.current.has(i.id))
      if (fresh.length === 0) return
      fresh.forEach(i => seenFailIds.current.add(i.id))
      setFailToasts(prev => [...prev, ...fresh.map(i => ({ id: i.id, error: i.error!, vendor: i.vendor, addedAt: Date.now() }))])
    })
  }, [])

  // auto-dismiss toasts after 8s
  useEffect(() => {
    if (failToasts.length === 0) return
    const oldest = Math.min(...failToasts.map(t => t.addedAt))
    const delay = Math.max(0, 8000 - (Date.now() - oldest))
    const timer = setTimeout(() => {
      const cutoff = Date.now() - 8000
      setFailToasts(prev => prev.filter(t => t.addedAt > cutoff))
    }, delay + 50)
    return () => clearTimeout(timer)
  }, [failToasts])

  const unlock = async () => {
    try {
      await initVault(pass, new Uint8Array(16))
      await bootProviders()
      const stored = await listVendors()
      await primeKeys(['seedream', 'openai-image', 'gemini-image', 'openrouter'])
      setUnlocked(true)
      setHasKeys(stored.length > 0)
      if (stored.length === 0) setShowSettings(true)  // first-run: nudge key entry
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // Load a project given an existing wrapped handle (used by both the
  // Open Project flow and the guide's Create flow once it's written
  // style.md + storyboard.md to the destination).
  const loadProject = async (p: Awaited<ReturnType<typeof openProject>>) => {
    // 1. Try legacy migration first
    const legacy = await p.readLegacyPack()
    if (legacy) {
      const { splitLegacyPack } = await import('@/pack/migration')
      const { style, storyboard } = splitLegacyPack(legacy)
      await p.writeMigratedStyle(style)
      await p.writeStoryboard(storyboard)
      await p.renameLegacyToBak()
    }

    // 2. Read style.md
    const styleRead = await p.readStyle()
    if (styleRead.source === 'none') {
      throw new Error(`no style.md in selected folder. Drop one in or author one via docs/CLAUDE.md.`)
    }

    // 3. Read storyboard.md — scaffold if missing
    let sbText = await p.readStoryboard()
    if (!sbText) {
      const scaffold = {
        frontmatter: {
          title: 'New Project',
          slug: 'new-project',
          active_provider: 'seedream' as const,
          variations_default: 1,
          budget_project: 20,
          budget_currency: 'GBP' as const,
        },
        blocks: [],
        shots: [],
      }
      sbText = serialiseStoryboard(scaffold)
      await p.writeStoryboard(sbText)
    }

    const styleData = parseStyle(styleRead.text)
    const sb = parseStoryboard(sbText)
    const pack = buildPack(styleData, sb)
    const merged = cascade(null, pack)

    store.setProject(p)
    store.setPack(merged)
  }

  const open = async () => {
    try {
      const p = await openProject()
      await loadProject(p)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Open failed: ${msg}`)
    }
  }

  // Pre-populate the guide from the live pack and open it in edit mode.
  // Stages 2-5 are editable; Stage 1 fields are locked at the component
  // level (see Stage1Setup mode handling).
  const openEditGuide = async () => {
    if (!pack || !project) return
    try {
      const refs = await project.listRefs()
      const styleNames = pack.blocks
        .filter(b => b.name.startsWith('STYLE_') || b.name === 'STYLE_GUIDE')
        .map(b => b.name)
      const negNames = pack.blocks
        .filter(b => b.name.startsWith('NEG_'))
        .map(b => b.name)
      setEditInitial({
        name: pack.frontmatter.title,
        slug: pack.frontmatter.slug,
        destinationDir: project.dir,
        templateId: null,
        summary: '',
        mood: '',
        refs,
        camera: pack.shots[0]?.camera ?? '',
        lens: pack.shots[0]?.lens ?? '',
        aspect: pack.shots[0]?.aspect ?? '16:9',
        selectedStyleBlocks: styleNames,
        selectedNegBlocks: negNames,
        shots: pack.shots,
        availableBlocks: pack.blocks,
      })
      setGuideMode('edit')
      setShowGuide(true)
    } catch (e) {
      setError(`Edit Guide failed to open: ${e instanceof Error ? e.message : String(e)}`)
    }
  }


  if (!unlocked) return (
    <div className="min-h-screen grid place-items-center p-6">
      <GlassPill shape="card" className="w-full max-w-md space-y-3">
        <h1 className="text-2xl tracking-tight">PUSHING FRAMES_</h1>
        <p className="text-smoke text-xs">
          Set a passphrase to encrypt your API keys locally. You'll enter keys on the next screen.
        </p>
        <label className="block"><span className="text-xs text-smoke">Vault passphrase</span>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full bg-transparent border border-hairline rounded-md p-2 mt-1" />
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button onClick={unlock} className="glass glass-pill px-4 py-2 text-sm">Unlock</button>
      </GlassPill>
    </div>
  )

  // Unlocked but no project loaded and not in guide flow: start screen.
  if (!pack && !showGuide) return (
    <>
      <StartScreen
        onOpenProject={open}
        onCreateNew={() => { setGuideMode('create'); setShowGuide(true) }}
        onOpenSettings={() => setShowSettings(true)}
        hasKeys={hasKeys}
        error={error}
      />
      <Settings open={showSettings} onClose={() => { setShowSettings(false); refreshHasKeys() }} />
    </>
  )

  // Guide overlay — Create New flow, or Edit Guide entry point.
  if (showGuide) return (
    <>
    <GuideContainer
      mode={guideMode}
      initialState={editInitial ?? undefined}
      onCancel={() => { setShowGuide(false); setEditInitial(null) }}
      onOpenSettings={() => setShowSettings(true)}
      onComplete={async (s) => {
        if (!s.destinationDir) {
          setError('Create failed: no destination folder selected.')
          return
        }
        try {
          // Source of available blocks: the project's existing blocks in
          // edit mode, the bundled template's raw text in create mode.
          const templateText = s.availableBlocks
            ? s.availableBlocks.map(b => `## ${b.name}\n${b.body}`).join('\n\n')
            : s.templateId === 'bmw' ? bmwTemplate : cinemaTemplate

          const styleMd = buildStyleMarkdown({
            name: s.name,
            slug: s.slug,
            summary: s.summary,
            mood: s.mood,
            templateText,
            selectedStyleBlocks: s.selectedStyleBlocks,
            selectedNegBlocks: s.selectedNegBlocks,
            shots: s.shots,
          })
          const storyboardMd = buildStoryboardMarkdown({
            name: s.name,
            slug: s.slug,
            shots: s.shots,
          })

          // Write both files into the chosen destination.
          const styleFile = await s.destinationDir.getFileHandle('style.md', { create: true })
          const sw = await styleFile.createWritable()
          await sw.write(styleMd); await sw.close()

          const storyboardFile = await s.destinationDir.getFileHandle('storyboard.md', { create: true })
          const tw = await storyboardFile.createWritable()
          await tw.write(storyboardMd); await tw.close()

          // Re-load through the existing project handle in edit mode (project
          // already loaded), or wrap a fresh handle in create mode.
          const handle: ProjectHandle = guideMode === 'edit' && project ? project : wrapHandle(s.destinationDir)
          await loadProject(handle)
          setShowGuide(false)
          setEditInitial(null)
          setError(null)
        } catch (e) {
          setError(`${guideMode === 'edit' ? 'Save' : 'Create'} failed: ${e instanceof Error ? e.message : String(e)}`)
        }
      }}
    />
    <Settings open={showSettings} onClose={() => { setShowSettings(false); refreshHasKeys() }} />
    </>
  )

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-void text-mist">
      {/* Hero — always-on gallery */}
      <Gallery />

      {/* Top bar — glass chip */}
      <header className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none z-30">
        <GlassPill shape="pill" className="pointer-events-auto flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest">PUSHING FRAMES_</span>
          {pack && <span className="text-xs font-mono text-smoke">{pack.frontmatter.title}</span>}
        </GlassPill>
        <div className="flex gap-2 pointer-events-auto items-center">
          <CostGuardView />
          <GlassPill shape="pill"><button onClick={open} className="text-xs">open project</button></GlassPill>
          <GlassPill shape="pill"><button onClick={openEditGuide} disabled={!pack} className="text-xs disabled:text-smoke">edit guide</button></GlassPill>
          <GlassPill shape="pill"><button onClick={() => setShowSettings(true)} className="text-xs">keys</button></GlassPill>
          <GlassPill shape="pill"><button onClick={() => setShowPackView(v => !v)} className="text-xs">{'{}'}</button></GlassPill>
          <GlassPill shape="pill">
            <button onClick={enqueueActiveShot} disabled={!pack} className="text-xs disabled:text-smoke">generate</button>
          </GlassPill>
          <GlassPill shape="pill">
            <button onClick={enqueueAllShots} disabled={!pack} className="text-xs disabled:text-smoke">generate all</button>
          </GlassPill>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="absolute top-16 inset-x-3 z-30 glass glass-card px-4 py-2 text-xs text-red-400 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-smoke">dismiss</button>
        </div>
      )}

      {/* Left dock — refs */}
      <aside className="absolute left-3 top-20 bottom-24 w-64 z-20">
        <GlassPill shape="card" className="h-full overflow-auto"><RefBin /></GlassPill>
      </aside>

      {/* Bottom pill — shot list + composer */}
      <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center pointer-events-none">
        <div className="w-[min(900px,calc(100%-24px))] pointer-events-auto">
          <QueueDrawer />
          <GlassPill shape="card">
            <div className="flex items-center justify-between p-2 pl-4">
              <span className="text-xs uppercase tracking-widest text-smoke">Composer</span>
              <button
                onClick={() => {
                  const next = !composerMin
                  setComposerMin(next)
                  sessionStorage.setItem('pf:chipMinimised', next ? '1' : '0')
                }}
                aria-label={composerMin ? 'Expand composer' : 'Minimise composer'}
                className="glass glass-pill px-3 py-1 text-xs"
              >{composerMin ? 'expand ▲' : 'minimise ▼'}</button>
            </div>
            <ShotList />
            {!composerMin && <ChipComposer />}
          </GlassPill>
        </div>
      </div>

      {/* Right slide-out — pack view */}
      <PackView open={showPackView} onClose={() => setShowPackView(false)} />

      {/* Lightbox overlay */}
      <Lightbox />

      {/* Settings modal — keys */}
      <Settings open={showSettings} onClose={() => { setShowSettings(false); refreshHasKeys() }} />

      {/* Failure toast list — bottom-right, auto-dismiss 8s */}
      {failToasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-auto">
          {failToasts.map(t => (
            <div key={t.id} className="glass glass-card px-4 py-2 text-xs text-red-400 flex gap-3 items-start max-w-sm">
              <div className="flex-1 space-y-0.5">
                <span className="font-mono text-smoke">{t.vendor}</span>
                <p>{t.error}</p>
              </div>
              <button onClick={() => setFailToasts(prev => prev.filter(x => x.id !== t.id))} className="text-smoke shrink-0 mt-0.5">dismiss</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ShotList() {
  const pack = useStore(s => s.pack)
  const active = useStore(s => s.activeShotSlug)
  const [queueItems, setQueueItems] = useState(generationQueue.snapshot())
  useEffect(() => generationQueue.subscribe(() => setQueueItems(generationQueue.snapshot())), [])
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  if (!pack) return null
  const statusOf = (slug: string) => {
    const latest = [...queueItems].reverse().find(i => i.shotSlug === slug)
    return latest?.status
  }
  const shotIds = pack.shots.map(s => s.slug)
  const handleDragEnd = ({ active: dragActive, over }: DragEndEvent) => {
    if (!over || dragActive.id === over.id) return
    const from = pack.shots.findIndex(s => s.slug === dragActive.id)
    const to = pack.shots.findIndex(s => s.slug === over.id)
    store.reorderShots(from, to)
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={shotIds} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-1 flex-wrap mb-2">
          {pack.shots.map(s => (
            <ShotCard
              key={s.slug}
              id={s.slug}
              active={active === s.slug}
              status={statusOf(s.slug)}
              onClick={() => store.setActiveShot(s.slug)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

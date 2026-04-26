import { useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Shot } from '@/pack/schema'
import { ShotCard } from '@/components/ShotCard'
import { wrapHandle } from '@/fs/projectHandle'
import { scaffoldPrompt } from '@/assist/scaffold'
import { generateShotList } from '@/assist/bulk_shotlist'
import { readVendorKey } from '@/vault/vendor_keys'
import { normaliseForProvider } from '@/refs/normalise'
import type { NormalisedRef } from '@/providers/types'
import type { GuideState } from './GuideContainer'

interface Props {
  state: GuideState
  update: (patch: Partial<GuideState>) => void
}

const ASPECT_OPTIONS = ['1:1', '4:3', '16:9', '9:16', '21:9']

function nextSlug(existing: Shot[]): string {
  const used = new Set(existing.map(s => s.slug))
  for (let i = 1; i < 1000; i++) {
    const candidate = `shot_${String(i).padStart(2, '0')}`
    if (!used.has(candidate)) return candidate
  }
  return `shot_${Date.now()}`
}

export function Stage4Shots({ state, update }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [generatingIdx, setGeneratingIdx] = useState<number | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [bulkCount, setBulkCount] = useState(5)
  const [bulkLoading, setBulkLoading] = useState(false)

  // Build thumbnail URLs for any refs imported in Stage 2 so the editor can
  // show actual images instead of filenames.
  const [refThumbs, setRefThumbs] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!state.destinationDir || state.refs.length === 0) { setRefThumbs({}); return }
    const project = wrapHandle(state.destinationDir)
    let cancelled = false
    const created: string[] = []
    ;(async () => {
      const map: Record<string, string> = {}
      for (const name of state.refs) {
        try {
          const blob = await project.readRef(name)
          const url = URL.createObjectURL(blob)
          map[name] = url; created.push(url)
        } catch { /* skip */ }
      }
      if (!cancelled) setRefThumbs(map)
    })()
    return () => {
      cancelled = true
      setTimeout(() => created.forEach(u => URL.revokeObjectURL(u)), 1000)
    }
  }, [state.destinationDir, state.refs.join('|')])

  const addShot = () => {
    const slug = nextSlug(state.shots)
    const fresh: Shot = {
      slug,
      action: '',
      refs: [],
      styleBlocks: state.selectedStyleBlocks,
      negBlocks: state.selectedNegBlocks,
      camera: state.camera || undefined,
      lens: state.lens || undefined,
      aspect: state.aspect || undefined,
    }
    update({ shots: [...state.shots, fresh], activeShotIdx: state.shots.length })
  }

  const deleteShot = (idx: number) => {
    if (!confirm(`Delete ${state.shots[idx]?.slug}?`)) return
    const shots = state.shots.filter((_, i) => i !== idx)
    const activeShotIdx = state.activeShotIdx === idx ? null
      : state.activeShotIdx !== null && state.activeShotIdx > idx
        ? state.activeShotIdx - 1
        : state.activeShotIdx
    update({ shots, activeShotIdx })
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = state.shots.findIndex(s => s.slug === active.id)
    const to = state.shots.findIndex(s => s.slug === over.id)
    if (from < 0 || to < 0) return
    const shots = [...state.shots]
    const [moved] = shots.splice(from, 1)
    shots.splice(to, 0, moved)
    // Keep activeShotIdx pointing at the same shot it was on, post-move.
    let activeShotIdx = state.activeShotIdx
    if (activeShotIdx !== null) {
      const movedSlug = state.shots[state.activeShotIdx ?? -1]?.slug
      activeShotIdx = movedSlug ? shots.findIndex(s => s.slug === movedSlug) : null
    }
    update({ shots, activeShotIdx })
  }

  const updateShot = (idx: number, patch: Partial<Shot>) => {
    const shots = state.shots.map((s, i) => i === idx ? { ...s, ...patch } : s)
    update({ shots })
  }

  const bulkGenerate = async () => {
    if (!state.summary.trim()) {
      setGenError('Write a project summary in Stage 2 first—the bulk-generate uses it as the brief.')
      return
    }
    setGenError(null)
    setBulkLoading(true)
    try {
      const blob = await readVendorKey('google')
      if (!blob || !('key' in blob)) {
        throw new Error('Add a Google API key in Settings first.')
      }
      const refImages = await refsToNormalised(state.refs, state.destinationDir)
      const drafted = await generateShotList({
        summary: state.summary,
        mood: state.mood || undefined,
        camera: state.camera || undefined,
        lens: state.lens || undefined,
        aspect: state.aspect || undefined,
        selectedStyleBlocks: state.selectedStyleBlocks,
        selectedNegBlocks: state.selectedNegBlocks,
        availableRefs: state.refs,
        refImages,
        count: bulkCount,
        apiKey: blob.key,
      })
      // Append, deduping slugs against existing shots.
      const used = new Set(state.shots.map(s => s.slug))
      const merged = [...state.shots]
      for (const d of drafted) {
        let slug = d.slug
        let n = 2
        while (used.has(slug)) slug = `${d.slug}_${n++}`
        used.add(slug)
        merged.push({ ...d, slug })
      }
      update({ shots: merged })
      if (drafted.length < bulkCount) {
        setGenError(`${drafted.length} of ${bulkCount} shots returned by Gemini were valid; the rest were dropped.`)
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err))
    } finally {
      setBulkLoading(false)
    }
  }

  const autoGenerate = async (idx: number) => {
    const shot = state.shots[idx]
    if (!shot) return
    if (!shot.action.trim()) {
      setGenError('Write a one-line shot description first—Gemini drafts the full prompt from your seed plus the project context.')
      return
    }
    setGenError(null)
    setGeneratingIdx(idx)
    try {
      const blob = await readVendorKey('google')
      if (!blob || !('key' in blob)) {
        throw new Error('Add a Google API key in Settings first.')
      }
      const refs = await refsToNormalised(shot.refs, state.destinationDir)

      // Bake project context into the user-facing idea so Gemini draws on the
      // brief without us touching the system prompt. This is the "treat AI
      // like a DP" thesis in practice.
      const contextLines = [
        state.summary && `Project summary: ${state.summary}`,
        state.mood && `Mood / world: ${state.mood}`,
        (state.camera || shot.camera) && `Camera: ${shot.camera || state.camera}`,
        (state.lens || shot.lens) && `Lens: ${shot.lens || state.lens}`,
        (state.aspect || shot.aspect) && `Aspect: ${shot.aspect || state.aspect}`,
        shot.styleBlocks.length > 0 && `Style blocks active: ${shot.styleBlocks.join(', ')}`,
      ].filter(Boolean) as string[]
      const idea = (contextLines.length > 0 ? contextLines.join('\n') + '\n\n' : '')
        + `Shot description: ${shot.action}`

      const drafted = await scaffoldPrompt(idea, refs, blob.key)
      updateShot(idx, { action: drafted })
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err))
    } finally {
      setGeneratingIdx(null)
    }
  }

  const active = state.activeShotIdx !== null ? state.shots[state.activeShotIdx] : null

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg">Shots</h2>
          <p className="text-xs text-smoke">
            Drag to reorder. Click a shot to edit. Defaults from Stage 3 prefill new shots.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={12}
            value={bulkCount}
            onChange={e => setBulkCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
            disabled={bulkLoading}
            className="w-12 bg-transparent border border-hairline rounded-md p-1 text-xs text-center"
            aria-label="How many shots to generate"
          />
          <button
            onClick={bulkGenerate}
            disabled={bulkLoading}
            className="glass glass-pill px-3 py-1 text-xs disabled:text-smoke"
            title="Append shots drafted by Gemini from your summary, mood, refs, and style choices"
          >{bulkLoading ? `drafting ${bulkCount}…` : `generate ${bulkCount} shots`}</button>
          <button
            onClick={addShot}
            className="glass glass-pill px-3 py-1 text-xs"
          >+ shot</button>
        </div>
      </header>

      {state.shots.length === 0 ? (
        <div className="border border-dashed border-hairline rounded-md p-8 text-center space-y-2">
          <p className="text-sm text-smoke">No shots yet.</p>
          <button onClick={addShot} className="text-xs text-mist underline">add the first one</button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={state.shots.map(s => s.slug)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {state.shots.map((s, i) => (
                <ShotCard
                  key={s.slug}
                  id={s.slug}
                  active={state.activeShotIdx === i}
                  onClick={() => update({ activeShotIdx: i })}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteShot(i) }}
                    aria-label={`Delete ${s.slug}`}
                    className="text-[10px] text-red-400 px-2"
                  >×</button>
                </ShotCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {genError && (
        <div className="border border-red-400/50 rounded-md p-3 text-xs text-red-400 flex justify-between items-start gap-3">
          <span className="flex-1">{genError}</span>
          <button onClick={() => setGenError(null)} className="text-smoke shrink-0">dismiss</button>
        </div>
      )}

      {active && state.activeShotIdx !== null && (
        <ShotEditor
          shot={active}
          allRefs={state.refs}
          refThumbs={refThumbs}
          allStyleBlocks={state.selectedStyleBlocks}
          allNegBlocks={state.selectedNegBlocks}
          onChange={(patch) => updateShot(state.activeShotIdx!, patch)}
          onAutoGenerate={() => autoGenerate(state.activeShotIdx!)}
          generating={generatingIdx === state.activeShotIdx}
        />
      )}
    </div>
  )
}

function ShotEditor({ shot, allRefs, refThumbs, allStyleBlocks, allNegBlocks, onChange, onAutoGenerate, generating }: {
  shot: Shot
  allRefs: string[]
  refThumbs: Record<string, string>
  allStyleBlocks: string[]
  allNegBlocks: string[]
  onChange: (patch: Partial<Shot>) => void
  onAutoGenerate: () => void
  generating: boolean
}) {
  const toggleArr = (arr: string[], name: string) =>
    arr.includes(name) ? arr.filter(x => x !== name) : [...arr, name]

  return (
    <div className="border border-hairline rounded-md p-4 space-y-4">
      <header className="flex items-center justify-between">
        <input
          value={shot.slug}
          onChange={e => onChange({ slug: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() })}
          className="bg-transparent border-b border-hairline text-sm font-mono px-1 focus:outline-none focus:border-mist"
        />
        <span className="text-[10px] text-smoke">edit shot</span>
      </header>

      <div className="space-y-2">
        <header className="flex items-baseline justify-between">
          <span className="text-xs text-smoke uppercase tracking-widest">Action</span>
          <span className="text-[10px] text-smoke">your shot prompt</span>
        </header>
        <textarea
          value={shot.action}
          onChange={e => onChange({ action: e.target.value })}
          rows={6}
          placeholder={
            'Two ways to use this field.\n\n' +
            'Write the full prompt yourself. Lead with "Shot on [camera] mounted on [rig]". ' +
            'State T-stop, shutter, ISO. Then describe the action.\n\n' +
            'Or write a one-line seed (e.g. "hands gripping the alcantara wheel before launch") ' +
            'and click auto below. Gemini drafts the full cinematic prompt from your seed plus the ' +
            'project summary, mood, camera/lens/aspect defaults, and any refs you bound to this shot.'
          }
          className="w-full bg-transparent border border-hairline rounded-md p-2 text-sm placeholder:text-smoke/60"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-smoke">{shot.action.trim().length} characters</span>
          <button
            onClick={onAutoGenerate}
            disabled={generating}
            className="glass glass-pill px-3 py-1 text-xs disabled:text-smoke disabled:cursor-not-allowed"
            title="Send your seed plus project context to Gemini and replace this text with the drafted prompt"
          >{generating ? 'drafting…' : 'auto with Gemini'}</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-smoke uppercase tracking-widest space-y-1">
          <span>Camera</span>
          <input
            value={shot.camera ?? ''}
            onChange={e => onChange({ camera: e.target.value || undefined })}
            placeholder="default"
            className="w-full bg-transparent border border-hairline rounded-md p-1 text-sm"
          />
        </label>
        <label className="text-xs text-smoke uppercase tracking-widest space-y-1">
          <span>Lens</span>
          <input
            value={shot.lens ?? ''}
            onChange={e => onChange({ lens: e.target.value || undefined })}
            placeholder="default"
            className="w-full bg-transparent border border-hairline rounded-md p-1 text-sm"
          />
        </label>
        <label className="text-xs text-smoke uppercase tracking-widest space-y-1">
          <span>Aspect</span>
          <select
            value={shot.aspect ?? ''}
            onChange={e => onChange({ aspect: e.target.value || undefined })}
            className="w-full bg-transparent border border-hairline rounded-md p-1 text-sm"
          >
            <option value="" className="bg-void">— default —</option>
            {ASPECT_OPTIONS.map(a => <option key={a} value={a} className="bg-void">{a}</option>)}
          </select>
        </label>
      </div>

      <RefThumbGrid
        label="Refs bound to this shot"
        all={allRefs}
        selected={shot.refs}
        thumbs={refThumbs}
        onToggle={(name) => onChange({ refs: toggleArr(shot.refs, name) })}
      />
      <ChipList
        label="Style blocks"
        all={allStyleBlocks}
        selected={shot.styleBlocks}
        onToggle={(name) => onChange({ styleBlocks: toggleArr(shot.styleBlocks, name) })}
        empty="No style blocks selected in Stage 3."
      />
      <ChipList
        label="Negative blocks"
        all={allNegBlocks}
        selected={shot.negBlocks}
        onToggle={(name) => onChange({ negBlocks: toggleArr(shot.negBlocks, name) })}
        empty="No negative blocks selected in Stage 3."
      />
    </div>
  )
}

async function refsToNormalised(
  refNames: string[],
  dir: FileSystemDirectoryHandle | null,
): Promise<NormalisedRef[]> {
  if (!dir || refNames.length === 0) return []
  const project = wrapHandle(dir)
  const out: NormalisedRef[] = []
  for (const name of refNames) {
    try {
      const blob = await project.readRef(name)
      // Conform to gemini-image limits before sending. Decodes HEIC if
      // needed, fits to provider max edge, recompresses to fit byte cap,
      // converts to a supported mime. Same pipeline the main-app gen flow
      // already uses—no surprise oversized payloads to Gemini.
      const conformed = await normaliseForProvider(blob, name, 'gemini-image')
      out.push(conformed)
    } catch { /* ref missing on disk or decode failed, skip */ }
  }
  return out
}

function RefThumbGrid({ label, all, selected, thumbs, onToggle }: {
  label: string
  all: string[]
  selected: string[]
  thumbs: Record<string, string>
  onToggle: (name: string) => void
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs text-smoke uppercase tracking-widest">{label}</h4>
      {all.length === 0 ? (
        <p className="text-[10px] text-smoke italic">No refs imported in Stage 2 yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {all.map(name => {
            const on = selected.includes(name)
            return (
              <button
                key={name}
                onClick={() => onToggle(name)}
                title={name}
                className={`relative w-12 h-12 rounded-md overflow-hidden border ${on ? 'border-mist border-2 shadow-[0_0_0_2px_rgba(232,232,232,0.15)]' : 'border-hairline'}`}
              >
                {thumbs[name]
                  ? <img src={thumbs[name]} alt={name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-dust" />}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ChipList({ label, all, selected, onToggle, empty }: {
  label: string
  all: string[]
  selected: string[]
  onToggle: (name: string) => void
  empty: string
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs text-smoke uppercase tracking-widest">{label}</h4>
      {all.length === 0 ? (
        <p className="text-[10px] text-smoke italic">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {all.map(name => {
            const on = selected.includes(name)
            return (
              <button
                key={name}
                onClick={() => onToggle(name)}
                className={`text-[10px] px-2 py-1 border rounded-md font-mono ${on ? 'bg-mist text-void border-mist' : 'border-hairline text-smoke'}`}
              >{name}</button>
            )
          })}
        </div>
      )}
    </section>
  )
}

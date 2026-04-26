import { useEffect, useRef, useState } from 'react'
import { useStore, store } from '@/state/store'
import { getAdapter } from '@/providers'
import type { AdapterId } from '@/providers/vendors'
import type { Shot } from '@/pack/types'
import type { ProjectHandle } from '@/fs/projectHandle'

export function VideoControls() {
  const pack = useStore(s => s.pack)
  const slug = useStore(s => s.activeShotSlug)
  const project = useStore(s => s.project)
  if (!pack || !slug) return null
  const shot = pack.shots.find(s => s.slug === slug)
  if (!shot) return null
  const providerId = pack.frontmatter.active_provider as AdapterId
  const adapter = safeGetAdapter(providerId)
  const caps = adapter?.capabilities
  if (!caps?.supportsVideo) return null  // hide for image-only vendors

  const mode = shot.video_mode ?? 'i2v'
  const durations = caps.allowedDurations ?? [5]
  const update = (patch: Partial<Shot>) => store.updateShot(slug, patch)

  return (
    <div className="pt-2 border-t border-hairline mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-chalk text-xs uppercase">mode</span>
        <button
          onClick={() => update({ video_mode: 'i2v' })}
          className={`text-xs px-2 py-1 rounded-md border ${mode === 'i2v' ? 'bg-mist text-void border-mist' : 'border-hairline'}`}
        >i2v</button>
        <button
          onClick={() => update({ video_mode: 't2v' })}
          className={`text-xs px-2 py-1 rounded-md border ${mode === 't2v' ? 'bg-mist text-void border-mist' : 'border-hairline'}`}
        >t2v</button>
        <span className="text-chalk text-xs uppercase ml-4">duration</span>
        <select
          value={shot.duration_sec ?? durations[0]}
          onChange={e => update({ duration_sec: Number(e.target.value) })}
          className="bg-transparent border border-hairline rounded-md p-1 text-xs"
        >
          {durations.map(d => <option key={d} value={d} className="bg-void">{d}s</option>)}
        </select>
        {caps.supportsMotionSlider && (
          <>
            <span className="text-chalk text-xs uppercase ml-4">motion</span>
            <input
              type="range" min={0} max={1} step={0.1}
              value={shot.motion ?? 0.5}
              onChange={e => update({ motion: Number(e.target.value) })}
              className="w-24 accent-mist"
            />
          </>
        )}
        {/*
          Veo audio is currently a no-op — every Veo model we've tested
          rejects the generateAudio field. Hidden until we figure out the
          right parameter name / endpoint. The shot.audio state is still
          preserved on the shot for forwards compatibility.
        */}
      </div>
      {mode === 'i2v' && (
        <div className="grid grid-cols-2 gap-2">
          <KeyframeSlot
            label="start frame"
            value={shot.start_frame}
            project={project}
            onPick={name => update({ start_frame: name })}
            onClear={() => update({ start_frame: undefined })}
          />
          {caps.supportsEndFrame && (
            <KeyframeSlot
              label="end frame (optional)"
              value={shot.end_frame}
              project={project}
              onPick={name => update({ end_frame: name })}
              onClear={() => update({ end_frame: undefined })}
            />
          )}
        </div>
      )}
    </div>
  )
}

function KeyframeSlot({ label, value, project, onPick, onClear }: {
  label: string
  value?: string
  project: ProjectHandle | null
  onPick: (n: string) => void
  onClear: () => void
}) {
  const [thumb, setThumb] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!project || !value) { setThumb(null); return }
    let url: string | null = null
    let cancelled = false
    ;(async () => {
      try {
        const blob = await project.readRef(value)
        url = URL.createObjectURL(blob)
        if (!cancelled) setThumb(url)
      } catch { /* ref may have been deleted from disk */ }
    })()
    return () => {
      cancelled = true
      if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000)
    }
  }, [project, value])

  const handleFile = async (file: File) => {
    setError(null)
    if (!project) { setError('Open a project first.'); return }
    try {
      await project.importRef(file)
      store.setRefs(await project.listRefs())
      onPick(file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    setError(null)
    // Prefer drag-from-refs (carries the existing ref name)
    const refName = e.dataTransfer.getData('application/x-pushing-frames-ref')
    if (refName) { onPick(refName); return }
    // Otherwise treat as OS file drop
    const file = e.dataTransfer.files[0]
    if (file) await handleFile(file)
  }

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await handleFile(file)
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <div className="text-xs text-smoke flex flex-col gap-1">
      <span className="uppercase">{label}</span>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative aspect-video border rounded-md overflow-hidden ${dragOver ? 'border-mist bg-mist/5' : 'border-hairline'}`}
      >
        {thumb ? (
          <img src={thumb} alt={value} className="w-full h-full object-cover" />
        ) : (
          <button
            onClick={() => fileInput.current?.click()}
            className="w-full h-full flex items-center justify-center text-[10px] text-smoke leading-tight px-2 text-center"
          >drop ref or OS file<br />or click to choose</button>
        )}
        {value && (
          <div className="absolute top-1 right-1 flex gap-1">
            <button
              onClick={() => fileInput.current?.click()}
              className="bg-black/60 text-mist text-[10px] px-1.5 py-0.5 rounded"
            >change</button>
            <button
              onClick={onClear}
              aria-label="Clear frame"
              className="bg-black/60 text-mist text-[10px] w-5 h-5 rounded leading-none"
            >×</button>
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={onPickFile}
          className="hidden"
        />
      </div>
      {value && <span className="font-mono truncate text-[10px]" title={value}>{value}</span>}
      {error && <span className="text-red-400 text-[10px]">{error}</span>}
    </div>
  )
}

function safeGetAdapter(id: AdapterId) {
  try { return getAdapter(id) } catch { return null }
}

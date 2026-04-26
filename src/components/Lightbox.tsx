import { useEffect, useState } from 'react'
import { useStore, store } from '@/state/store'
import { GlassPill } from './GlassPill'

export function Lightbox() {
  const project = useStore(s => s.project)
  const name = useStore(s => s.lightboxFile)
  const [url, setUrl] = useState<string | null>(null)
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (!project || !name) { setUrl(null); setMeta(null); return }
    let alive = true
    let prevUrl: string | null = null
    ;(async () => {
      const blob = await project.readGeneration(name)
      const m = await project.readGenerationMeta(name)
      if (!alive) return
      prevUrl = URL.createObjectURL(blob)
      setUrl(prevUrl); setMeta(m)
    })()
    return () => {
      alive = false
      if (prevUrl) URL.revokeObjectURL(prevUrl)
    }
  }, [name, project])

  if (!name) return null
  return (
    <div
      onClick={() => store.closeLightbox()}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-6 overflow-y-auto"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="max-w-6xl w-full max-h-[calc(100vh-3rem)] grid grid-cols-1 md:grid-cols-[1fr_340px] gap-4 items-start"
      >
        {/* Image column — top-aligned, never centred so it can't drift offscreen
            when the metadata column is taller than the viewport. Image itself
            is capped at 80vh and contained so the full frame is always visible. */}
        <div className="flex flex-col items-start gap-2 min-w-0">
          {url && (name.endsWith('.mp4')
            ? <video src={url} controls autoPlay loop className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-md" />
            : <img src={url} alt={name} className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-md" />)}
          {url && (
            <div className="flex gap-2 self-start mt-1">
              <a
                href={url}
                download={name}
                onClick={e => e.stopPropagation()}
                className="glass glass-pill px-3 py-1 text-xs"
              >download</a>
              <button
                onClick={async e => {
                  e.stopPropagation()
                  if (!project || !name) return
                  if (!confirm(`Delete ${name}? This removes the file from your project folder.`)) return
                  await project.deleteGeneration(name)
                  store.setGenerations((await project.listGenerations()))
                  store.closeLightbox()
                }}
                className="glass glass-pill px-3 py-1 text-xs text-red-400"
              >delete</button>
            </div>
          )}
        </div>
        {/* Metadata column — independently scrollable, never pushes the image
            out of frame. Capped at viewport height with overflow-y-auto. */}
        <GlassPill
          shape="card"
          className="text-sm space-y-2 overflow-y-auto max-h-[calc(100vh-3rem)]"
        >
          <div className="font-mono text-xs text-smoke truncate">{name}</div>
          {meta ? (
            <>
              <Field label="provider">{String(meta.provider ?? '')}</Field>
              <Field label="cost">£{Number(meta.costGBP ?? 0).toFixed(2)}</Field>
              <Field label="refs">{Array.isArray(meta.refs) ? (meta.refs as string[]).join(', ') : ''}</Field>
              {name.endsWith('.mp4') && (
                <>
                  <Field label="duration">{String((meta.providerMeta as Record<string, unknown>)?.durationSec ?? 'n/a')}s</Field>
                  <Field label="keyframes">
                    {(meta.start_frame as string | undefined)
                      ? ((meta.end_frame as string | undefined) ? 'start+end' : 'start only')
                      : 'none'}
                  </Field>
                </>
              )}
              <div className="text-xs text-smoke uppercase tracking-widest">prompt</div>
              <pre className="text-xs whitespace-pre-wrap break-words">{String(meta.prompt ?? '')}</pre>
            </>
          ) : <div className="text-smoke text-xs">No metadata sidecar.</div>}
        </GlassPill>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><span className="text-xs uppercase tracking-widest text-smoke mr-2">{label}</span>{children}</div>
}

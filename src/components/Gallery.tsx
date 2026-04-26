import { useEffect, useState, useRef } from 'react'
import { useStore, store } from '@/state/store'
import type { ProjectHandle } from '@/fs/projectHandle'

const ZOOM_MIN = 140
const ZOOM_MAX = 480
const ZOOM_DEFAULT = 260
const ZOOM_STORAGE = 'pf-gallery-zoom'

export function Gallery() {
  const project = useStore(s => s.project)
  const names = useStore(s => s.generations)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [zoom, setZoom] = useState<number>(() => {
    const saved = Number(localStorage.getItem(ZOOM_STORAGE))
    return saved >= ZOOM_MIN && saved <= ZOOM_MAX ? saved : ZOOM_DEFAULT
  })

  useEffect(() => { localStorage.setItem(ZOOM_STORAGE, String(zoom)) }, [zoom])

  useEffect(() => {
    if (!project) return
    project.listGenerations().then(n => store.setGenerations(n))
  }, [project])

  // Persist URLs across re-renders so we don't revoke blobs that the
  // user is still hovering. The previous version revoked everything
  // 1s after each names change — when a new generation finished, all
  // existing tiles' blob URLs were nuked, surfacing as ERR_FILE_NOT_FOUND
  // on the video tiles whose poster blob just got revoked mid-hover.
  const urlsRef = useRef<Record<string, string>>({})
  useEffect(() => {
    if (!project) return
    let cancelled = false
    ;(async () => {
      const next: Record<string, string> = { ...urlsRef.current }
      // Build URLs for any new names we don't already have
      for (const name of names) {
        if (next[name]) continue
        try {
          const blob = await project.readGeneration(name)
          if (name.endsWith('.mp4')) {
            const poster = await extractPoster(blob)
            if (poster) next[name] = poster
          } else {
            next[name] = URL.createObjectURL(blob)
          }
        } catch { /* skip */ }
      }
      // Revoke URLs whose name has been deleted from the list
      const live = new Set(names)
      for (const [name, url] of Object.entries(urlsRef.current)) {
        if (!live.has(name)) {
          URL.revokeObjectURL(url)
          delete next[name]
        }
      }
      urlsRef.current = next
      if (!cancelled) setUrls(next)
    })()
    return () => { cancelled = true }
  }, [names, project])

  // Revoke everything once on unmount.
  useEffect(() => () => {
    Object.values(urlsRef.current).forEach(u => URL.revokeObjectURL(u))
    urlsRef.current = {}
  }, [])

  return (
    <div className="absolute top-20 bottom-24 left-[17.5rem] right-3 z-10 flex flex-col gap-2">
      {/* Gallery toolbar */}
      <div className="flex items-center justify-between text-xs text-smoke px-1">
        <span>{project ? `${names.length} ${names.length === 1 ? 'generation' : 'generations'}` : 'no project open'}</span>
        <label className="flex items-center gap-2">
          <span className="uppercase tracking-widest">zoom</span>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={20}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="w-40 accent-mist"
          />
        </label>
      </div>

      {/* Surface */}
      <div className="flex-1 overflow-auto">
        {!project && (
          <div className="h-full grid place-items-center text-smoke text-sm">
            Open a project to see your gallery.
          </div>
        )}
        {project && names.length === 0 && (
          <div className="h-full grid place-items-center text-smoke text-sm">
            No generations yet. Compose a shot and hit generate.
          </div>
        )}
        {project && names.length > 0 && (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${zoom}px, 1fr))` }}
          >
            {names.map(name => (
              <div
                key={name}
                draggable
                onDragStart={e => e.dataTransfer.setData('application/x-pushing-frames-gen', name)}
                className="relative group overflow-hidden rounded-[22px] border border-hairline bg-black/30"
              >
                <button
                  onClick={() => store.openLightbox(name)}
                  className="block w-full"
                  aria-label={`Open ${name}`}
                >
                  {name.endsWith('.mp4')
                    ? <VideoTile posterUrl={urls[name]} project={project} name={name} />
                    : urls[name] && <img src={urls[name]} alt={name} className="w-full aspect-square object-cover" />}
                </button>
                <div className="absolute inset-x-0 bottom-0 p-2 text-left opacity-0 group-hover:opacity-100 transition bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none">
                  <div className="text-xs font-mono truncate">{name}</div>
                </div>
                {/* Hover actions — top-right */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <a
                    href={urls[name]}
                    download={name}
                    onClick={e => e.stopPropagation()}
                    title="Save to Downloads"
                    aria-label="Save to Downloads"
                    className="glass glass-pill px-2 py-1 text-xs"
                  >↓</a>
                  <button
                    onClick={async e => {
                      e.stopPropagation()
                      if (!confirm(`Delete ${name}? This removes the file from your project folder.`)) return
                      await project.deleteGeneration(name)
                      store.setGenerations(await project.listGenerations())
                    }}
                    title="Delete from project"
                    aria-label="Delete from project"
                    className="glass glass-pill px-2 py-1 text-xs text-red-400"
                  >×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function VideoTile({ posterUrl, project, name }: { posterUrl?: string; project: ProjectHandle | null; name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [src, setSrc] = useState<string | null>(null)

  const loadSrc = async () => {
    if (src || !project) return
    try {
      const blob = await project.readGeneration(name)
      setSrc(URL.createObjectURL(blob))
    } catch { /* no-op */ }
  }

  return (
    <video
      ref={videoRef}
      poster={posterUrl}
      src={src ?? undefined}
      muted
      loop
      playsInline
      onMouseEnter={async () => {
        await loadSrc()
        // After the await, the synthetic event's currentTarget can be null
        // if the element re-rendered. Use the ref instead — survives re-renders.
        videoRef.current?.play().catch(() => {})
      }}
      onMouseLeave={() => videoRef.current?.pause()}
      className="w-full aspect-square object-cover"
    />
  )
}

// Extract first-frame poster from a video blob.
// Returns null in jsdom (no <video> element support) — documented limitation.
async function extractPoster(blob: Blob): Promise<string | null> {
  return new Promise<string | null>(resolve => {
    if (typeof document === 'undefined') { resolve(null); return }
    const url = URL.createObjectURL(blob)
    const v = document.createElement('video')
    v.src = url
    v.muted = true
    v.playsInline = true
    v.addEventListener('loadeddata', () => { v.currentTime = 0.1 })
    v.addEventListener('seeked', () => {
      const c = document.createElement('canvas')
      c.width = v.videoWidth || 320; c.height = v.videoHeight || 320
      const ctx = c.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); resolve(null); return }
      ctx.drawImage(v, 0, 0)
      c.toBlob(posterBlob => {
        URL.revokeObjectURL(url)
        if (!posterBlob) { resolve(null); return }
        resolve(URL.createObjectURL(posterBlob))
      }, 'image/jpeg', 0.85)
    })
    v.addEventListener('error', () => { URL.revokeObjectURL(url); resolve(null) })
    v.load()
  })
}

import { useStore, store } from '@/state/store'
import { useEffect, useState } from 'react'

export function RefsUsedZone() {
  const pack = useStore(s => s.pack)
  const slug = useStore(s => s.activeShotSlug)
  const project = useStore(s => s.project)
  const [dragOver, setDragOver] = useState(false)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})

  const shot = pack?.shots.find(s => s.slug === slug) ?? null
  const refs = shot?.refs ?? []

  useEffect(() => {
    if (!project || refs.length === 0) { setThumbs({}); return }
    let cancelled = false
    const created: string[] = []
    ;(async () => {
      const map: Record<string, string> = {}
      for (const name of refs) {
        try {
          const blob = await project.readRef(name)
          const url = URL.createObjectURL(blob)
          map[name] = url; created.push(url)
        } catch { /* skip */ }
      }
      if (!cancelled) setThumbs(map)
    })()
    return () => {
      cancelled = true
      setTimeout(() => created.forEach(u => URL.revokeObjectURL(u)), 1000)
    }
  }, [project, refs.join('|')])

  if (!pack || !slug || !shot) return null

  const remove = (name: string) => store.updateShot(slug, { refs: shot.refs.filter(r => r !== name) })

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const name = e.dataTransfer.getData('application/x-pushing-frames-ref')
    if (!name || shot.refs.includes(name)) return
    store.updateShot(slug, { refs: [...shot.refs, name] })
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`flex items-center gap-2 flex-wrap border rounded-md p-2 ${dragOver ? 'border-mist bg-mist/5' : 'border-hairline'}`}
    >
      <span className="text-chalk text-xs uppercase mr-1">refs used</span>
      {shot.refs.map(name => (
        <span
          key={name}
          title={name}
          className="relative inline-block w-12 h-12 border border-hairline rounded-md overflow-hidden group"
        >
          {thumbs[name]
            ? <img src={thumbs[name]} alt={name} className="w-full h-full object-cover" />
            : <span className="block w-full h-full bg-dust" />}
          <button
            onClick={() => remove(name)}
            aria-label={`Remove ${name}`}
            className="absolute top-0 right-0 m-0.5 w-5 h-5 rounded-full bg-black/70 text-mist text-xs leading-none opacity-0 group-hover:opacity-100 transition"
          >×</button>
        </span>
      ))}
      {shot.refs.length === 0 && (
        <span className="text-smoke text-xs">drop refs here or click in the bin</span>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useStore, store } from '@/state/store'

export function RefBin() {
  const project = useStore(s => s.project)
  const refs = useStore(s => s.refFiles)
  const pack = useStore(s => s.pack)
  const activeSlug = useStore(s => s.activeShotSlug)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!project) return
    project.listRefs().then(names => store.setRefs(names))
  }, [project])

  useEffect(() => {
    if (!project) return
    let cancelled = false
    ;(async () => {
      const map: Record<string, string> = {}
      for (const name of refs) {
        try {
          const blob = await project.readRef(name)
          map[name] = URL.createObjectURL(blob)
        } catch { /* skip */ }
      }
      if (!cancelled) setThumbs(map)
    })()
    return () => { cancelled = true }
  }, [refs, project])

  const importFiles = async (files: File[]) => {
    setError(null)
    if (!project) { setError('Open a project first (no folder is selected).'); return }
    if (files.length === 0) return
    try {
      for (const file of files) {
        await project.importRef(file)
      }
      store.setRefs(await project.listRefs())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setError(null)
    // Accept three sources, in priority order:
    // 1. Drag from gallery — copy the generation file into refs/
    const genName = e.dataTransfer.getData('application/x-pushing-frames-gen')
    if (genName && project) {
      try {
        const blob = await project.readGeneration(genName)
        const file = new File([blob], genName, { type: blob.type })
        await importFiles([file])
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
      return
    }
    // 2. OS file drop (default)
    await importFiles(Array.from(e.dataTransfer.files))
  }

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await importFiles(Array.from(e.target.files ?? []))
    if (fileInput.current) fileInput.current.value = ''  // allow re-picking the same file
  }

  const openPicker = () => fileInput.current?.click()

  const activeShot = pack?.shots.find(s => s.slug === activeSlug)
  const toggleRef = (name: string) => {
    if (!activeShot || !activeSlug) return
    const next = activeShot.refs.includes(name) ? activeShot.refs.filter(r => r !== name) : [...activeShot.refs, name]
    store.updateShot(activeSlug, { refs: next })
  }

  return (
    <div
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
      className="flex flex-col h-full p-4 border border-hairline"
    >
      <header className="flex justify-between items-center mb-2 shrink-0">
        <h2 className="text-xs uppercase tracking-widest text-smoke">Ref Bin</h2>
        <button onClick={openPicker} className="text-xs text-smoke underline">add image</button>
      </header>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        onChange={onPick}
        className="hidden"
      />
      {refs.length === 0 && (
        <button onClick={openPicker} className="text-smoke text-xs underline mb-2">
          Drop ref images here, or click to choose.
        </button>
      )}
      {error && <p className="text-xs text-red-400 mt-1 shrink-0">{error}</p>}
      <div className="flex-1 overflow-y-auto -mr-2 pr-2">
        <div className="grid grid-cols-2 gap-2">
          {refs.map(name => {
            const bound = activeShot?.refs.includes(name)
            return (
              <button
                key={name}
                onClick={() => toggleRef(name)}
                draggable
                onDragStart={e => e.dataTransfer.setData('application/x-pushing-frames-ref', name)}
                className={`border ${bound ? 'border-mist border-2 shadow-[0_0_0_2px_rgba(232,232,232,0.15)]' : 'border-hairline'} p-1 rounded-md text-left`}
                title={name}
              >
                {thumbs[name]
                  ? <img src={thumbs[name]} alt={name} className="w-full aspect-square object-cover rounded-sm" />
                  : <div className="w-full aspect-square bg-dust rounded-sm" />}
                <div className={`text-[10px] mt-1 font-mono truncate ${bound ? 'text-mist' : 'text-smoke'}`}>{name}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

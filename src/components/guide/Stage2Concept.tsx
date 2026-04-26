import { useEffect, useRef, useState } from 'react'
import type { GuideState } from './GuideContainer'
import { wrapHandle } from '@/fs/projectHandle'

interface Props {
  state: GuideState
  update: (patch: Partial<GuideState>) => void
}

/**
 * Stage 2 — Concept. Captures a project summary, mood/world notes, and
 * lets the user drop reference images. Refs are written live into
 * <destination>/refs/ via wrapHandle(destinationDir).importRef. If the
 * user cancels the guide later, refs persist on disk—the user picked
 * the folder, the files are theirs.
 */
export function Stage2Concept({ state, update }: Props) {
  const [importError, setImportError] = useState<string | null>(null)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Re-derive thumbnail URLs whenever the ref list changes.
  useEffect(() => {
    if (!state.destinationDir || state.refs.length === 0) { setThumbs({}); return }
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
        } catch { /* ref missing on disk, skip */ }
      }
      if (!cancelled) setThumbs(map)
    })()
    return () => {
      cancelled = true
      setTimeout(() => created.forEach(u => URL.revokeObjectURL(u)), 1000)
    }
  }, [state.destinationDir, state.refs.join('|')])

  const importFiles = async (files: File[]) => {
    setImportError(null)
    if (!state.destinationDir) { setImportError('Pick a destination folder in Stage 1 first.'); return }
    if (files.length === 0) return
    try {
      const project = wrapHandle(state.destinationDir)
      for (const file of files) {
        await project.importRef(file)
      }
      const updated = await project.listRefs()
      update({ refs: updated })
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    }
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    await importFiles(Array.from(e.dataTransfer.files))
  }

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await importFiles(Array.from(e.target.files ?? []))
    if (fileInput.current) fileInput.current.value = ''
  }

  const remove = async (name: string) => {
    if (!state.destinationDir) return
    if (!confirm(`Remove ${name} from the project's refs/ folder?`)) return
    try {
      const refsDir = await state.destinationDir.getDirectoryHandle('refs')
      await refsDir.removeEntry(name)
      update({ refs: state.refs.filter(r => r !== name) })
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg">Concept</h2>
        <p className="text-xs text-smoke">A short brief and any reference images. Both feed Gemini if you ask it to draft prompts later.</p>
      </header>

      <label className="block space-y-1">
        <span className="text-xs text-smoke uppercase tracking-widest">Project summary</span>
        <textarea
          value={state.summary}
          onChange={e => update({ summary: e.target.value })}
          rows={3}
          placeholder="A 1-3 sentence elevator pitch. What's the world, who's the subject, what's the mood?"
          className="w-full bg-transparent border border-hairline rounded-md p-2 text-sm"
        />
        <span className="text-[10px] text-smoke">required—dense and specific beats long and vague</span>
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-smoke uppercase tracking-widest">Mood / world notes</span>
        <textarea
          value={state.mood}
          onChange={e => update({ mood: e.target.value })}
          rows={3}
          placeholder="Optional. References, eras, weather, emotional register, anything that frames the look."
          className="w-full bg-transparent border border-hairline rounded-md p-2 text-sm"
        />
      </label>

      <section className="space-y-2">
        <header className="flex items-center justify-between">
          <span className="text-xs text-smoke uppercase tracking-widest">References ({state.refs.length})</span>
          <button onClick={() => fileInput.current?.click()} className="text-xs text-smoke underline">add image</button>
        </header>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          onChange={onPick}
          className="hidden"
        />
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-md p-4 transition ${dragOver ? 'border-mist bg-mist/5' : 'border-hairline'}`}
        >
          {state.refs.length === 0 ? (
            <button onClick={() => fileInput.current?.click()} className="w-full text-smoke text-xs py-6">
              Drop ref images here, or click to choose. Files write into {state.destinationDir?.name ?? 'destination'}/refs/.
            </button>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {state.refs.map(name => (
                <div key={name} className="relative group" title={name}>
                  {thumbs[name]
                    ? <img src={thumbs[name]} alt={name} className="w-full aspect-square object-cover rounded-sm" />
                    : <div className="w-full aspect-square bg-dust rounded-sm" />}
                  <div className="text-[10px] mt-1 font-mono truncate text-smoke">{name}</div>
                  <button
                    onClick={() => remove(name)}
                    aria-label={`Remove ${name}`}
                    className="absolute top-1 right-1 m-0.5 w-5 h-5 rounded-full bg-black/70 text-mist text-xs leading-none opacity-0 group-hover:opacity-100 transition"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        {importError && <p className="text-xs text-red-400">{importError}</p>}
      </section>
    </div>
  )
}

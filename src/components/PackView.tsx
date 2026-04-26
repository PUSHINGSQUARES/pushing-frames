import { useStore } from '@/state/store'
import { serialisePack } from '@/pack/serialise'

export function PackView({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pack = useStore(s => s.pack)
  if (!pack) return null
  const md = serialisePack(pack)
  return (
    <aside className={`fixed right-0 top-0 bottom-0 w-[420px] z-40 transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="glass glass-card h-full m-3 p-4 flex flex-col">
        <header className="flex justify-between items-center mb-2">
          <h2 className="text-xs uppercase tracking-widest text-smoke">pack.md</h2>
          <button onClick={onClose} className="text-smoke text-xs">close</button>
        </header>
        <pre className="flex-1 overflow-auto font-mono text-xs text-mist whitespace-pre-wrap">{md}</pre>
      </div>
    </aside>
  )
}

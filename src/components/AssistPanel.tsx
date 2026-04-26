import { useState } from 'react'
import { useStore, store } from '@/state/store'
import { readVendorKey } from '@/vault/vendor_keys'
import { scaffoldPrompt } from '@/assist/scaffold'
import type { NormalisedRef } from '@/providers/types'

interface Props {
  refs: NormalisedRef[]
}

export function AssistPanel({ refs }: Props) {
  const [open, setOpen] = useState(false)
  const [idea, setIdea] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const slug = useStore(s => s.activeShotSlug)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-smoke hover:text-mist border border-hairline px-2 py-1 transition-colors"
      >
        assist
      </button>
    )
  }

  async function run() {
    const trimmed = idea.trim()
    if (!trimmed || !slug) return
    setLoading(true)
    setError(null)
    try {
      const blob = await readVendorKey('google')
      if (!blob || !('key' in blob)) throw new Error('No Google key — add one in Settings.')
      const text = await scaffoldPrompt(trimmed, refs, blob.key)
      store.updateShot(slug, { action: text })
      setIdea('')
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'scaffold failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-hairline p-3 space-y-2 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-smoke">Assist</span>
        <button onClick={() => { setOpen(false); setError(null) }} className="text-smoke text-xs hover:text-mist">
          close
        </button>
      </div>
      <textarea
        className="w-full bg-transparent border border-hairline p-2 text-sm font-sans placeholder:text-smoke resize-none"
        rows={3}
        placeholder="short idea — paddock dawn, M3 + M4, hero walks up with helmet"
        value={idea}
        onChange={e => setIdea(e.target.value)}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={run}
        disabled={loading || !idea.trim()}
        className="text-xs px-3 py-1 border border-hairline disabled:opacity-40 hover:enabled:bg-white/5 transition-colors"
      >
        {loading ? 'scaffolding…' : 'scaffold prompt'}
      </button>
    </div>
  )
}

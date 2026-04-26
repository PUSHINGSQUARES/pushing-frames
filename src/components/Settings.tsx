import { useEffect, useState } from 'react'
import { storeVendorKey, readVendorKey, type VendorId } from '@/vault/vendor_keys'
import { VENDOR_LABELS, VENDOR_CONSOLE_URLS, ADAPTER_VENDOR } from '@/providers/vendors'
import { primeKeys } from '@/providers'
import { GlassPill } from './GlassPill'
import type { AdapterId } from '@/providers/vendors'
import capsJson from '@/providers/capabilities.json'

const CONCURRENCY_LS_KEY = 'pushing_frames_concurrency_overrides'

type CapsEntry = { maxConcurrent?: number; supportsImage?: boolean; supportsVideo?: boolean }
const capsData = capsJson as Record<string, CapsEntry>

// One row per unique vendor that has at least one image or video adapter
const CONCURRENCY_VENDORS: { vendorId: string; label: string; defaultLimit: number }[] = (() => {
  const seen = new Set<string>()
  const result: { vendorId: string; label: string; defaultLimit: number }[] = []
  for (const [adapterId, c] of Object.entries(capsData)) {
    if (!c.supportsImage && !c.supportsVideo) continue
    const vid = ADAPTER_VENDOR[adapterId as AdapterId]
    if (!vid || seen.has(vid)) continue
    seen.add(vid)
    // Use the vendor key's own caps entry for the default (same lookup as getLimit in queue_instance)
    const defaultLimit = capsData[vid]?.maxConcurrent ?? 2
    result.push({ vendorId: vid, label: VENDOR_LABELS[vid as VendorId] ?? vid, defaultLimit })
  }
  return result
})()

interface VendorSpec {
  id: VendorId
  blurb: string
  adapters: AdapterId[]
  multiField?: boolean
  enabled: boolean
}

const VENDORS: VendorSpec[] = [
  { id: 'seedream',   blurb: 'Seedream image + Seedance video', adapters: ['seedream', 'seedance'], enabled: true },
  { id: 'openai',     blurb: 'GPT-image-2',                     adapters: ['openai-image'], enabled: true },
  { id: 'google',     blurb: 'Gemini Image + Imagen + Veo 3',   adapters: ['gemini-image', 'imagen', 'veo-3'], enabled: true },
  { id: 'kling',      blurb: 'Kling video',                     adapters: ['kling'], multiField: true, enabled: true },
  { id: 'openrouter', blurb: 'Unified routing for OpenAI + Gemini', adapters: ['openrouter'], enabled: true },
]

type DraftMap = Record<string, { key?: string; accessKey?: string; secretKey?: string }>

export function Settings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [drafts, setDrafts] = useState<DraftMap>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [concurrencyOverrides, setConcurrencyOverrides] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!open) return
    ;(async () => {
      const s: Record<string, boolean> = {}
      for (const v of VENDORS) s[v.id] = !!(await readVendorKey(v.id).catch(() => null))
      setSaved(s); setDrafts({}); setMsg(null)
      try {
        const raw = localStorage.getItem(CONCURRENCY_LS_KEY)
        setConcurrencyOverrides(raw ? (JSON.parse(raw) as Record<string, number>) : {})
      } catch { setConcurrencyOverrides({}) }
    })()
  }, [open])

  const setConcurrency = (vendorId: string, value: number | null) => {
    const next = { ...concurrencyOverrides }
    if (value === null) delete next[vendorId]
    else next[vendorId] = value
    setConcurrencyOverrides(next)
    try { localStorage.setItem(CONCURRENCY_LS_KEY, JSON.stringify(next)) } catch { /* swallow */ }
  }

  const update = (id: string, patch: Partial<{ key: string; accessKey: string; secretKey: string }>) =>
    setDrafts(d => ({ ...d, [id]: { ...d[id], ...patch } }))

  const save = async (v: VendorSpec) => {
    setSaving(v.id); setMsg(null)
    try {
      const draft = drafts[v.id] ?? {}
      if (v.multiField) {
        if (!draft.accessKey || !draft.secretKey) throw new Error('access key + secret key required')
        await storeVendorKey(v.id, { accessKey: draft.accessKey, secretKey: draft.secretKey })
      } else {
        if (!draft.key) throw new Error('key required')
        await storeVendorKey(v.id, { key: draft.key })
      }
      await primeKeys(v.adapters as AdapterId[])
      setSaved(s => ({ ...s, [v.id]: true }))
      setDrafts(d => ({ ...d, [v.id]: {} }))
      setMsg(`${VENDOR_LABELS[v.id]} saved`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally { setSaving(null) }
  }

  if (!open) return null
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-6">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <GlassPill shape="card" className="space-y-4">
          <header className="flex justify-between items-center">
            <h2 className="text-sm uppercase tracking-widest">Settings — API Keys</h2>
            <button onClick={onClose} className="text-smoke text-xs">close</button>
          </header>
          <p className="text-xs text-smoke">
            Keys are encrypted with your vault passphrase and stored locally in IndexedDB. They never leave this machine.
          </p>
          <div className="space-y-3">
            {VENDORS.map(v => (
              <VendorRow
                key={v.id}
                vendor={v}
                draft={drafts[v.id] ?? {}}
                saved={!!saved[v.id]}
                saving={saving === v.id}
                onChange={patch => update(v.id, patch)}
                onSave={() => save(v)}
              />
            ))}
          </div>
          {msg && <p className="text-xs text-smoke">{msg}</p>}

          <div className="border-t border-hairline pt-4 space-y-3">
            <header>
              <h3 className="text-xs uppercase tracking-widest">Concurrency</h3>
              <p className="text-xs text-smoke mt-1">
                Parallel slots per provider. Pack frontmatter overrides these. Lower if you hit rate limits.
              </p>
            </header>
            {CONCURRENCY_VENDORS.map(({ vendorId, label, defaultLimit }) => {
              const effective = concurrencyOverrides[vendorId] ?? defaultLimit
              const isOverridden = vendorId in concurrencyOverrides
              return (
                <div key={vendorId} className="border border-hairline rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono">{effective}</span>
                      {isOverridden && (
                        <button
                          onClick={() => setConcurrency(vendorId, null)}
                          className="text-[10px] text-smoke underline"
                        >reset to default</button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={16}
                    value={effective}
                    onChange={e => setConcurrency(vendorId, Number(e.target.value))}
                    className="w-full accent-white"
                  />
                  <div className="flex justify-between text-[10px] text-smoke">
                    <span>1</span>
                    <span>default: {defaultLimit}</span>
                    <span>16</span>
                  </div>
                </div>
              )
            })}
          </div>
        </GlassPill>
      </div>
    </div>
  )
}

function VendorRow({ vendor, draft, saved, saving, onChange, onSave }: {
  vendor: VendorSpec
  draft: { key?: string; accessKey?: string; secretKey?: string }
  saved: boolean
  saving: boolean
  onChange: (patch: Partial<{ key: string; accessKey: string; secretKey: string }>) => void
  onSave: () => void
}) {
  return (
    <div className="space-y-2 border border-hairline rounded-lg p-3">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-xs">{VENDOR_LABELS[vendor.id]}{saved && <span className="ml-2 text-green-400">&#x2713; saved</span>}</div>
          <div className="text-[10px] text-smoke">{vendor.blurb}</div>
        </div>
        <a href={VENDOR_CONSOLE_URLS[vendor.id]} target="_blank" rel="noreferrer" className="text-xs text-smoke underline">get key</a>
      </div>
      {vendor.multiField ? (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={draft.accessKey ?? ''}
            onChange={e => onChange({ accessKey: e.target.value })}
            disabled={!vendor.enabled}
            placeholder={vendor.enabled ? 'access key' : 'v0.3'}
            className="bg-transparent border border-hairline rounded-md p-1 text-xs font-mono disabled:text-smoke"
          />
          <input
            type="text"
            value={draft.secretKey ?? ''}
            onChange={e => onChange({ secretKey: e.target.value })}
            disabled={!vendor.enabled}
            placeholder={vendor.enabled ? 'secret key' : 'v0.3'}
            className="bg-transparent border border-hairline rounded-md p-1 text-xs font-mono disabled:text-smoke"
          />
        </div>
      ) : (
        <input
          type="text"
          value={draft.key ?? ''}
          onChange={e => onChange({ key: e.target.value })}
          disabled={!vendor.enabled}
          placeholder={vendor.enabled ? 'paste key' : 'adapter ships v0.3'}
          className="w-full bg-transparent border border-hairline rounded-md p-1 text-xs font-mono disabled:text-smoke"
        />
      )}
      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={!vendor.enabled || saving}
          className="glass glass-pill px-3 py-1 text-xs disabled:opacity-40"
        >{saving ? 'saving' : 'save'}</button>
      </div>
    </div>
  )
}

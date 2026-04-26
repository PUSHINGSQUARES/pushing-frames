import { useStore, store } from '@/state/store'
import { listModels, getDefaultModel, findModel } from '@/providers/models'
import type { AdapterId } from '@/providers/vendors'

export function ResolutionPicker() {
  const pack = useStore(s => s.pack)
  const slug = useStore(s => s.activeShotSlug)
  if (!pack || !slug) return null
  const shot = pack.shots.find(s => s.slug === slug)
  if (!shot) return null

  const providerId = pack.frontmatter.active_provider as AdapterId
  const modelLabel = pack.frontmatter.active_model
  const model = (modelLabel ? findModel(providerId, modelLabel) : null) ?? getDefaultModel(providerId)
  const resolutions = model?.allowed_resolutions ?? listModels(providerId)[0]?.allowed_resolutions ?? []

  // Aspect-only models — picker disabled, show label only.
  const isAspectOnly = resolutions.length === 0 || (resolutions.length === 1 && resolutions[0] === 'auto')
  const value = shot.resolution ?? resolutions[0] ?? 'auto'

  return (
    <>
      <span className="text-chalk text-xs uppercase">resolution</span>
      <select
        value={value}
        disabled={isAspectOnly}
        onChange={e => store.updateShot(slug, { resolution: e.target.value })}
        className="bg-transparent border border-hairline rounded-md p-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isAspectOnly
          ? <option value="auto">aspect-derived</option>
          : resolutions.map(r => <option key={r} value={r} className="bg-void">{r}</option>)
        }
      </select>
    </>
  )
}

import { GenerationQueue } from './queue'
import { runGeneration } from './generate'
import { ADAPTER_VENDOR, type AdapterId } from '@/providers/vendors'
import { store } from '@/state/store'
import caps from '@/providers/capabilities.json'

export const generationQueue = new GenerationQueue(
  (slug, onProgress, abort, itemId) => runGeneration(slug, onProgress, abort, itemId),
  {
    getLimit: (vendor) => {
      const pack = store.getState().pack
      const packOverride = pack?.frontmatter.concurrency?.[vendor]
      if (typeof packOverride === 'number') return packOverride
      try {
        const raw = localStorage.getItem('pushing_frames_concurrency_overrides')
        if (raw) {
          const overrides = JSON.parse(raw) as Record<string, number>
          const lsOverride = overrides[vendor]
          if (typeof lsOverride === 'number') return lsOverride
        }
      } catch { /* swallow — localStorage may be unavailable */ }
      const cap = (caps as Record<string, { maxConcurrent?: number }>)[vendor]
      return cap?.maxConcurrent ?? 2
    },
  },
)

export function enqueueActiveShot(): void {
  const { pack, activeShotSlug } = store.getState()
  if (!pack || !activeShotSlug) return
  const shot = pack.shots.find(s => s.slug === activeShotSlug)!
  const shotProvider = (shot.provider as AdapterId | undefined) ?? pack.frontmatter.active_provider
  const vendor = ADAPTER_VENDOR[shotProvider]
  const variations = shot.variations ?? pack.frontmatter.variations_default ?? 1
  const now = Date.now()
  const items = Array.from({ length: variations }, (_, i) => ({
    id: `${activeShotSlug}-${i + 1}-${now}`,
    shotSlug: activeShotSlug,
    vendor,
  }))
  generationQueue.enqueue(items)
}

export function enqueueAllShots(): void {
  const { pack } = store.getState()
  if (!pack) return
  const now = Date.now()
  const items = pack.shots.flatMap(s => {
    const shotProvider = (s.provider as AdapterId | undefined) ?? pack.frontmatter.active_provider
    const vendor = ADAPTER_VENDOR[shotProvider]
    const variations = s.variations ?? pack.frontmatter.variations_default ?? 1
    return Array.from({ length: variations }, (_, i) => ({
      id: `${s.slug}-${i + 1}-${now}`,
      shotSlug: s.slug,
      vendor,
    }))
  })
  generationQueue.enqueue(items)
}

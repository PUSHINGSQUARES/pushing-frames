import { describe, it, expect, vi, beforeEach } from 'vitest'
import { store } from '@/state/store'
import type { Pack } from '@/pack/types'

// Re-create a local queue with mocked runner for isolation
import { GenerationQueue } from './queue'

const basePack: Pack = {
  frontmatter: {
    title: 'Test',
    slug: 'test',
    active_provider: 'seedream',
    variations_default: 3,
    budget_project: 10,
    budget_currency: 'GBP',
  },
  blocks: [],
  shots: [
    { slug: 'shot_01', action: 'a', refs: [], styleBlocks: [], negBlocks: [], variations: 2 },
    { slug: 'shot_02', action: 'b', refs: [], styleBlocks: [], negBlocks: [] },
  ],
}

beforeEach(() => {
  store.setPack(basePack)
  store.setActiveShot('shot_01')
})

describe('enqueue N variations', () => {
  it('enqueues shot.variations items for active shot', async () => {
    const runner = vi.fn().mockResolvedValue(undefined)
    const queue = new GenerationQueue(runner, { getLimit: () => 8 })
    const { pack, activeShotSlug } = store.getState()
    if (!pack || !activeShotSlug) throw new Error('no pack')
    const shot = pack.shots.find(s => s.slug === activeShotSlug)!
    const variations = shot.variations ?? pack.frontmatter.variations_default ?? 1
    const now = Date.now()
    const items = Array.from({ length: variations }, (_, i) => ({
      id: `${activeShotSlug}-${i + 1}-${now}`,
      shotSlug: activeShotSlug,
      vendor: 'ark',
    }))
    queue.enqueue(items)
    await new Promise(r => setTimeout(r, 20))
    expect(runner).toHaveBeenCalledTimes(2)  // shot_01 has variations: 2
  })

  it('enqueues variations_default for shots without override', async () => {
    const runner = vi.fn().mockResolvedValue(undefined)
    const queue = new GenerationQueue(runner, { getLimit: () => 8 })
    const { pack } = store.getState()
    if (!pack) throw new Error('no pack')
    const now = Date.now()
    const items = pack.shots.flatMap(s => {
      const v = s.variations ?? pack.frontmatter.variations_default ?? 1
      return Array.from({ length: v }, (_, i) => ({
        id: `${s.slug}-${i + 1}-${now}`,
        shotSlug: s.slug,
        vendor: 'ark',
      }))
    })
    queue.enqueue(items)
    await new Promise(r => setTimeout(r, 20))
    // shot_01: variations=2, shot_02: variations_default=3 → total 5
    expect(runner).toHaveBeenCalledTimes(5)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { store } from '@/state/store'
import type { Pack } from '@/pack/types'

// Mock runGeneration so the queue runner never actually fires an API call.
// The promise never resolves — items stay in 'running' state — which is fine
// for snapshot assertions that only care about shotSlug and vendor routing.
vi.mock('./generate', () => ({
  runGeneration: vi.fn(() => new Promise<void>(() => {})),
}))

const { generationQueue, enqueueActiveShot, enqueueAllShots } = await import('./queue_instance')

const multiShotPack: Pack = {
  frontmatter: {
    title: 'Test',
    slug: 'test',
    active_provider: 'seedream',
    variations_default: 1,
    budget_project: 10,
    budget_currency: 'GBP',
  },
  blocks: [],
  shots: [
    { slug: 'shot_A', action: 'a', refs: [], styleBlocks: [], negBlocks: [], variations: 3 },
    { slug: 'shot_B', action: 'b', refs: [], styleBlocks: [], negBlocks: [] },
    { slug: 'shot_C', action: 'c', refs: [], styleBlocks: [], negBlocks: [] },
  ],
}

// Clear the singleton queue between tests
function clearQueue(): void {
  ;(generationQueue as unknown as { items: unknown[] }).items = []
  ;(generationQueue as unknown as { running: Map<string, number> }).running = new Map()
}

beforeEach(() => {
  clearQueue()
  store.setPack(multiShotPack)
  store.setActiveShot('shot_A')
})

// ── Bug #4 — generate button must call enqueueActiveShot, not enqueueAllShots ─

describe('enqueueActiveShot wiring (bug #4)', () => {
  it('only enqueues items for the active shot', () => {
    enqueueActiveShot()
    const items = generationQueue.snapshot()
    const otherShots = items.filter(i => i.shotSlug !== 'shot_A')
    expect(otherShots).toHaveLength(0)
  })

  it('enqueues exactly shot.variations items for the active shot', () => {
    enqueueActiveShot()
    const items = generationQueue.snapshot()
    // shot_A has variations: 3
    expect(items).toHaveLength(3)
  })

  it('enqueueAllShots enqueues for every shot (contrast check)', () => {
    enqueueAllShots()
    const items = generationQueue.snapshot()
    const slugs = new Set(items.map(i => i.shotSlug))
    expect(slugs.size).toBe(3)  // all three shots appear
  })
})

// ── Bug #5 — per-shot provider override must flow through to vendor routing ───

describe('enqueueActiveShot per-shot provider routing (bug #5)', () => {
  it('uses per-shot provider vendor when shot.provider is set', () => {
    const packWithPerShotProvider: Pack = {
      ...multiShotPack,
      shots: [
        // shot_A overrides to openai-image; global active_provider is seedream
        { slug: 'shot_A', action: 'a', refs: [], styleBlocks: [], negBlocks: [], variations: 1, provider: 'openai-image' },
        { slug: 'shot_B', action: 'b', refs: [], styleBlocks: [], negBlocks: [] },
      ],
    }
    store.setPack(packWithPerShotProvider)
    store.setActiveShot('shot_A')
    enqueueActiveShot()
    const items = generationQueue.snapshot()
    // openai-image maps to vendor 'openai'
    expect(items.every(i => i.vendor === 'openai')).toBe(true)
  })

  it('falls back to global active_provider vendor when shot.provider is absent', () => {
    enqueueActiveShot()
    const items = generationQueue.snapshot()
    // No per-shot provider; global is seedream → vendor 'seedream'
    expect(items.every(i => i.vendor === 'seedream')).toBe(true)
  })

  it('enqueueAllShots routes each shot to its own vendor', () => {
    const mixedPack: Pack = {
      ...multiShotPack,
      shots: [
        { slug: 'shot_A', action: 'a', refs: [], styleBlocks: [], negBlocks: [], provider: 'openai-image' },
        { slug: 'shot_B', action: 'b', refs: [], styleBlocks: [], negBlocks: [], provider: 'gemini-image' },
        { slug: 'shot_C', action: 'c', refs: [], styleBlocks: [], negBlocks: [] },  // falls back to seedream
      ],
    }
    store.setPack(mixedPack)
    enqueueAllShots()
    const items = generationQueue.snapshot()
    const vendorOf = (slug: string) => items.find(i => i.shotSlug === slug)?.vendor
    expect(vendorOf('shot_A')).toBe('openai')
    expect(vendorOf('shot_B')).toBe('google')
    expect(vendorOf('shot_C')).toBe('seedream')
  })
})

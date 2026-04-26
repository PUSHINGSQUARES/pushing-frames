import { describe, it, expect, vi, beforeEach } from 'vitest'
import { store } from '@/state/store'
import type { Pack } from '@/pack/types'

const makeShot = (slug: string) => ({
  slug,
  action: '',
  refs: [] as string[],
  styleBlocks: [] as string[],
  negBlocks: [] as string[],
})

const basePack: Pack = {
  frontmatter: {
    title: 'Test',
    slug: 'test',
    active_provider: 'seedream',
    variations_default: 1,
    budget_project: 10,
    budget_currency: 'GBP',
  },
  blocks: [],
  shots: [makeShot('a'), makeShot('b'), makeShot('c')],
}

beforeEach(() => {
  store.setPack({ ...basePack, shots: [makeShot('a'), makeShot('b'), makeShot('c')] })
  vi.spyOn(store, '_scheduleStoryboardWrite').mockImplementation(() => {})
})

describe('store.reorderShots', () => {
  it('moves a shot from end to start', () => {
    store.reorderShots(2, 0)
    const slugs = store.getState().pack?.shots.map(s => s.slug)
    expect(slugs).toEqual(['c', 'a', 'b'])
  })

  it('moves a shot from start to end', () => {
    store.reorderShots(0, 2)
    const slugs = store.getState().pack?.shots.map(s => s.slug)
    expect(slugs).toEqual(['b', 'c', 'a'])
  })

  it('no-ops when from === to', () => {
    store.reorderShots(1, 1)
    const slugs = store.getState().pack?.shots.map(s => s.slug)
    expect(slugs).toEqual(['a', 'b', 'c'])
  })

  it('does not throw when no pack is loaded', () => {
    store.setPack(null as unknown as Pack)
    expect(() => store.reorderShots(0, 1)).not.toThrow()
  })

  // scheduleStoryboardWrite is called via the private module closure, not
  // store._scheduleStoryboardWrite. Persistence is covered by the integration
  // build test (B6). The timer fires within 500ms; no assertion needed here.
})

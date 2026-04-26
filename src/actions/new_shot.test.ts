import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addNewShot } from './new_shot'
import { store } from '@/state/store'
import type { Pack } from '@/pack/types'

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
  shots: [],
}

beforeEach(() => {
  store.setPack(basePack)
  // suppress autosave writes in unit tests
  vi.spyOn(store, '_scheduleStoryboardWrite').mockImplementation(() => {})
})

describe('addNewShot', () => {
  it('creates a shot with auto-incremented slug', () => {
    const slug = addNewShot()
    expect(slug).toBe('shot_01')
    expect(store.getState().pack?.shots).toHaveLength(1)
  })

  it('slug increments on second call', () => {
    addNewShot()
    const slug = addNewShot()
    expect(slug).toBe('shot_02')
    expect(store.getState().pack?.shots).toHaveLength(2)
  })

  it('activates the new shot', () => {
    const slug = addNewShot()
    expect(store.getState().activeShotSlug).toBe(slug)
  })

  it('persists to storyboard (schedules write)', () => {
    addNewShot()
    expect(store._scheduleStoryboardWrite).toHaveBeenCalled()
  })
})

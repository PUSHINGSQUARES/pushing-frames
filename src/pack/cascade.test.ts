import { describe, it, expect } from 'vitest'
import { cascade } from './cascade'
import type { Pack } from './types'

const master: Pack = {
  frontmatter: { title: 'Master', slug: 'master', active_provider: 'seedream', variations_default: 1, budget_project: 0, budget_currency: 'GBP' },
  blocks: [
    { name: 'STYLE_GUIDE', body: 'master style' },
    { name: 'NEG_HUMAN', body: 'master neg human' },
  ],
  shots: [],
}

const project: Pack = {
  frontmatter: { title: 'Project', slug: 'proj', active_provider: 'openai-image', variations_default: 1, budget_project: 20, budget_currency: 'GBP' },
  blocks: [
    { name: 'STYLE_GUIDE', body: 'project style' }, // overrides master
    { name: 'NEG_CAR', body: 'project neg car' }, // added
  ],
  shots: [{ slug: 'shot_one', action: 'test', refs: [], styleBlocks: ['STYLE_GUIDE'], negBlocks: ['NEG_HUMAN'] }],
}

describe('cascade', () => {
  it('merges blocks with project overriding master by name', () => {
    const merged = cascade(master, project)
    const names = merged.blocks.map(b => b.name).sort()
    expect(names).toEqual(['NEG_CAR', 'NEG_HUMAN', 'STYLE_GUIDE'])
    expect(merged.blocks.find(b => b.name === 'STYLE_GUIDE')!.body).toBe('project style')
    expect(merged.blocks.find(b => b.name === 'NEG_HUMAN')!.body).toBe('master neg human')
  })

  it('uses project frontmatter over master', () => {
    const merged = cascade(master, project)
    expect(merged.frontmatter.title).toBe('Project')
    expect(merged.frontmatter.active_provider).toBe('openai-image')
  })

  it('keeps project shots as-is (no shot inheritance)', () => {
    const merged = cascade(master, project)
    expect(merged.shots).toHaveLength(1)
  })
})

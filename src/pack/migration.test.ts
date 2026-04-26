import { describe, it, expect } from 'vitest'
import { splitLegacyPack } from './migration'

const legacy = `---
title: Legacy
slug: legacy
active_provider: seedream
budget_project: 5
---

## STYLE_GUIDE
old style.

## NEG_HUMAN
old neg.

# Shots

| Shot | Camera | Lens | Aspect | Action | Refs | Style | Neg |
|------|--------|------|--------|--------|------|-------|-----|
| s1 | cam | lens | 16:9 | act | r.jpg | STYLE_GUIDE | NEG_HUMAN |
`

describe('splitLegacyPack', () => {
  it('produces style.md + storyboard.md text', () => {
    const { style, storyboard } = splitLegacyPack(legacy)
    expect(style).toContain('## STYLE_GUIDE')
    expect(style).toContain('old style')
    expect(storyboard).toContain('# Shots')
    expect(storyboard).toContain('s1')
  })

  it('style has no shot table', () => {
    const { style } = splitLegacyPack(legacy)
    expect(style).not.toContain('# Shots')
  })

  it('storyboard has no style blocks', () => {
    const { storyboard } = splitLegacyPack(legacy)
    expect(storyboard).not.toContain('## STYLE_GUIDE')
  })

  it('storyboard frontmatter preserves slug + provider', () => {
    const { storyboard } = splitLegacyPack(legacy)
    expect(storyboard).toContain('slug: legacy')
    expect(storyboard).toContain('active_provider: seedream')
  })
})

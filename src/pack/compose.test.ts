import { describe, it, expect } from 'vitest'
import { composePrompt } from './compose'
import type { Pack, Shot } from './types'

const pack: Pack = {
  frontmatter: { title: 'T', slug: 't', active_provider: 'seedream', variations_default: 1, budget_project: 10, budget_currency: 'GBP' },
  blocks: [
    { name: 'STYLE_GUIDE', body: 'Kodak Vision3 50D, halation.' },
    { name: 'NEG_CAR', body: 'deformed car' },
  ],
  shots: [],
}

const shot: Shot = {
  slug: 's', camera: 'ARRI Alexa', lens: '24mm T1.5', aspect: '16:9',
  action: 'Wide pit-lane dawn push-in.', refs: [], styleBlocks: ['STYLE_GUIDE'], negBlocks: ['NEG_CAR'],
}

describe('composePrompt', () => {
  it('concatenates camera + lens + action + style, appends negatives', () => {
    const p = composePrompt(pack, shot)
    expect(p).toContain('ARRI Alexa')
    expect(p).toContain('24mm T1.5')
    expect(p).toContain('Wide pit-lane')
    expect(p).toContain('Kodak Vision3')
    expect(p).toContain('Negative prompt: deformed car')
  })
})

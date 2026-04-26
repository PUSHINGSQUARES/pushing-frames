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
  it('leads with the no-text guard so models do not bake metadata as captions', () => {
    const p = composePrompt(pack, shot)
    expect(p.startsWith('Render as a clean photograph')).toBe(true)
    expect(p).toContain('Do not display any text')
  })

  it('does not prepend camera+lens+aspect as a caption-style comma list', () => {
    const p = composePrompt(pack, shot)
    // The old behaviour was to prepend "ARRI Alexa, 24mm T1.5, 16:9 Wide pit-lane…"
    // — every image model rendered that as a caption. The action body is
    // expected to carry camera info via "Shot on …" instead.
    expect(p).not.toMatch(/ARRI Alexa, 24mm T1\.5, 16:9/)
  })

  it('includes the action body and style body, in that order', () => {
    const p = composePrompt(pack, shot)
    expect(p).toContain('Wide pit-lane')
    expect(p).toContain('Kodak Vision3')
    expect(p.indexOf('Wide pit-lane')).toBeLessThan(p.indexOf('Kodak Vision3'))
  })

  it('appends an aspect cue as natural language after the style bodies', () => {
    const p = composePrompt(pack, shot)
    expect(p).toContain('Composed for a 16:9 frame.')
    expect(p.indexOf('Composed for a 16:9')).toBeGreaterThan(p.indexOf('Kodak Vision3'))
  })

  it('appends user negatives plus a baseline anti-text negative', () => {
    const p = composePrompt(pack, shot)
    expect(p).toContain('Negative prompt:')
    expect(p).toContain('rendered text')
    expect(p).toContain('deformed car')
  })

  it('still emits the baseline anti-text negative when no user negatives are selected', () => {
    const noNeg: Shot = { ...shot, negBlocks: [] }
    const p = composePrompt(pack, noNeg)
    expect(p).toContain('Negative prompt: rendered text')
  })

  it('uses a video-flavoured lead when shot.video_mode is set, so video models are not pushed toward stills', () => {
    const videoShot: Shot = { ...shot, video_mode: 'i2v' }
    const p = composePrompt(pack, videoShot)
    expect(p.startsWith('Render as a clean cinematic video clip')).toBe(true)
    expect(p).not.toContain('Render as a clean photograph')
  })
})

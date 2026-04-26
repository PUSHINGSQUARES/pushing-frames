import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SeedreamAdapter } from './seedream'
import type { Shot } from './types'

const shot: Shot = {
  slug: 's1', action: 'a wide shot', refs: [],
  styleBlocks: [], negBlocks: [], prompt: 'a wide shot, cinematic',
}

describe('SeedreamAdapter', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('estimates cost from pricing table', () => {
    const a = new SeedreamAdapter(() => 'sk-test')
    const est = a.estimate(shot, { model: 'seedream-4-5-251128' })
    expect(est.costGBP).toBeCloseTo(0.04, 2)
  })

  it('generates via the Ark API and returns bytes', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71])
    const b64 = btoa(String.fromCharCode(...bytes))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: b64 }],
    }), { status: 200 })))
    const a = new SeedreamAdapter(() => 'sk-test')
    const result = await a.generate(shot, [], { model: 'seedream-4-5-251128' }, () => {})
    expect(result.bytes).toEqual(bytes)
    expect(result.mimeType).toBe('image/png')
    expect(result.costGBP).toBeCloseTo(0.04, 2)
  })

  it('throws with provider context on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 401 })))
    const a = new SeedreamAdapter(() => 'sk-test')
    await expect(a.generate(shot, [], { model: 'seedream-4-5-251128' }, () => {})).rejects.toThrow(/seedream.*401/i)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Veo3Adapter } from './veo-3'
import type { Shot, GenerateOpts, NormalisedRef } from './types'

const shot: Shot = { slug: 's1', action: 'a', refs: [], styleBlocks: [], negBlocks: [], prompt: 'a beach' }

function makeRef(): NormalisedRef {
  return { filename: 'r.jpg', blob: new Blob([new Uint8Array([1])], { type: 'image/jpeg' }), mimeType: 'image/jpeg', width: 1, height: 1, bytes: 1 }
}

describe('Veo3Adapter', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('submits with lastFrame when end-frame ref provided', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: 'operations/op-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ done: true, response: { videos: [{ uri: 'https://x/out.mp4' }] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([0, 0, 0, 0x20]), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const start = makeRef(); const end = makeRef()
    const opts: GenerateOpts = { model: 'veo-3.1-generate-preview', mode: 'i2v', durationSec: 8, startFrame: start, endFrame: end }
    const a = new Veo3Adapter(() => 'gkey')
    await a.generate(shot, [], opts, () => {}, new AbortController().signal)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.instances[0]).toHaveProperty('image')
    expect(body.instances[0]).toHaveProperty('lastFrame')
  })

  it('omits image fields for t2v mode', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: 'operations/op-2' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ done: true, response: { videos: [{ uri: 'https://x/2.mp4' }] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([0]), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const opts: GenerateOpts = { model: 'veo-3.1-generate-preview', mode: 't2v', durationSec: 8 }
    const a = new Veo3Adapter(() => 'gkey')
    await a.generate(shot, [], opts, () => {}, new AbortController().signal)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.instances[0].image).toBeUndefined()
    expect(body.instances[0].lastFrame).toBeUndefined()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIImageAdapter } from './openai-image'
import type { Shot } from './types'

const shot: Shot = { slug: 's1', action: 'a', refs: [], styleBlocks: [], negBlocks: [], prompt: 'a cat on a pillow' }

describe('OpenAIImageAdapter', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('generates with the generations endpoint when no refs', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71])
    const b64 = btoa(String.fromCharCode(...bytes))
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const a = new OpenAIImageAdapter(() => 'sk-test')
    const r = await a.generate(shot, [], { model: 'gpt-image-2', quality: 'high' }, () => {})
    expect(fetchSpy.mock.calls[0][0]).toContain('/v1/images/generations')
    expect(r.bytes).toEqual(bytes)
  })

  it('uses the edits endpoint when refs present', async () => {
    const bytes = new Uint8Array([137])
    const b64 = btoa(String.fromCharCode(...bytes))
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const refBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const a = new OpenAIImageAdapter(() => 'sk-test')
    await a.generate(shot, [{ filename: 'r.png', blob: refBlob, mimeType: 'image/png', width: 1, height: 1, bytes: 3 }], { model: 'gpt-image-2', quality: 'high' }, () => {})
    expect(fetchSpy.mock.calls[0][0]).toContain('/v1/images/edits')
  })

  it('does not include response_format in the request body', async () => {
    const b64 = btoa(String.fromCharCode(137))
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const a = new OpenAIImageAdapter(() => 'sk-test')
    await a.generate(shot, [], { model: 'gpt-image-2' }, () => {})
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body).not.toHaveProperty('response_format')
  })

  it('sends quality: high by default', async () => {
    const b64 = btoa(String.fromCharCode(137))
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const a = new OpenAIImageAdapter(() => 'sk-test')
    await a.generate(shot, [], { model: 'gpt-image-2' }, () => {})
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.quality).toBe('high')
  })

  it('throws with provider context on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 401 })))
    const a = new OpenAIImageAdapter(() => 'sk-test')
    await expect(a.generate(shot, [], { model: 'gpt-image-2' }, () => {})).rejects.toThrow(/openai.*401/i)
  })
})

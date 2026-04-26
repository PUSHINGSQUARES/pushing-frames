import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GeminiImageAdapter } from './gemini-image'
import type { Shot } from './types'

const shot: Shot = { slug: 's1', action: 'a', refs: [], styleBlocks: [], negBlocks: [], prompt: 'a tree' }

describe('GeminiImageAdapter', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('calls generateContent endpoint', async () => {
    const bytes = new Uint8Array([137])
    const b64 = btoa(String.fromCharCode(...bytes))
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: b64 } }] } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const a = new GeminiImageAdapter(() => 'google-key')
    const r = await a.generate(shot, [], { model: 'gemini-2.5-flash-image' }, () => {})
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('generateContent')
    expect(url).toContain('key=google-key')
    expect(r.bytes).toEqual(bytes)
  })

  it('flash model body uses responseModalities only — no responseMimeType or imageConfig', async () => {
    const b64 = btoa(String.fromCharCode(137))
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: b64 } }] } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const a = new GeminiImageAdapter(() => 'key')
    await a.generate(shot, [], { model: 'gemini-2.5-flash-image' }, () => {})
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.generationConfig.responseModalities).toEqual(['IMAGE'])
    expect(body.generationConfig).not.toHaveProperty('responseMimeType')
    expect(body.generationConfig).not.toHaveProperty('imageConfig')
  })

  it('pro model body includes imageConfig.aspectRatio', async () => {
    const b64 = btoa(String.fromCharCode(137))
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: b64 } }] } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const a = new GeminiImageAdapter(() => 'key')
    const shotWithAspect = { ...shot, aspect: '16:9' }
    await a.generate(shotWithAspect, [], { model: 'gemini-3-pro-image-preview' }, () => {})
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.generationConfig.responseModalities).toEqual(['IMAGE'])
    expect(body.generationConfig.imageConfig.aspectRatio).toBe('16:9')
  })

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 400 })))
    const a = new GeminiImageAdapter(() => 'key')
    await expect(a.generate(shot, [], { model: 'gemini-2.5-flash-image' }, () => {})).rejects.toThrow(/gemini-image.*400/i)
  })
})

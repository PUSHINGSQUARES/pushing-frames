import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenRouterAdapter } from './openrouter'
import type { Shot } from './types'

const shot: Shot = { slug: 's1', action: 'a', refs: [], styleBlocks: [], negBlocks: [], prompt: 'a forest' }

function mockImageResponse(b64: string, mime = 'image/png') {
  return new Response(JSON.stringify({
    choices: [{
      message: {
        content: '',
        images: [{ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }],
      },
    }],
  }), { status: 200 })
}

describe('OpenRouterAdapter', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('hits /chat/completions, not /images/generations', async () => {
    const b64 = btoa(String.fromCharCode(137))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockImageResponse(b64)))
    const a = new OpenRouterAdapter(() => 'or-key')
    await a.generate(shot, [], { model: 'google/gemini-2.5-flash-image' }, () => {})
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('/chat/completions')
    expect(url).not.toContain('/images/generations')
  })

  it('sends chat-style messages with image modality and no top-level size', async () => {
    const b64 = btoa(String.fromCharCode(137))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockImageResponse(b64)))
    const a = new OpenRouterAdapter(() => 'or-key')
    await a.generate(shot, [], { model: 'google/gemini-2.5-flash-image' }, () => {})
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
    expect(body.messages[0].role).toBe('user')
    expect(body.messages[0].content).toContain('a forest')
    expect(body.modalities).toEqual(['image', 'text'])
    expect(body).not.toHaveProperty('prompt')
    // OpenRouter chat completions 400s on unknown top-level fields like `size`
    expect(body).not.toHaveProperty('size')
  })

  it('appends aspect ratio to the prompt as the only aspect signal', async () => {
    const b64 = btoa(String.fromCharCode(137))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockImageResponse(b64)))
    const a = new OpenRouterAdapter(() => 'or-key')
    const portraitShot = { ...shot, aspect: '9:16' }
    await a.generate(portraitShot, [], { model: 'google/gemini-2.5-flash-image' }, () => {})
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
    expect(body.messages[0].content).toContain('9:16')
  })

  it('extracts image bytes from data URL in assistant message', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const b64 = btoa(String.fromCharCode(...bytes))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockImageResponse(b64, 'image/jpeg')))
    const a = new OpenRouterAdapter(() => 'or-key')
    const result = await a.generate(shot, [], { model: 'google/gemini-2.5-flash-image' }, () => {})
    expect(Array.from(result.bytes)).toEqual([1, 2, 3, 4])
    expect(result.mimeType).toBe('image/jpeg')
  })

  it('throws a clear error when no image is returned', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'sorry no image' } }],
    }), { status: 200 })))
    const a = new OpenRouterAdapter(() => 'or-key')
    await expect(a.generate(shot, [], { model: 'google/gemini-2.5-flash-image' }, () => {}))
      .rejects.toThrow('did not contain an image')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImagenAdapter, resolutionToAspect } from './imagen'
import type { Shot } from './types'

const shot: Shot = { slug: 's1', action: 'a', refs: [], styleBlocks: [], negBlocks: [], prompt: 'a mountain range' }

describe('ImagenAdapter', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('calls :predict endpoint (not :generateContent or :generateImages)', async () => {
    const bytes = new Uint8Array([137, 80])
    const b64 = btoa(String.fromCharCode(...bytes))
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      predictions: [{ bytesBase64Encoded: b64, mimeType: 'image/png' }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const a = new ImagenAdapter(() => 'google-key')
    const r = await a.generate(shot, [], { model: 'imagen-4.0-generate-001' }, () => {})
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain(':predict')
    expect(url).not.toContain(':generateContent')
    expect(url).not.toContain(':generateImages')
    expect(url).toContain('imagen-4.0-generate-001')
    expect(url).toContain('key=google-key')
    expect(r.bytes).toEqual(bytes)
    expect(r.mimeType).toBe('image/png')
  })

  it('sends instances[].prompt and parameters.aspectRatio in body', async () => {
    const b64 = btoa(String.fromCharCode(1))
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      predictions: [{ bytesBase64Encoded: b64 }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const a = new ImagenAdapter(() => 'key')
    await a.generate(shot, [], { model: 'imagen-4.0-generate-001' }, () => {})
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body).toHaveProperty('instances')
    expect(body.instances[0].prompt).toBe(shot.prompt)
    expect(body).toHaveProperty('parameters')
    expect(body.parameters).toHaveProperty('aspectRatio')
    // body must NOT have a top-level prompt field
    expect(body).not.toHaveProperty('prompt')
  })

  it('passes explicit resolution as aspectRatio in parameters', async () => {
    const bytes = new Uint8Array([1])
    const b64 = btoa(String.fromCharCode(...bytes))
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      predictions: [{ bytesBase64Encoded: b64 }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const a = new ImagenAdapter(() => 'key')
    await a.generate(shot, [], { model: 'imagen-4.0-generate-001', resolution: '1536x1024' }, () => {})
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.parameters.aspectRatio).toBe('16:9')
  })

  it('falls back to shot aspect when no resolution given', async () => {
    const bytes = new Uint8Array([1])
    const b64 = btoa(String.fromCharCode(...bytes))
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      predictions: [{ bytesBase64Encoded: b64 }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const a = new ImagenAdapter(() => 'key')
    const shotWithAspect = { ...shot, aspect: '4:3' }
    await a.generate(shotWithAspect, [], { model: 'imagen-4.0-generate-001' }, () => {})
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.parameters.aspectRatio).toBe('4:3')
  })

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Forbidden', { status: 403 })))
    const a = new ImagenAdapter(() => 'key')
    await expect(a.generate(shot, [], { model: 'imagen-4.0-generate-001' }, () => {})).rejects.toThrow('imagen: HTTP 403')
  })

  it('throws when no predictions returned', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ predictions: [] }), { status: 200 })))
    const a = new ImagenAdapter(() => 'key')
    await expect(a.generate(shot, [], { model: 'imagen-4.0-generate-001' }, () => {})).rejects.toThrow('imagen: no image in response')
  })
})

describe('resolutionToAspect', () => {
  it('maps 1024x1024 to 1:1', () => expect(resolutionToAspect('1024x1024')).toBe('1:1'))
  it('maps 1536x1024 to 16:9', () => expect(resolutionToAspect('1536x1024')).toBe('16:9'))
  it('maps 1024x1536 to 9:16', () => expect(resolutionToAspect('1024x1536')).toBe('9:16'))
  it('maps 1365x1024 to 4:3', () => expect(resolutionToAspect('1365x1024')).toBe('4:3'))
  it('maps 1024x1365 to 3:4', () => expect(resolutionToAspect('1024x1365')).toBe('3:4'))
  it('falls back to shot aspect when resolution is auto', () => expect(resolutionToAspect('auto', '16:9')).toBe('16:9'))
  it('falls back to 1:1 when both absent', () => expect(resolutionToAspect(undefined, undefined)).toBe('1:1'))
})

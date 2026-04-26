import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateShotList } from './bulk_shotlist'

const baseInput = {
  summary: 'BMW M-series track day',
  selectedStyleBlocks: ['STYLE_KODAK_VISION'],
  selectedNegBlocks: ['NEG_HUMAN'],
  availableRefs: ['paddock.jpg'],
  refImages: [],
  count: 3,
  apiKey: 'fake-key',
}

function mockShotsResponse(shots: unknown[]) {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ shots }) }] } }],
  }), { status: 200 })
}

describe('generateShotList', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns parsed shots when Gemini returns valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockShotsResponse([
      { slug: 'shot_01', action: 'a wide shot' },
      { slug: 'shot_02', action: 'a close up', camera: 'ARRI Alexa 35', aspect: '16:9' },
    ])))
    const result = await generateShotList(baseInput)
    expect(result).toHaveLength(2)
    expect(result[0].slug).toBe('shot_01')
    expect(result[1].camera).toBe('ARRI Alexa 35')
  })

  it('drops shots that fail ShotSchema validation, keeps the rest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockShotsResponse([
      { slug: 'shot_01', action: 'valid shot' },
      { slug: 'shot_02' },                              // missing required action
      { action: 'no slug' },                            // missing required slug
      { slug: 'shot_04', action: 'another valid shot' },
    ])))
    const result = await generateShotList(baseInput)
    expect(result).toHaveLength(2)
    expect(result.map(s => s.slug)).toEqual(['shot_01', 'shot_04'])
  })

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('quota exceeded', { status: 429 })))
    await expect(generateShotList(baseInput)).rejects.toThrow('HTTP 429')
  })

  it('throws when response is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'not valid json {' }] } }],
    }), { status: 200 })))
    await expect(generateShotList(baseInput)).rejects.toThrow('not valid JSON')
  })

  it('throws when response is missing the shots array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ wrong: 'shape' }) }] } }],
    }), { status: 200 })))
    await expect(generateShotList(baseInput)).rejects.toThrow('did not contain a shots array')
  })

  it('sends responseMimeType + responseSchema in generationConfig', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockShotsResponse([
      { slug: 'shot_01', action: 'valid' },
    ])))
    await generateShotList(baseInput)
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema.type).toBe('object')
    expect(body.generationConfig.responseSchema.properties.shots).toBeDefined()
  })
})

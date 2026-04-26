import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./system_prompt.md?raw', () => ({ default: 'house style: cinematic' }))

import { scaffoldPrompt } from './scaffold'

describe('scaffoldPrompt', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns trimmed text from Gemini response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: '  a mechanic leans into an engine bay  ' }] } }] }),
      { status: 200 },
    )))
    const result = await scaffoldPrompt('mechanic in garage', [], 'google-key')
    expect(result).toBe('a mechanic leans into an engine bay')
  })

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Forbidden', { status: 403 })))
    await expect(scaffoldPrompt('idea', [], 'bad-key')).rejects.toThrow('assist: HTTP 403')
  })

  it('throws when no text part in response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ candidates: [{ content: { parts: [] } }] }),
      { status: 200 },
    )))
    await expect(scaffoldPrompt('idea', [], 'key')).rejects.toThrow('assist: no text returned')
  })
})

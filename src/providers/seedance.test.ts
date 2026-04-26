import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SeedanceAdapter } from './seedance'
import type { Shot, GenerateOpts } from './types'

const shot: Shot = { slug: 's1', action: 'a', refs: [], styleBlocks: [], negBlocks: [], prompt: 'a car' }
const opts: GenerateOpts = { model: 'seedance-1-5-pro-251215', mode: 't2v', durationSec: 5 }

describe('SeedanceAdapter', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('submits task, polls, fetches result', async () => {
    const videoBytes = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70])  // mp4 magic
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'task-123' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'running' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'succeeded', content: { video_url: 'https://example.com/out.mp4' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(videoBytes, { status: 200, headers: { 'content-type': 'video/mp4' } }))
    vi.stubGlobal('fetch', fetchSpy)

    const a = new SeedanceAdapter(() => 'sd-key')
    const r = await a.generate(shot, [], opts, () => {}, new AbortController().signal)
    expect(r.mimeType).toBe('video/mp4')
    expect(r.bytes.length).toBe(videoBytes.length)
    expect(fetchSpy.mock.calls[0][0]).toContain('/api/ark/contents/generations/tasks')
  })

  it('throws with provider context on submit HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 401 })))
    const a = new SeedanceAdapter(() => 'sd-key')
    await expect(a.generate(shot, [], opts, () => {}, new AbortController().signal)).rejects.toThrow(/seedance.*401/i)
  })
})

import { describe, it, expect, vi } from 'vitest'
import { pollUntilDone } from './video_poll'

describe('pollUntilDone', () => {
  it('returns the result on first done', async () => {
    const fetchStatus = vi.fn().mockResolvedValueOnce({ done: true, result: 'ok' })
    const out = await pollUntilDone(fetchStatus, () => {}, new AbortController().signal, { initialDelayMs: 1 })
    expect(out).toBe('ok')
    expect(fetchStatus).toHaveBeenCalledTimes(1)
  })

  it('polls until done with backoff', async () => {
    const fetchStatus = vi.fn()
      .mockResolvedValueOnce({ done: false, pct: 25 })
      .mockResolvedValueOnce({ done: false, pct: 60 })
      .mockResolvedValueOnce({ done: true, result: 'final' })
    const progress: number[] = []
    const out = await pollUntilDone(fetchStatus, p => p.pct !== undefined && progress.push(p.pct), new AbortController().signal, { initialDelayMs: 1, maxDelayMs: 5 })
    expect(out).toBe('final')
    expect(progress).toEqual([25, 60])
  })

  it('throws when aborted mid-poll', async () => {
    const ctrl = new AbortController()
    const fetchStatus = vi.fn().mockResolvedValue({ done: false })
    const pending = pollUntilDone(fetchStatus, () => {}, ctrl.signal, { initialDelayMs: 50 })
    ctrl.abort()
    await expect(pending).rejects.toThrow(/aborted/i)
  })

  it('throws on ceiling breach', async () => {
    const fetchStatus = vi.fn().mockResolvedValue({ done: false })
    await expect(pollUntilDone(fetchStatus, () => {}, new AbortController().signal, { initialDelayMs: 1, ceilingMs: 10 })).rejects.toThrow(/ceiling/i)
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GenerationQueue } from './queue'

describe('GenerationQueue', () => {
  let queue: GenerationQueue
  const runner = vi.fn()

  beforeEach(() => {
    runner.mockReset()
    runner.mockResolvedValue(undefined)
    queue = new GenerationQueue(runner, { getLimit: () => 2 })
  })

  it('runs up to the per-vendor limit concurrently', async () => {
    const gate = { resolve: () => {} }
    const blocker = new Promise<void>(r => { gate.resolve = r })
    runner.mockImplementation(() => blocker)

    queue.enqueue([
      { id: '1', shotSlug: 's1', vendor: 'v' },
      { id: '2', shotSlug: 's2', vendor: 'v' },
      { id: '3', shotSlug: 's3', vendor: 'v' },
    ])
    await new Promise(r => setTimeout(r, 10))
    expect(runner).toHaveBeenCalledTimes(2)   // only 2 running
    gate.resolve()
    await new Promise(r => setTimeout(r, 10))
    expect(runner).toHaveBeenCalledTimes(3)   // third drained after first two done
  })

  it('marks failed items without halting the queue', async () => {
    runner.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined)
    queue.enqueue([
      { id: '1', shotSlug: 's1', vendor: 'v' },
      { id: '2', shotSlug: 's2', vendor: 'v' },
    ])
    await new Promise(r => setTimeout(r, 20))
    const snap = queue.snapshot()
    expect(snap.find(i => i.id === '1')?.status).toBe('failed')
    expect(snap.find(i => i.id === '2')?.status).toBe('done')
  })

  it('subscriber receives item.error string on failure — toast wiring contract', async () => {
    runner.mockRejectedValueOnce(new Error('openai-image: HTTP 400 — Unknown parameter'))
    let notified = false
    queue.subscribe(() => { notified = true })
    queue.enqueue([{ id: '1', shotSlug: 's1', vendor: 'openai' }])
    await new Promise(r => setTimeout(r, 20))
    const snap = queue.snapshot()
    const item = snap.find(i => i.id === '1')
    expect(item?.status).toBe('failed')
    expect(item?.error).toContain('openai-image: HTTP 400')
    expect(notified).toBe(true)
  })

  it('cancels a queued item before it starts', async () => {
    queue = new GenerationQueue(runner, { getLimit: () => 1 })
    const blocker = new Promise<void>(() => {})
    runner.mockImplementation(() => blocker)
    queue.enqueue([
      { id: '1', shotSlug: 's1', vendor: 'v' },
      { id: '2', shotSlug: 's2', vendor: 'v' },
    ])
    queue.cancel('2')
    const snap = queue.snapshot()
    expect(snap.find(i => i.id === '2')?.status).toBe('failed')
  })
})

describe('GenerationQueue — 429 retry', () => {
  const runner = vi.fn()

  beforeEach(() => {
    runner.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries twice on 429 then succeeds — item ends done, retryAttempt is 2', async () => {
    runner
      .mockRejectedValueOnce(new Error('seedream: HTTP 429 — rate limit exceeded'))
      .mockRejectedValueOnce(new Error('seedream: HTTP 429 — rate limit exceeded'))
      .mockResolvedValueOnce(undefined)

    const queue = new GenerationQueue(runner, { getLimit: () => 2 })
    queue.enqueue([{ id: '1', shotSlug: 's1', vendor: 'v' }])

    await vi.runAllTimersAsync()

    const item = queue.snapshot().find(i => i.id === '1')
    expect(item?.status).toBe('done')
    expect(runner).toHaveBeenCalledTimes(3)
    expect(item?.retryAttempt).toBe(2)
  })

  it('exhausts 3 retries on persistent 429 — item ends failed with original error', async () => {
    runner.mockRejectedValue(new Error('HTTP 429 — Too Many Requests'))

    const queue = new GenerationQueue(runner, { getLimit: () => 2 })
    queue.enqueue([{ id: '1', shotSlug: 's1', vendor: 'v' }])

    await vi.runAllTimersAsync()

    const item = queue.snapshot().find(i => i.id === '1')
    expect(item?.status).toBe('failed')
    expect(item?.error).toContain('429')
    expect(runner).toHaveBeenCalledTimes(4) // initial + 3 retries
  })

  it('does not retry on non-429 errors', async () => {
    runner.mockRejectedValueOnce(new Error('openai-image: HTTP 400 — bad request'))

    const queue = new GenerationQueue(runner, { getLimit: () => 2 })
    queue.enqueue([{ id: '1', shotSlug: 's1', vendor: 'v' }])

    await vi.runAllTimersAsync()

    const item = queue.snapshot().find(i => i.id === '1')
    expect(item?.status).toBe('failed')
    expect(runner).toHaveBeenCalledTimes(1) // no retry
  })

  it('honours Retry-After header in error message over default backoff', async () => {
    runner
      .mockRejectedValueOnce(new Error('HTTP 429 — Retry-After: 1'))
      .mockResolvedValueOnce(undefined)

    const queue = new GenerationQueue(runner, { getLimit: () => 2 })
    queue.enqueue([{ id: '1', shotSlug: 's1', vendor: 'v' }])

    await vi.runAllTimersAsync()

    const item = queue.snapshot().find(i => i.id === '1')
    expect(item?.status).toBe('done')
    expect(runner).toHaveBeenCalledTimes(2)
  })
})

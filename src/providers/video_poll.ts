import type { Progress } from './types'

export interface PollConfig {
  initialDelayMs: number
  maxDelayMs: number
  ceilingMs: number
  backoffMultiplier: number
}

const DEFAULTS: PollConfig = {
  initialDelayMs: 2000,
  maxDelayMs: 10_000,
  ceilingMs: 20 * 60 * 1000,
  backoffMultiplier: 1.5,
}

export async function pollUntilDone<T>(
  fetchStatus: () => Promise<{ done: boolean; result?: T; pct?: number; message?: string }>,
  onProgress: (p: Progress) => void,
  abort: AbortSignal,
  config: Partial<PollConfig> = {},
): Promise<T> {
  const cfg = { ...DEFAULTS, ...config }
  const start = Date.now()
  let delay = cfg.initialDelayMs

  while (true) {
    if (abort.aborted) throw new Error('poll aborted')
    if (Date.now() - start > cfg.ceilingMs) throw new Error(`poll ceiling reached (${Math.round(cfg.ceilingMs / 60_000)} min)`)

    const status = await fetchStatus()
    onProgress({
      stage: status.done ? 'complete' : 'polling',
      pct: status.pct,
      message: status.message,
    })
    if (status.done && status.result !== undefined) return status.result

    await delayWithAbort(delay, abort)
    delay = Math.min(Math.round(delay * cfg.backoffMultiplier), cfg.maxDelayMs)
  }
}

function delayWithAbort(ms: number, abort: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    const listener = () => { clearTimeout(t); reject(new Error('poll aborted')) }
    abort.addEventListener('abort', listener, { once: true })
  })
}

import type { Progress } from '@/providers/types'

const RETRY_BACKOFF_MS = [2000, 4000, 8000]
const MAX_RETRIES = 3

function is429(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  return e.message.includes('429') || e.message.toLowerCase().includes('too many requests')
}

function retryAfterMs(e: unknown): number | null {
  if (!(e instanceof Error)) return null
  const m = e.message.match(/retry-after:\s*(\d+)/i)
  return m ? Number(m[1]) * 1000 : null
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

export interface QueueItem {
  id: string
  shotSlug: string
  vendor: string
  enqueuedAt?: number
  status?: 'queued' | 'running' | 'done' | 'failed'
  error?: string
  progress?: Progress
  abort?: AbortController
  retryAttempt?: number
}

export interface QueueDeps {
  getLimit: (vendor: string) => number
}

type Runner = (shotSlug: string, onProgress: (p: Progress) => void, abort: AbortSignal, itemId?: string) => Promise<void>

export class GenerationQueue {
  private items: QueueItem[] = []
  private running = new Map<string, number>()
  private listeners = new Set<() => void>()

  constructor(private runner: Runner, private deps: QueueDeps) {}

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private emit() { for (const l of this.listeners) l() }
  snapshot(): QueueItem[] { return this.items.map(i => ({ ...i })) }

  enqueue(items: Omit<QueueItem, 'status' | 'enqueuedAt'>[]): void {
    const now = Date.now()
    for (const i of items) this.items.push({ ...i, status: 'queued', enqueuedAt: now })
    this.emit()
    this.tick()
  }

  cancel(id: string): void {
    const item = this.items.find(i => i.id === id)
    if (!item) return
    if (item.status === 'running' && item.abort) item.abort.abort()
    if (item.status === 'queued') { item.status = 'failed'; item.error = 'cancelled' }
    this.emit()
  }

  cancelAll(): void {
    for (const i of this.items) if (i.status === 'queued' || i.status === 'running') this.cancel(i.id)
  }

  private tick(): void {
    for (const item of this.items) {
      if (item.status !== 'queued') continue
      const limit = this.deps.getLimit(item.vendor)
      const inFlight = this.running.get(item.vendor) ?? 0
      if (inFlight >= limit) continue
      this.startItem(item)
    }
  }

  private async startItem(item: QueueItem): Promise<void> {
    item.status = 'running'
    item.abort = new AbortController()
    this.running.set(item.vendor, (this.running.get(item.vendor) ?? 0) + 1)
    this.emit()

    let lastError: unknown
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        item.retryAttempt = attempt
        this.emit()
        const waitMs = retryAfterMs(lastError) ?? RETRY_BACKOFF_MS[attempt - 1]
        await sleep(waitMs)
      }
      try {
        await this.runner(item.shotSlug, p => { item.progress = p; this.emit() }, item.abort.signal, item.id)
        item.status = 'done'
        this.running.set(item.vendor, (this.running.get(item.vendor) ?? 0) - 1)
        this.emit()
        this.tick()
        return
      } catch (e) {
        lastError = e
        if (!is429(e) || attempt >= MAX_RETRIES) break
      }
    }

    item.status = 'failed'
    item.error = lastError instanceof Error ? lastError.message : String(lastError)
    this.running.set(item.vendor, (this.running.get(item.vendor) ?? 0) - 1)
    this.emit()
    this.tick()
  }
}

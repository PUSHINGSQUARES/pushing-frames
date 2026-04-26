import { useEffect, useState } from 'react'
import { generationQueue } from '@/actions/queue_instance'
import type { QueueItem } from '@/actions/queue'

export function QueueDrawer() {
  const [items, setItems] = useState<QueueItem[]>(generationQueue.snapshot())
  useEffect(() => generationQueue.subscribe(() => setItems(generationQueue.snapshot())), [])

  const active = items.filter(i => i.status === 'running' || i.status === 'queued')
  if (active.length === 0) return null
  const running = items.filter(i => i.status === 'running').length
  const queued = items.filter(i => i.status === 'queued').length

  const retrying = items.filter(i => i.status === 'running' && (i.retryAttempt ?? 0) > 0)

  return (
    <div className="glass glass-card px-3 py-2 text-xs flex items-center gap-3 mb-2">
      <span className="font-mono text-smoke">
        queue &middot; {running} running &middot; {queued} queued
        {retrying.length > 0 && (
          <span className="ml-2 text-smoke/70">
            ({retrying.map(i => `retry ${i.retryAttempt}/3`).join(', ')})
          </span>
        )}
      </span>
      <button onClick={() => generationQueue.cancelAll()} className="text-smoke underline">cancel all</button>
    </div>
  )
}

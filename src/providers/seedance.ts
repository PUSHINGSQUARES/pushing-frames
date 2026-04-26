import type { ProviderAdapter, Shot, NormalisedRef, Progress, GenResult, GenerateOpts, Capabilities } from './types'
import caps from './capabilities.json'
import pricing from './pricing.json'
import { listModels } from './models'
import { pollUntilDone } from './video_poll'
import { corsProxy } from './cors_proxy'

const SUBMIT = '/api/ark/contents/generations/tasks'
const STATUS_BASE = '/api/ark/contents/generations/tasks'

export class SeedanceAdapter implements ProviderAdapter {
  id = 'seedance' as const
  capabilities = caps.seedance as unknown as Capabilities
  constructor(private getKey: () => string) {}

  listModels() { return listModels('seedance') }

  estimate(_shot: Shot, opts: GenerateOpts) {
    const dur = opts.durationSec ?? 5
    return { costGBP: pricing.seedance.perSecondVideo * dur }
  }

  async generate(shot: Shot, refs: NormalisedRef[], opts: GenerateOpts, onProgress: (p: Progress) => void, abort?: AbortSignal): Promise<GenResult> {
    const signal = abort ?? new AbortController().signal
    const t0 = performance.now()
    onProgress({ stage: 'queued' })

    const content: unknown[] = [{ type: 'text', text: shot.prompt }]
    if (opts.mode !== 't2v' && refs.length > 0) {
      const dataUrl = await blobToDataUrl(refs[0])
      content.push({ type: 'image_url', image_url: { url: dataUrl } })
    }

    // dreamina-* models may use a different API shape than legacy seedance-1-* models.
    // Both currently target the same /contents/generations/tasks endpoint.
    // If live API shape differs, branch on opts.model.startsWith('dreamina-') here.
    const submitRes = await fetch(SUBMIT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        content,
        duration: opts.durationSec ?? 5,
        watermark: false,
        camera_fixed: false,
      }),
      signal,
    })
    if (!submitRes.ok) throw new Error(`seedance: HTTP ${submitRes.status} — ${await submitRes.text().catch(() => '')}`)
    const { id: taskId } = await submitRes.json() as { id: string }

    onProgress({ stage: 'running' })
    const videoUrl = await pollUntilDone(async () => {
      const r = await fetch(`${STATUS_BASE}/${taskId}`, {
        headers: { Authorization: `Bearer ${this.getKey()}` },
        signal,
      })
      if (!r.ok) throw new Error(`seedance status: HTTP ${r.status}`)
      const s = await r.json() as { status: string; content?: { video_url: string } }
      if (s.status === 'succeeded' && s.content?.video_url) return { done: true, result: s.content.video_url }
      if (s.status === 'failed') throw new Error('seedance: task failed')
      return { done: false, message: s.status }
    }, onProgress, signal)

    const videoRes = await fetch(corsProxy(videoUrl), { signal })
    if (!videoRes.ok) throw new Error(`seedance: video download HTTP ${videoRes.status}`)
    const bytes = new Uint8Array(await videoRes.arrayBuffer())
    const cost = this.estimate(shot, opts).costGBP
    onProgress({ stage: 'complete' })
    return { bytes, mimeType: 'video/mp4', costGBP: cost, durationMs: performance.now() - t0, providerMeta: { model: opts.model, taskId } }
  }
}

async function blobToDataUrl(ref: NormalisedRef): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(ref.blob)
  })
}

import type { ProviderAdapter, Shot, NormalisedRef, Progress, GenResult, GenerateOpts, Capabilities } from './types'
import caps from './capabilities.json'
import pricing from './pricing.json'
import { listModels } from './models'
import { pollUntilDone } from './video_poll'
import { KlingJwtCache } from './kling_auth'
import { readVendorKey } from '@/vault/vendor_keys'

// In dev the Vite proxy forwards POST + headers + body to api.klingai.com
// because Kling doesn't return CORS headers for direct browser requests.
// In production builds (Tauri / hosted) hit the API directly.
const BASE = import.meta.env.DEV ? '/api/kling/v1' : 'https://api.klingai.com/v1'

export class KlingAdapter implements ProviderAdapter {
  id = 'kling' as const
  capabilities = caps.kling as unknown as Capabilities
  private jwtCache = new KlingJwtCache()

  listModels() { return listModels('kling') }

  estimate(_shot: Shot, opts: GenerateOpts) {
    const rates = (pricing.kling.perSecondByTier) as Record<string, number>
    const tier = /master/.test(opts.model) ? 'v2-master' : /v1-5/.test(opts.model) ? 'v1-5-std' : 'v2-std'
    const rate = rates[tier] ?? 0.06
    return { costGBP: rate * (opts.durationSec ?? 5) }
  }

  private async getToken(): Promise<string> {
    const blob = await readVendorKey('kling')
    if (!blob || !('accessKey' in blob)) throw new Error('kling: no access+secret key in Settings')
    return this.jwtCache.get(blob.accessKey, blob.secretKey)
  }

  async generate(shot: Shot, _refs: NormalisedRef[], opts: GenerateOpts, onProgress: (p: Progress) => void, abort?: AbortSignal): Promise<GenResult> {
    const signal = abort ?? new AbortController().signal
    const t0 = performance.now()
    onProgress({ stage: 'queued' })

    const token = await this.getToken()
    const mode = opts.mode ?? 'i2v'
    const endpoint = mode === 'i2v' ? `${BASE}/videos/image2video` : `${BASE}/videos/text2video`

    // Kling caps prompt + negative_prompt at 2500 chars each. Our composed
    // prompt regularly exceeds that with the no-text lead + action body +
    // style block bodies + aspect cue + negative section. Split at the
    // "Negative prompt:" boundary so positive and negative travel in their
    // own fields, then truncate each to fit Kling's limit.
    const KLING_PROMPT_LIMIT = 2500
    const NEG_MARKER = '\n\nNegative prompt:'
    const fullPrompt = shot.prompt
    const negIdx = fullPrompt.indexOf(NEG_MARKER)
    const positivePrompt = (negIdx >= 0 ? fullPrompt.slice(0, negIdx) : fullPrompt).slice(0, KLING_PROMPT_LIMIT)
    const negativePrompt = negIdx >= 0
      ? fullPrompt.slice(negIdx + NEG_MARKER.length).trim().slice(0, KLING_PROMPT_LIMIT)
      : ''

    const body: Record<string, unknown> = {
      model_name: opts.model,
      prompt: positivePrompt,
      duration: String(opts.durationSec ?? 5),
      aspect_ratio: shot.aspect ?? '16:9',
      cfg_scale: opts.motion ?? 0.5,
      mode: /master/.test(opts.model) ? 'pro' : 'std',
    }
    if (negativePrompt) body.negative_prompt = negativePrompt
    // Kling expects raw base64, not a data URL. blobToDataUrl returns
    // "data:image/png;base64,xxx" so strip the prefix before sending.
    if (mode === 'i2v' && opts.startFrame) {
      body.image = stripDataUrlPrefix(await blobToDataUrl(opts.startFrame))
    }
    if (mode === 'i2v' && opts.endFrame) {
      body.image_tail = stripDataUrlPrefix(await blobToDataUrl(opts.endFrame))
    }

    const submitRes = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (!submitRes.ok) throw new Error(`kling: HTTP ${submitRes.status} — ${await submitRes.text().catch(() => '')}`)
    const { data } = await submitRes.json() as { data: { task_id: string } }
    const taskId = data.task_id

    onProgress({ stage: 'running' })
    const videoUrl = await pollUntilDone(async () => {
      const r = await fetch(`${endpoint}/${taskId}`, {
        headers: { Authorization: `Bearer ${await this.getToken()}` },
        signal,
      })
      if (!r.ok) throw new Error(`kling status: HTTP ${r.status}`)
      const s = await r.json() as { data: { task_status: string; videos?: { url: string }[] } }
      if (s.data.task_status === 'succeed' && s.data.videos?.[0]?.url) return { done: true, result: s.data.videos[0].url }
      if (s.data.task_status === 'failed') throw new Error('kling: task failed')
      return { done: false, message: s.data.task_status }
    }, onProgress, signal, { initialDelayMs: 5000, maxDelayMs: 15_000 })

    const videoRes = await fetch(videoUrl, { signal })
    if (!videoRes.ok) throw new Error(`kling: video download HTTP ${videoRes.status}`)
    const bytes = new Uint8Array(await videoRes.arrayBuffer())
    onProgress({ stage: 'complete' })
    const cost = this.estimate(shot, opts).costGBP
    return { bytes, mimeType: 'video/mp4', costGBP: cost, durationMs: performance.now() - t0, providerMeta: { model: opts.model, taskId } }
  }
}

function stripDataUrlPrefix(dataUrl: string): string {
  // Strip "data:<mime>;base64," and return raw base64. Kling's API rejects
  // the data URL form with "File is not in a valid base64 format".
  const i = dataUrl.indexOf('base64,')
  return i >= 0 ? dataUrl.slice(i + 'base64,'.length) : dataUrl
}

async function blobToDataUrl(ref: NormalisedRef): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(ref.blob)
  })
}

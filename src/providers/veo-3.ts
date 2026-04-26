import type { ProviderAdapter, Shot, NormalisedRef, Progress, GenResult, GenerateOpts, Capabilities } from './types'
import caps from './capabilities.json'
import pricing from './pricing.json'
import { listModels } from './models'
import { pollUntilDone } from './video_poll'
import { corsProxy } from './cors_proxy'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

export class Veo3Adapter implements ProviderAdapter {
  id = 'veo-3' as const
  capabilities = caps['veo-3'] as unknown as Capabilities
  constructor(private getKey: () => string) {}

  listModels() { return listModels('veo-3') }

  estimate(_shot: Shot, _opts: GenerateOpts) {
    return { costGBP: pricing['veo-3'].perClipVideo }
  }

  async generate(shot: Shot, _refs: NormalisedRef[], opts: GenerateOpts, onProgress: (p: Progress) => void, abort?: AbortSignal): Promise<GenResult> {
    const signal = abort ?? new AbortController().signal
    const t0 = performance.now()
    onProgress({ stage: 'queued' })

    const instance: Record<string, unknown> = { prompt: shot.prompt }
    if (opts.mode === 'i2v' && opts.startFrame) {
      instance.image = { bytesBase64Encoded: await blobToB64(opts.startFrame.blob), mimeType: opts.startFrame.mimeType }
    }
    if (opts.mode === 'i2v' && opts.endFrame) {
      instance.lastFrame = { bytesBase64Encoded: await blobToB64(opts.endFrame.blob), mimeType: opts.endFrame.mimeType }
    }

    // Veo only supports 16:9 (landscape) and 9:16 (vertical). Cinematic
    // ratios (21:9, 2.39:1) and others (1:1, 4:3) get coerced to the
    // closest supported ratio so packs don't break video gen.
    const VEO_RATIOS = new Set(['16:9', '9:16'])
    const requested = shot.aspect ?? '16:9'
    const aspectRatio = VEO_RATIOS.has(requested)
      ? requested
      : (requested === '9:16' || requested.startsWith('9:')) ? '9:16' : '16:9'

    // generateAudio is only supported on certain Veo models. Even the audio-
    // capable ones reject the field when set to false, and the rest reject
    // it outright. So: only attach when the user explicitly opted in AND
    // the selected model is on the audio allowlist. Otherwise drop silently.
    const AUDIO_CAPABLE_MODELS = new Set([
      'veo-3.1-generate-preview',
      'veo-3.0-generate-001',
    ])
    const parameters: Record<string, unknown> = {
      durationSeconds: opts.durationSec ?? 8,
      aspectRatio,
      resolution: '720p',
    }
    if (opts.audio === true && AUDIO_CAPABLE_MODELS.has(opts.model)) {
      parameters.generateAudio = true
    }

    const key = this.getKey()
    const submitRes = await fetch(`${BASE}/models/${opts.model}:predictLongRunning?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [instance],
        parameters,
      }),
      signal,
    })
    if (!submitRes.ok) throw new Error(`veo-3: HTTP ${submitRes.status} — ${await submitRes.text().catch(() => '')}`)
    const { name: opName } = await submitRes.json() as { name: string }

    onProgress({ stage: 'running' })
    // Note: Veo 3 operation polling can lag 30–60s before done flag flips; poll engine handles up to 20 min.
    const videoUri = await pollUntilDone(async () => {
      const r = await fetch(`${BASE}/${opName}?key=${encodeURIComponent(key)}`, { signal })
      if (!r.ok) throw new Error(`veo-3 status: HTTP ${r.status}`)
      const s = await r.json() as { done?: boolean; response?: { videos: { uri: string }[] }; error?: { message: string } }
      if (s.error) throw new Error(`veo-3: ${s.error.message}`)
      if (s.done && s.response?.videos?.[0]?.uri) return { done: true, result: s.response.videos[0].uri }
      return { done: false }
    }, onProgress, signal, { initialDelayMs: 3000, maxDelayMs: 15_000 })

    const videoRes = await fetch(corsProxy(videoUri), {
      headers: { Authorization: `Bearer ${key}` },
      signal,
    })
    if (!videoRes.ok) throw new Error(`veo-3: video download HTTP ${videoRes.status}`)
    const bytes = new Uint8Array(await videoRes.arrayBuffer())
    onProgress({ stage: 'complete' })
    return { bytes, mimeType: 'video/mp4', costGBP: pricing['veo-3'].perClipVideo, durationMs: performance.now() - t0, providerMeta: { model: opts.model, operation: opName } }
  }
}

async function blobToB64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  let bin = ''
  const view = new Uint8Array(buf)
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i])
  return btoa(bin)
}

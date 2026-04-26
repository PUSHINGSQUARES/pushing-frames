import type { ProviderAdapter, Shot, NormalisedRef, Progress, GenResult, GenerateOpts } from './types'
import caps from './capabilities.json'
import pricing from './pricing.json'
import { listModels } from './models'

const GEN_URL = 'https://api.openai.com/v1/images/generations'
const EDITS_URL = 'https://api.openai.com/v1/images/edits'

export class OpenAIImageAdapter implements ProviderAdapter {
  id = 'openai-image' as const
  capabilities = caps['openai-image']
  constructor(private getKey: () => string) {}

  listModels() { return listModels('openai-image') }

  estimate(_shot: Shot, opts: GenerateOpts) {
    // per-tier pricing: low≈£0.02, medium≈£0.04, high≈£0.10, auto≈£0.07 (OpenAI published rates)
    const tiers = pricing['openai-image']
    const q = opts.quality ?? 'high'
    const cost = q === 'low' ? tiers.low : q === 'medium' ? tiers.medium : q === 'auto' ? tiers.auto : tiers.high
    return { costGBP: cost }
  }

  async generate(shot: Shot, refs: NormalisedRef[], opts: GenerateOpts, onProgress: (p: Progress) => void, abort?: AbortSignal): Promise<GenResult> {
    onProgress({ stage: 'running' })
    const t0 = performance.now()
    const quality = opts.quality ?? 'high'
    const size = (opts.resolution && opts.resolution !== 'auto') ? opts.resolution : aspectToSize(shot.aspect)

    let res: Response
    if (refs.length > 0) {
      const form = new FormData()
      form.append('model', opts.model)
      form.append('prompt', shot.prompt)
      form.append('size', size)
      form.append('quality', quality)
      refs.forEach((r, i) => form.append(i === 0 ? 'image' : `image[${i}]`, r.blob, r.filename))
      res = await fetch(EDITS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.getKey()}` },
        body: form,
        signal: abort,
      })
    } else {
      res = await fetch(GEN_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.getKey()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: opts.model, prompt: shot.prompt, size, quality }),
        signal: abort,
      })
    }
    if (!res.ok) throw new Error(`openai-image: HTTP ${res.status} — ${await res.text().catch(() => '')}`)
    const json = await res.json() as { data: { b64_json: string }[] }
    const bytes = Uint8Array.from(atob(json.data[0].b64_json), c => c.charCodeAt(0))
    onProgress({ stage: 'complete' })
    const cost = this.estimate(shot, opts).costGBP
    return { bytes, mimeType: 'image/png', costGBP: cost, durationMs: performance.now() - t0, providerMeta: { model: opts.model, quality } }
  }
}

function aspectToSize(aspect?: string): string {
  const map: Record<string, string> = { '1:1': '1024x1024', '9:16': '1024x1536', '16:9': '1536x1024' }
  return map[aspect ?? '1:1'] ?? '1024x1024'
}

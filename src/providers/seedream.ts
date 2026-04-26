import type { ProviderAdapter, Shot, NormalisedRef, Progress, GenResult, GenerateOpts } from './types'
import caps from './capabilities.json'
import pricing from './pricing.json'
import { listModels, getDefaultModel } from './models'

// Relative path hits the Vite dev proxy (/api/ark -> ark.ap-southeast.bytepluses.com/api/v3).
// Production will hit the Cloudflare Worker fallback (v0.2 Phase 17). Keys never leave local origin.
const ARK = '/api/ark/images/generations'

export class SeedreamAdapter implements ProviderAdapter {
  id = 'seedream' as const
  capabilities = caps.seedream
  constructor(private getKey: () => string) {}

  listModels() { return listModels('seedream') }

  estimate(_shot: Shot, _opts: GenerateOpts) {
    return { costGBP: pricing.seedream.perImage }
  }

  async generate(shot: Shot, refs: NormalisedRef[], opts: GenerateOpts, onProgress: (p: Progress) => void, abort?: AbortSignal): Promise<GenResult> {
    onProgress({ stage: 'running' })
    const t0 = performance.now()
    const model = opts.model ?? getDefaultModel('seedream').id
    const body: Record<string, unknown> = {
      model,
      prompt: shot.prompt,
      size: (opts.resolution && opts.resolution !== 'auto') ? opts.resolution : aspectToSize(shot.aspect),
      response_format: 'b64_json',
      watermark: false,
    }
    if (opts.seed !== undefined) body.seed = opts.seed
    if (refs.length > 0) body.image = await Promise.all(refs.map(blobToDataUrl))

    const res = await fetch(ARK, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: abort,
    })
    if (!res.ok) throw new Error(`seedream: HTTP ${res.status} — ${await res.text().catch(() => '')}`)
    const json = await res.json() as { data: { b64_json: string }[] }
    const bytes = Uint8Array.from(atob(json.data[0].b64_json), c => c.charCodeAt(0))
    onProgress({ stage: 'complete' })
    return { bytes, mimeType: 'image/png', costGBP: pricing.seedream.perImage, durationMs: performance.now() - t0, providerMeta: { model } }
  }
}

function aspectToSize(aspect?: string): string {
  // Seedream 4.5 requires >= 3,686,400 px. Use aspect-matched 2K-class sizes.
  const map: Record<string, string> = {
    '1:1':  '2048x2048',  // 4.19M
    '16:9': '2560x1440',  // 3.69M (exact min)
    '9:16': '1440x2560',  // 3.69M
    '4:3':  '2304x1728',  // 3.98M
    '21:9': '3136x1344',  // 4.21M
  }
  return map[aspect ?? '16:9'] ?? '2560x1440'
}

async function blobToDataUrl(ref: NormalisedRef): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(ref.blob)
  })
}

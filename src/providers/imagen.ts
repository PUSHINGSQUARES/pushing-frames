import type { ProviderAdapter, Shot, NormalisedRef, Progress, GenResult, GenerateOpts } from './types'
import caps from './capabilities.json'
import pricing from './pricing.json'
import { listModels } from './models'

// Imagen 4 uses the :predict endpoint — separate from gemini-image's :generateContent path.
// Request: { instances: [{ prompt }], parameters: { sampleCount, aspectRatio } }
// Response: { predictions: [{ bytesBase64Encoded, mimeType }] }
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export class ImagenAdapter implements ProviderAdapter {
  id = 'imagen' as const
  capabilities = caps['imagen']
  constructor(private getKey: () => string) {}

  listModels() { return listModels('imagen') }
  estimate(_shot: Shot, _opts: GenerateOpts) { return { costGBP: pricing['imagen'].perImage } }

  async generate(shot: Shot, _refs: NormalisedRef[], opts: GenerateOpts, onProgress: (p: Progress) => void, abort?: AbortSignal): Promise<GenResult> {
    onProgress({ stage: 'running' })
    const t0 = performance.now()
    const aspectRatio = resolutionToAspect(opts.resolution, shot.aspect)
    const url = `${BASE}/${opts.model}:predict?key=${encodeURIComponent(this.getKey())}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: shot.prompt }],
        parameters: { sampleCount: 1, aspectRatio },
      }),
      signal: abort,
    })
    if (!res.ok) throw new Error(`imagen: HTTP ${res.status} — ${await res.text().catch(() => '')}`)
    const json = await res.json() as { predictions: { bytesBase64Encoded: string; mimeType?: string }[] }
    const pred = json.predictions?.[0]
    if (!pred?.bytesBase64Encoded) throw new Error('imagen: no image in response')
    const bytes = Uint8Array.from(atob(pred.bytesBase64Encoded), c => c.charCodeAt(0))
    const mimeType = pred.mimeType ?? 'image/png'
    onProgress({ stage: 'complete' })
    return { bytes, mimeType, costGBP: pricing['imagen'].perImage, durationMs: performance.now() - t0, providerMeta: { model: opts.model } }
  }
}

// Map explicit pixel resolution to an Imagen aspectRatio string.
// Falls back to the shot aspect, then '1:1'.
const RESOLUTION_TO_ASPECT: Record<string, string> = {
  '1024x1024': '1:1',
  '1536x1024': '16:9',
  '1024x1536': '9:16',
  '1365x1024': '4:3',
  '1024x1365': '3:4',
}

export function resolutionToAspect(resolution?: string, fallbackAspect?: string): string {
  if (resolution && resolution !== 'auto') {
    const mapped = RESOLUTION_TO_ASPECT[resolution]
    if (mapped) return mapped
  }
  // Shot aspect is already in N:M format — pass through directly if valid.
  if (fallbackAspect && /^\d+:\d+$/.test(fallbackAspect)) return fallbackAspect
  return '1:1'
}

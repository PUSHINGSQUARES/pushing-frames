import type { ProviderAdapter, Shot, NormalisedRef, Progress, GenResult, GenerateOpts } from './types'
import caps from './capabilities.json'
import pricing from './pricing.json'
import { listModels } from './models'

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// These preview models support aspectRatio inside imageConfig; the flash model does not.
const ASPECT_AWARE_MODELS = ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview']

export class GeminiImageAdapter implements ProviderAdapter {
  id = 'gemini-image' as const
  capabilities = caps['gemini-image']
  constructor(private getKey: () => string) {}

  listModels() { return listModels('gemini-image') }
  estimate(_shot: Shot, _opts: GenerateOpts) { return { costGBP: pricing['gemini-image'].perImage } }

  async generate(shot: Shot, refs: NormalisedRef[], opts: GenerateOpts, onProgress: (p: Progress) => void, abort?: AbortSignal): Promise<GenResult> {
    onProgress({ stage: 'running' })
    const t0 = performance.now()
    const parts: unknown[] = [{ text: shot.prompt }]
    for (const r of refs) {
      const b64 = await blobToB64(r.blob)
      parts.push({ inline_data: { mime_type: r.mimeType, data: b64 } })
    }
    const url = `${BASE}/${opts.model}:generateContent?key=${encodeURIComponent(this.getKey())}`
    const generationConfig = ASPECT_AWARE_MODELS.includes(opts.model)
      ? { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: shot.aspect ?? '1:1' } }
      : { responseModalities: ['IMAGE'] }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig,
      }),
      signal: abort,
    })
    if (!res.ok) throw new Error(`gemini-image: HTTP ${res.status} — ${await res.text().catch(() => '')}`)
    const json = await res.json() as { candidates: { content: { parts: { inlineData?: { data: string } }[] } }[] }
    const b64 = json.candidates[0].content.parts.find(p => p.inlineData)?.inlineData?.data
    if (!b64) throw new Error('gemini-image: no image returned')
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    onProgress({ stage: 'complete' })
    return { bytes, mimeType: 'image/png', costGBP: pricing['gemini-image'].perImage, durationMs: performance.now() - t0, providerMeta: { model: opts.model } }
  }
}

async function blobToB64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  let bin = ''
  const view = new Uint8Array(buf)
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i])
  return btoa(bin)
}

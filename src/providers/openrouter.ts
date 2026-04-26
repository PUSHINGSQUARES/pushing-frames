import type { ProviderAdapter, Shot, NormalisedRef, Progress, GenResult, GenerateOpts } from './types'
import caps from './capabilities.json'
import pricing from './pricing.json'
import { listModels } from './models'

// OpenRouter has no dedicated /images/generations endpoint. Image-output
// models (e.g. google/gemini-2.5-flash-image) return the image as a data
// URL inside the assistant message of a chat completion response.
const BASE = 'https://openrouter.ai/api/v1/chat/completions'

interface OpenRouterImageResponse {
  choices: {
    message: {
      content?: string
      images?: { type?: string; image_url?: { url?: string } }[]
    }
  }[]
}

export class OpenRouterAdapter implements ProviderAdapter {
  id = 'openrouter' as const
  capabilities = caps.openrouter
  constructor(private getKey: () => string) {}

  listModels() { return listModels('openrouter') }

  estimate(_shot: Shot, _opts: GenerateOpts) {
    return { costGBP: pricing.openrouter.perImage }
  }

  async generate(shot: Shot, _refs: NormalisedRef[], opts: GenerateOpts, onProgress: (p: Progress) => void, abort?: AbortSignal): Promise<GenResult> {
    onProgress({ stage: 'running' })
    const t0 = performance.now()
    // OpenRouter chat completions rejects unknown top-level params (incl.
    // `size`) with 400. Aspect is conveyed via the prompt — both Gemini
    // Nano Banana and OpenAI image models honour an inline ratio hint.
    const aspectHint = shot.aspect ? ` (aspect ratio ${shot.aspect})` : ''
    const res = await fetch(BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getKey()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pushing-frames.local',
        'X-Title': 'PUSHING FRAMES_',
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [{ role: 'user', content: shot.prompt + aspectHint }],
        modalities: ['image', 'text'],
      }),
      signal: abort,
    })
    if (!res.ok) throw new Error(`openrouter: HTTP ${res.status} — ${await res.text().catch(() => '')}`)
    const json = await res.json() as OpenRouterImageResponse
    const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url
    if (!dataUrl) throw new Error('openrouter: response did not contain an image — check the model supports image output')

    // Data URL shape: data:image/png;base64,<base64>
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) throw new Error('openrouter: image was not a base64 data URL')
    const mimeType = match[1]
    const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0))

    onProgress({ stage: 'complete' })
    return { bytes, mimeType, costGBP: pricing.openrouter.perImage, durationMs: performance.now() - t0, providerMeta: { model: opts.model } }
  }
}

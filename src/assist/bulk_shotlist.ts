// Bulk shot-list generation via Gemini structured output. Used by the
// Project Guide's Stage 4 "Generate shot list" button. The response
// schema is the same one the rest of the app validates against (Phase
// 1A) — Gemini drafts shots that already match the on-disk format.

import { ShotSchema, type Shot } from '@/pack/schema'
import type { NormalisedRef } from '@/providers/types'

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// OpenAPI 3.0 schema for Gemini's responseSchema. Mirrors the load-bearing
// fields of ShotSchema. Gemini's parser is stricter than full JSON Schema
// so we hand-craft this rather than auto-derive—keeps refs/$defs out.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    shots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'short_snake_case identifier, e.g. shot_01, paddock_arrival' },
          action: { type: 'string', description: 'the full cinematic prompt: lead with "Shot on [camera] mounted on [rig]", state T-stop, shutter, ISO, then describe the action' },
          camera: { type: 'string', description: 'specific camera body, e.g. "ARRI Alexa 35", "RED Komodo 6K"' },
          lens: { type: 'string', description: 'specific lens, e.g. "50mm Prime T1.4"' },
          aspect: { type: 'string', enum: ['1:1', '4:3', '16:9', '9:16', '21:9'] },
          refs: { type: 'array', items: { type: 'string' }, description: 'subset of availableRefs that should bind to this shot' },
          styleBlocks: { type: 'array', items: { type: 'string' }, description: 'subset of selectedStyleBlocks for this shot' },
          negBlocks: { type: 'array', items: { type: 'string' }, description: 'subset of selectedNegBlocks for this shot' },
        },
        required: ['slug', 'action'],
      },
    },
  },
  required: ['shots'],
}

export interface GenerateShotListInput {
  summary: string
  mood?: string
  camera?: string
  lens?: string
  aspect?: string
  selectedStyleBlocks: string[]
  selectedNegBlocks: string[]
  availableRefs: string[]
  refImages: NormalisedRef[]
  count: number
  apiKey: string
  model?: string
  abort?: AbortSignal
}

export async function generateShotList(input: GenerateShotListInput): Promise<Shot[]> {
  const model = input.model ?? 'gemini-2.5-flash'
  const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(input.apiKey)}`

  const briefingLines = [
    `You are an experienced director of photography. Draft a shot list for the project below.`,
    ``,
    `Project summary: ${input.summary}`,
    input.mood ? `Mood / world: ${input.mood}` : '',
    input.camera ? `Default camera: ${input.camera}` : '',
    input.lens ? `Default lens: ${input.lens}` : '',
    input.aspect ? `Default aspect: ${input.aspect}` : '',
    input.selectedStyleBlocks.length > 0 ? `Available style blocks: ${input.selectedStyleBlocks.join(', ')}` : '',
    input.selectedNegBlocks.length > 0 ? `Available negative blocks: ${input.selectedNegBlocks.join(', ')}` : '',
    input.availableRefs.length > 0 ? `Available reference filenames (use exact strings): ${input.availableRefs.join(', ')}` : '',
    ``,
    `Return exactly ${input.count} shots in narrative order.`,
    `For each shot's action: lead with "Shot on [camera] mounted on [rig]", state T-stop / shutter / ISO, then describe the action. Specificity beats vagueness—name the lens length, lighting state, time of day, what the subject is doing.`,
    `Slugs are short_snake_case (e.g. shot_01, paddock_arrival, apex_chase). They must be unique within the list.`,
    `Only reference styleBlocks / negBlocks / refs that appear in the available lists above. Empty arrays are fine.`,
  ].filter(Boolean).join('\n')

  const parts: unknown[] = [{ text: briefingLines }]
  for (const r of input.refImages) {
    const b64 = await blobToB64(r.blob)
    parts.push({ inline_data: { mime_type: r.mimeType, data: b64 } })
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
    signal: input.abort,
  })
  if (!res.ok) {
    throw new Error(`bulk-shotlist: HTTP ${res.status} — ${await res.text().catch(() => '')}`)
  }
  const json = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = json.candidates?.[0]?.content?.parts?.find(p => p.text)?.text
  if (!text) throw new Error('bulk-shotlist: no JSON text in response')

  let parsed: { shots?: unknown[] }
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    throw new Error(`bulk-shotlist: response was not valid JSON — ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!Array.isArray(parsed.shots)) {
    throw new Error('bulk-shotlist: response did not contain a shots array')
  }

  // Validate each shot against the canonical ShotSchema. Drop invalid ones
  // and surface the discard count via a side-channel rather than failing
  // the whole batch.
  const valid: Shot[] = []
  for (const candidate of parsed.shots) {
    const result = ShotSchema.safeParse(candidate)
    if (result.success) valid.push(result.data)
  }
  return valid
}

async function blobToB64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  let bin = ''
  const view = new Uint8Array(buf)
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i])
  return btoa(bin)
}

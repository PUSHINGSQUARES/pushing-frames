import SYSTEM_PROMPT from './system_prompt.md?raw'
import type { NormalisedRef } from '@/providers/types'

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export async function scaffoldPrompt(
  idea: string,
  refs: NormalisedRef[],
  geminiKey: string,
  model = 'gemini-2.5-flash',
  abort?: AbortSignal,
): Promise<string> {
  const parts: unknown[] = [
    { text: SYSTEM_PROMPT },
    { text: idea },
  ]
  for (const r of refs) {
    const b64 = await blobToB64(r.blob)
    parts.push({ inline_data: { mime_type: r.mimeType, data: b64 } })
  }
  const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
    signal: abort,
  })
  if (!res.ok) throw new Error(`assist: HTTP ${res.status} — ${await res.text().catch(() => '')}`)
  const json = await res.json() as { candidates: { content: { parts: { text?: string }[] } }[] }
  const text = json.candidates[0]?.content?.parts?.find(p => p.text)?.text
  if (!text) throw new Error('assist: no text returned')
  return text.trim()
}

async function blobToB64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  let bin = ''
  const view = new Uint8Array(buf)
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i])
  return btoa(bin)
}

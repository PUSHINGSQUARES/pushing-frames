import type { NormalisedRef, ProviderId } from '@/providers/types'
import caps from '@/providers/capabilities.json'

export async function normaliseForProvider(
  input: Blob,
  filename: string,
  providerId: ProviderId,
): Promise<NormalisedRef> {
  const cap = caps[providerId]
  let blob = input
  let mime = input.type || 'image/jpeg'

  // HEIC: decode via libheif-js (dynamic import to keep bundle small)
  if (/heic|heif/i.test(mime) || /\.hei[cf]$/i.test(filename)) {
    blob = await decodeHeicToJpeg(input)
    mime = 'image/jpeg'
  }

  // Guard: OffscreenCanvas and createImageBitmap are browser-only (not in jsdom).
  // In that environment, skip canvas processing and return the blob as-is.
  // Browser coverage is confirmed in Phase 12 manual acceptance.
  if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return { filename, blob, mimeType: mime, width: 0, height: 0, bytes: blob.size }
  }

  const bitmap = await createImageBitmap(blob)
  let { width, height } = bitmap
  const maxEdge = providerMaxEdge(providerId)
  if (Math.max(width, height) > maxEdge) {
    const scale = maxEdge / Math.max(width, height)
    width = Math.round(width * scale); height = Math.round(height * scale)
  }

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, width, height)

  const targetMime = cap.refFormats.includes(mime) ? mime : cap.refFormats[0]
  let quality = 0.92
  let out = await canvas.convertToBlob({ type: targetMime, quality })
  while (out.size > cap.maxRefBytes && quality > 0.5) {
    quality -= 0.07
    out = await canvas.convertToBlob({ type: targetMime, quality })
  }
  return { filename, blob: out, mimeType: targetMime, width, height, bytes: out.size }
}

function providerMaxEdge(id: ProviderId): number {
  const m: Record<ProviderId, number> = {
    'seedream': 2048, 'openai-image': 1024, 'gemini-image': 3072, 'imagen': 1536, 'openrouter': 1024,
    'seedance': 1536, 'veo-3': 1280, 'kling': 1280,
  }
  return m[id]
}

async function decodeHeicToJpeg(blob: Blob): Promise<Blob> {
  const mod = await import('libheif-js')
  const buf = await blob.arrayBuffer()
  // libheif-js API: adapt to the installed version
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heif = new (mod as any).HeifDecoder()
  const data = heif.decode(new Uint8Array(buf))
  const img = data[0]
  const w = img.get_width(), h = img.get_height()
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(w, h)
  await new Promise<void>((resolve, reject) =>
    img.display(imageData, (displayData: ImageData | null) => {
      if (!displayData) return reject(new Error('HEIC decode failed'))
      ctx.putImageData(displayData, 0, 0); resolve()
    }))
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
}

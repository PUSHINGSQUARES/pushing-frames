import { describe, it, expect } from 'vitest'
import { normaliseForProvider } from './normalise'

describe('normaliseForProvider', () => {
  it('returns a NormalisedRef shape (jsdom: canvas path guarded)', async () => {
    // OffscreenCanvas and createImageBitmap are not available in jsdom.
    // The normaliser guards this path and returns the blob as-is.
    // Full canvas path is confirmed in Phase 12 manual acceptance.
    const blob = new Blob([new Uint8Array(100)], { type: 'image/jpeg' })
    const r = await normaliseForProvider(blob, 'r.jpg', 'seedream')
    expect(r.filename).toBe('r.jpg')
    expect(r.mimeType).toMatch(/image\/(png|jpeg)/)
    expect(r.bytes).toBeLessThan(10_000_000)
  })
})

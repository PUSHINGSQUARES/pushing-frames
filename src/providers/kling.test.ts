import { describe, it, expect, vi, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { KlingAdapter } from './kling'
import type { Shot, GenerateOpts, NormalisedRef } from './types'
import { initVendorVault, storeVendorKey } from '@/vault/vendor_keys'

const shot: Shot = { slug: 's1', action: 'a', refs: [], styleBlocks: [], negBlocks: [], prompt: 'a path' }

function ref(): NormalisedRef {
  return { filename: 'r.jpg', blob: new Blob([new Uint8Array([1])], { type: 'image/jpeg' }), mimeType: 'image/jpeg', width: 1, height: 1, bytes: 1 }
}

describe('KlingAdapter', () => {
  beforeEach(async () => {
    await initVendorVault('pw', new Uint8Array(16))
    await storeVendorKey('kling', { accessKey: 'ak', secretKey: 'sk' })
    vi.restoreAllMocks()
  })

  it('includes image_tail when end-frame provided', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { task_id: 't-1' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { task_status: 'succeed', task_result: { videos: [{ url: 'https://x/k.mp4' }] } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([0, 0]), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const opts: GenerateOpts = { model: 'kling-v2-master', mode: 'i2v', durationSec: 5, startFrame: ref(), endFrame: ref() }
    const a = new KlingAdapter()
    await a.generate(shot, [], opts, () => {}, new AbortController().signal)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body).toHaveProperty('image')
    expect(body).toHaveProperty('image_tail')
  })
})

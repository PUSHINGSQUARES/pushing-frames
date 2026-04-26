import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

describe('vendor keys', () => {
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory())
    vi.resetModules()
  })

  it('stores and reads a vendor key blob (single-field vendor)', async () => {
    const { initVault } = await import('./keys')
    const { storeVendorKey, readVendorKey } = await import('./vendor_keys')
    await initVault('pw', new Uint8Array(16))
    await storeVendorKey('openai', { key: 'sk-openai-123' })
    expect(await readVendorKey('openai')).toEqual({ key: 'sk-openai-123' })
  })

  it('stores and reads a two-field vendor (Kling)', async () => {
    const { initVault } = await import('./keys')
    const { storeVendorKey, readVendorKey } = await import('./vendor_keys')
    await initVault('pw', new Uint8Array(16))
    await storeVendorKey('kling', { accessKey: 'ak-1', secretKey: 'sk-1' })
    expect(await readVendorKey('kling')).toEqual({ accessKey: 'ak-1', secretKey: 'sk-1' })
  })

  it('lists all stored vendors', async () => {
    const { initVault } = await import('./keys')
    const { storeVendorKey, listVendors } = await import('./vendor_keys')
    await initVault('pw', new Uint8Array(16))
    await storeVendorKey('seedream', { key: 'a' })
    await storeVendorKey('kling', { accessKey: 'b', secretKey: 'c' })
    expect((await listVendors()).sort()).toEqual(['kling', 'seedream'])
  })
})

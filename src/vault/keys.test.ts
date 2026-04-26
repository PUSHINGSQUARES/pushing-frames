import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { storeKey, readKey, listProviders, initVault } from './keys'

describe('vault', () => {
  beforeEach(async () => {
    await initVault('pw', new Uint8Array(16))
  })

  it('stores and reads an encrypted key', async () => {
    await storeKey('seedream', 'sk-test-12345')
    expect(await readKey('seedream')).toBe('sk-test-12345')
  })

  it('lists stored providers', async () => {
    await storeKey('seedream', 'a')
    await storeKey('gemini-image', 'b')
    expect((await listProviders()).sort()).toEqual(['gemini-image', 'seedream'])
  })
})

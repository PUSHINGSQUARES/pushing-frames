import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, deriveKey } from './crypto'

describe('crypto', () => {
  it('roundtrips plaintext through deriveKey+encrypt+decrypt', async () => {
    const key = await deriveKey('passphrase', new Uint8Array(16))
    const ct = await encrypt(key, 'hello')
    const pt = await decrypt(key, ct)
    expect(pt).toBe('hello')
  })

  it('fails to decrypt with wrong key', async () => {
    const salt = new Uint8Array(16)
    const k1 = await deriveKey('right', salt)
    const k2 = await deriveKey('wrong', salt)
    const ct = await encrypt(k1, 'secret')
    await expect(decrypt(k2, ct)).rejects.toThrow()
  })
})

import { describe, it, expect } from 'vitest'
import { signKlingJwt, parseJwtPayload } from './kling_auth'

describe('signKlingJwt', () => {
  it('produces a JWT with iss + exp + nbf claims', async () => {
    // WebCrypto HMAC may not be fully supported in jsdom; guard test
    if (typeof crypto.subtle === 'undefined') {
      console.warn('crypto.subtle not available in this environment — Kling JWT test deferred to manual run')
      return
    }
    const token = await signKlingJwt('my-access', 'my-secret')
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
    const payload = parseJwtPayload(token)
    expect(payload.iss).toBe('my-access')
    expect(payload.exp).toBeGreaterThan(payload.nbf)
    expect(payload.exp - payload.nbf).toBeGreaterThan(1500) // ~30 min - 5s margin
  })
})

function b64Url(obj: object): string {
  return btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export async function signKlingJwt(accessKey: string, secretKey: string): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = { iss: accessKey, exp: nowSec + 1800, nbf: nowSec - 5 }
  const toSign = `${b64Url(header)}.${b64Url(payload)}`
  const keyData = new TextEncoder().encode(secretKey)
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(toSign))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${toSign}.${sigB64}`
}

export function parseJwtPayload(token: string): { iss: string; exp: number; nbf: number } {
  const [, payload] = token.split('.')
  const normalised = payload.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(normalised))
}

export class KlingJwtCache {
  private token: string | null = null
  private expiresAt = 0

  async get(accessKey: string, secretKey: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    if (this.token && this.expiresAt - 300 > now) return this.token  // refresh 5 min before expiry
    this.token = await signKlingJwt(accessKey, secretKey)
    this.expiresAt = parseJwtPayload(this.token).exp
    return this.token
  }
}

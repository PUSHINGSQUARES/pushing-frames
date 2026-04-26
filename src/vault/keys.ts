import { get, set, keys, createStore } from 'idb-keyval'
import { deriveKey, encrypt, decrypt } from './crypto'
import { initVendorVault } from './vendor_keys'

const store = createStore('pushing-frames-vault', 'keys')
let currentKey: CryptoKey | null = null

export async function initVault(passphrase: string, salt: Uint8Array): Promise<void> {
  currentKey = await deriveKey(passphrase, salt)
  await initVendorVault(passphrase, salt)
}

function requireKey(): CryptoKey {
  if (!currentKey) throw new Error('Vault locked — call initVault first')
  return currentKey
}

function sanitiseApiKey(raw: string): string {
  const clean = raw.trim().replace(/[​-‍﻿ ]/g, '')
  if (!/^[\x20-\x7E]+$/.test(clean)) {
    throw new Error('API key contains non-ASCII characters. Re-copy it without smart quotes or line breaks.')
  }
  return clean
}

export async function storeKey(provider: string, apiKey: string): Promise<void> {
  const clean = sanitiseApiKey(apiKey)
  const ct = await encrypt(requireKey(), clean)
  await set(provider, ct, store)
}

export async function readKey(provider: string): Promise<string | null> {
  const ct = await get<string>(provider, store)
  if (!ct) return null
  const raw = await decrypt(requireKey(), ct)
  return raw.trim().replace(/[​-‍﻿ ]/g, '')
}

export async function listProviders(): Promise<string[]> {
  return (await keys(store)) as string[]
}

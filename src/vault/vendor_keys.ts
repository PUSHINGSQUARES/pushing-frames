import { get, set, keys, createStore } from 'idb-keyval'
import { deriveKey, encrypt, decrypt } from './crypto'

const store = createStore('pushing-frames-vendor-vault', 'vendors')
let currentKey: CryptoKey | null = null

// Vendor keys are JSON blobs (supports both single-key and multi-field vendors).
export type VendorKeyBlob =
  | { key: string }
  | { accessKey: string; secretKey: string }

export type VendorId = 'seedream' | 'openai' | 'google' | 'kling' | 'openrouter'

function requireKey(): CryptoKey {
  if (!currentKey) throw new Error('Vendor vault locked — call initVendorVault first')
  return currentKey
}

export async function initVendorVault(passphrase: string, salt: Uint8Array): Promise<void> {
  currentKey = await deriveKey(passphrase, salt)
}

function sanitiseLeaf(s: string): string {
  const clean = s.trim().replace(/[​-‍﻿ ]/g, '')
  if (!/^[\x20-\x7E]+$/.test(clean)) {
    throw new Error('Key contains non-ASCII characters. Re-copy without smart quotes or line breaks.')
  }
  return clean
}

function sanitise(blob: VendorKeyBlob): VendorKeyBlob {
  if ('key' in blob) return { key: sanitiseLeaf(blob.key) }
  return { accessKey: sanitiseLeaf(blob.accessKey), secretKey: sanitiseLeaf(blob.secretKey) }
}

export async function storeVendorKey(vendor: VendorId, blob: VendorKeyBlob): Promise<void> {
  const clean = sanitise(blob)
  const ct = await encrypt(requireKey(), JSON.stringify(clean))
  await set(vendor, ct, store)
}

export async function readVendorKey(vendor: VendorId): Promise<VendorKeyBlob | null> {
  const ct = await get<string>(vendor, store)
  if (!ct) return null
  const raw = await decrypt(requireKey(), ct)
  return JSON.parse(raw) as VendorKeyBlob
}

export async function listVendors(): Promise<VendorId[]> {
  return (await keys(store)) as VendorId[]
}

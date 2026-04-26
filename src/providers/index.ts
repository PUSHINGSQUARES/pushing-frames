import { register } from './registry'
import { SeedreamAdapter } from './seedream'
import { OpenAIImageAdapter } from './openai-image'
import { GeminiImageAdapter } from './gemini-image'
import { ImagenAdapter } from './imagen'
import { OpenRouterAdapter } from './openrouter'
import { SeedanceAdapter } from './seedance'
import { Veo3Adapter } from './veo-3'
import { KlingAdapter } from './kling'
import { readVendorKey, type VendorId } from '@/vault/vendor_keys'
import { ADAPTER_VENDOR, type AdapterId } from './vendors'

export { getAdapter, listAdapters } from './registry'

const keyCache = new Map<AdapterId, string>()

export async function bootProviders(): Promise<void> {
  register(new SeedreamAdapter(() => requireKeySync('seedream')))
  register(new OpenAIImageAdapter(() => requireKeySync('openai-image')))
  register(new GeminiImageAdapter(() => requireKeySync('gemini-image')))
  register(new ImagenAdapter(() => requireKeySync('imagen')))
  register(new OpenRouterAdapter(() => requireKeySync('openrouter')))
  register(new SeedanceAdapter(() => requireKeySync('seedance')))
  register(new Veo3Adapter(() => requireKeySync('veo-3')))
  register(new KlingAdapter())
}

export async function primeKeys(adapters: AdapterId[]): Promise<void> {
  // Resolve to distinct vendors, then prime every sibling adapter under each
  // vendor — seedance shares a key with seedream, imagen + veo-3 share with
  // gemini-image. Caching only the requested adapter would leave video/image
  // siblings missing keys even though the vendor key is in the vault.
  const vendors = new Set<VendorId>(adapters.map(id => ADAPTER_VENDOR[id]))
  for (const vendor of vendors) {
    const blob = await readVendorKey(vendor)
    if (!blob || !('key' in blob)) continue  // multi-field (Kling) handled at adapter level
    for (const [aid, v] of Object.entries(ADAPTER_VENDOR) as [AdapterId, VendorId][]) {
      if (v === vendor) keyCache.set(aid, blob.key)
    }
  }
}

function requireKeySync(id: AdapterId): string {
  const k = keyCache.get(id)
  if (!k) throw new Error(`${id}: no key for vendor ${ADAPTER_VENDOR[id]} — paste one in Settings`)
  return k
}

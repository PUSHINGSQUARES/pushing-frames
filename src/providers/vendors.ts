import type { VendorId } from '@/vault/vendor_keys'

export type AdapterId = 'seedream' | 'seedance' | 'openai-image' | 'gemini-image' | 'imagen' | 'veo-3' | 'kling' | 'openrouter'

export const ADAPTER_VENDOR: Record<AdapterId, VendorId> = {
  'seedream': 'seedream',
  'seedance': 'seedream',     // same vendor, same key
  'openai-image': 'openai',
  'gemini-image': 'google',
  'imagen': 'google',         // same vendor as gemini-image, same key
  'veo-3': 'google',          // same vendor, same key
  'kling': 'kling',
  'openrouter': 'openrouter',
}

export const VENDOR_LABELS: Record<VendorId, string> = {
  'seedream': 'Seedream',
  'openai': 'OpenAI',
  'google': 'Google',
  'kling': 'Kling',
  'openrouter': 'OpenRouter',
}

export const VENDOR_CONSOLE_URLS: Record<VendorId, string> = {
  'seedream': 'https://console.byteplus.com/ark',
  'openai': 'https://platform.openai.com/api-keys',
  'google': 'https://aistudio.google.com/app/apikey',
  'kling': 'https://app.klingai.com/global/dev/document-api/apiReference/commonInfo',
  'openrouter': 'https://openrouter.ai/keys',
}

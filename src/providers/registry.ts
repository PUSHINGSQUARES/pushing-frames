import type { ProviderAdapter, ProviderId } from './types'

const adapters = new Map<ProviderId, ProviderAdapter>()

export function register(adapter: ProviderAdapter): void {
  adapters.set(adapter.id, adapter)
}

export function getAdapter(id: ProviderId): ProviderAdapter {
  const a = adapters.get(id)
  if (!a) throw new Error(`No adapter registered for provider: ${id}`)
  return a
}

export function listAdapters(): ProviderAdapter[] {
  return Array.from(adapters.values())
}

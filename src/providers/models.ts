import models from './models.json'
import type { AdapterId } from './vendors'

export interface ModelInfo {
  id: string
  label: string
  tier: string
  quality?: string
  default?: boolean
  allowed_resolutions?: string[]
}

export function listModels(adapter: AdapterId): ModelInfo[] {
  return (models as Record<AdapterId, ModelInfo[]>)[adapter] ?? []
}

export function getDefaultModel(adapter: AdapterId): ModelInfo {
  const list = listModels(adapter)
  return list.find(m => m.default) ?? list[0]
}

export function findModel(adapter: AdapterId, label: string): ModelInfo | undefined {
  return listModels(adapter).find(m => m.label === label)
}

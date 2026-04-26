import type { ModelInfo } from './models'

export type ProviderId =
  | 'seedream' | 'openai-image' | 'gemini-image' | 'imagen' | 'openrouter'
  | 'seedance' | 'veo-3' | 'kling'

export interface Capabilities {
  maxRefs: number
  refFormats: string[]
  maxRefBytes: number
  supportsVideo: boolean
  supportsImage: boolean
  viaOpenRouter: boolean
  videoModes?: ('i2v' | 't2v')[]
  allowedDurations?: number[]
  supportsEndFrame?: boolean
  supportsMotionSlider?: boolean
  costModel?: 'per-image' | 'per-second' | 'per-clip' | 'per-second-tiered'
}

export interface Shot {
  slug: string
  camera?: string
  lens?: string
  aspect?: string
  action: string
  refs: string[]
  styleBlocks: string[]
  negBlocks: string[]
  prompt: string  // composed final prompt
}

export interface NormalisedRef {
  filename: string
  blob: Blob
  mimeType: string
  width: number
  height: number
  bytes: number
}

export interface Progress {
  stage: 'queued' | 'running' | 'polling' | 'complete' | 'failed'
  pct?: number
  etaSec?: number
  message?: string
}
export interface GenResult {
  bytes: Uint8Array
  mimeType: string
  costGBP: number
  durationMs: number
  providerMeta: Record<string, unknown>
}

export interface GenerateOpts {
  model: string
  quality?: string
  seed?: number
  resolution?: string
  motion?: number
  mode?: 'i2v' | 't2v'
  durationSec?: number
  startFrame?: NormalisedRef
  endFrame?: NormalisedRef
  audio?: boolean
}

export interface ProviderAdapter {
  id: ProviderId
  capabilities: Capabilities
  listModels(): ModelInfo[]
  estimate(shot: Shot, opts: GenerateOpts): { costGBP: number }
  generate(
    shot: Shot,
    refs: NormalisedRef[],
    opts: GenerateOpts,
    onProgress: (p: Progress) => void,
    abort?: AbortSignal
  ): Promise<GenResult>
}

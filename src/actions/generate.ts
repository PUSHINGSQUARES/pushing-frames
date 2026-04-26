import { getAdapter } from '@/providers'
import { costGuard } from '@/state/services'
import { formatLedgerEntry } from '@/cost/ledger'
import { normaliseForProvider } from '@/refs/normalise'
import { store } from '@/state/store'
import { composePrompt } from '@/pack/compose'
import { findModel, getDefaultModel } from '@/providers/models'
import type { AdapterId } from '@/providers/vendors'
import type { Shot as PShot, Progress, GenerateOpts } from '@/providers/types'

export async function runGeneration(
  shotSlug: string,
  onProgress: (p: Progress) => void,
  abort: AbortSignal,
  itemId?: string,
): Promise<void> {
  const { project, pack } = store.getState()
  if (!project || !pack) throw new Error('No active project')
  const shotMeta = pack.shots.find(s => s.slug === shotSlug)
  if (!shotMeta) throw new Error(`Shot ${shotSlug} not found`)
  const providerId = (shotMeta.provider as AdapterId | undefined) ?? pack.frontmatter.active_provider
  const modelLabel = shotMeta.model ?? pack.frontmatter.active_model
  const adapter = getAdapter(providerId)
  const model = (modelLabel ? findModel(providerId, modelLabel) : null) ?? getDefaultModel(providerId)

  const prompt = composePrompt(pack, shotMeta)
  const shot: PShot = { ...shotMeta, prompt }
  const opts: GenerateOpts = {
    model: model.id,
    quality: model.quality,
    resolution: shotMeta.resolution,
    mode: shotMeta.video_mode,
    durationSec: shotMeta.duration_sec,
    motion: shotMeta.motion,
    audio: shotMeta.audio,
  }

  if (shotMeta.start_frame) {
    const blob = await project.readRef(shotMeta.start_frame)
    opts.startFrame = await normaliseForProvider(blob, shotMeta.start_frame, providerId)
  }
  if (shotMeta.end_frame) {
    const blob = await project.readRef(shotMeta.end_frame)
    opts.endFrame = await normaliseForProvider(blob, shotMeta.end_frame, providerId)
  }

  const isVideo = adapter.capabilities.supportsVideo
  const est = adapter.estimate(shot, opts)
  costGuard.setCaps({ singleGen: isVideo ? 5 : 2 })
  const admit = costGuard.admit(est.costGBP)
  if (!admit.ok) {
    const ok = window.confirm(`Cost guard: ${admit.reason} cap £${admit.limit} would be breached. Continue?`)
    if (!ok) throw new Error('aborted by user')
  }

  const refs = []
  for (const name of shotMeta.refs) {
    const blob = await project.readRef(name)
    refs.push(await normaliseForProvider(blob, name, providerId))
  }

  const t0 = new Date().toISOString()
  const result = await adapter.generate(shot, refs, opts, onProgress, abort)
  costGuard.record(result.costGBP)

  const ext = result.mimeType === 'image/png' ? 'png' : result.mimeType === 'image/jpeg' ? 'jpg' : 'mp4'
  const stamp = t0.replace(/\.\d+Z$/, '').replace(/[-:T]/g, '')
  // Extract variation index from item id pattern <slug>-<N>-<ts>
  const variationMatch = itemId?.match(/-(\d+)-\d+$/)
  const variationIdx = variationMatch ? Number(variationMatch[1]) : 1
  const outName = `${stamp}_${shot.slug}_v${String(variationIdx).padStart(2, '0')}.${ext}`
  const outPath = await project.writeGeneration(outName, result.bytes, result.mimeType)
  await project.writeMeta(outName.replace(/\.[^.]+$/, '.meta.json'), {
    prompt, provider: providerId, model: result.providerMeta, costGBP: result.costGBP,
    durationMs: result.durationMs, refs: shotMeta.refs, ts: t0,
  })
  await project.appendLedger(formatLedgerEntry({
    ts: t0, provider: providerId, shot: shot.slug, costGBP: result.costGBP,
    durationMs: result.durationMs, outputFile: outPath,
  }))

  const prev = store.getState().generations
  store.setGenerations([outName, ...prev])
}

// Legacy single-shot API — now delegates to queue
export async function generateActiveShot(onProgress?: (p: Progress) => void): Promise<void> {
  const { activeShotSlug } = store.getState()
  if (!activeShotSlug) throw new Error('No active shot')
  const controller = new AbortController()
  return runGeneration(activeShotSlug, onProgress ?? (() => {}), controller.signal)
}

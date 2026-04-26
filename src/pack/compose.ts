import type { Pack, Shot } from './types'

export function composePrompt(pack: Pack, shot: Shot): string {
  const styleBodies = shot.styleBlocks.map(n => pack.blocks.find(b => b.name === n)?.body ?? '').filter(Boolean)
  const negBodies = shot.negBlocks.map(n => pack.blocks.find(b => b.name === n)?.body ?? '').filter(Boolean)
  const head = [shot.camera, shot.lens, shot.aspect].filter(Boolean).join(', ')
  const positive = [head, shot.action, ...styleBodies].filter(Boolean).join(' ')
  const negative = negBodies.length > 0 ? `\n\nNegative prompt: ${negBodies.join(', ')}` : ''
  return positive + negative
}

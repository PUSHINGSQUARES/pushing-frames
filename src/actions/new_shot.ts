import { store } from '@/state/store'
import type { Shot } from '@/pack/types'

export function addNewShot(): string {
  const state = store.getState()
  if (!state.pack) throw new Error('no pack loaded')
  const existing = state.pack.shots.length
  const slug = `shot_${String(existing + 1).padStart(2, '0')}`
  const shot: Shot = {
    slug,
    action: '',
    refs: [],
    styleBlocks: [],
    negBlocks: [],
    aspect: '16:9',
  }
  const pack = { ...state.pack, shots: [...state.pack.shots, shot] }
  store.setPack(pack)
  store.setActiveShot(slug)
  store._scheduleStoryboardWrite(0)
  return slug
}

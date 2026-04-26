import { useSyncExternalStore } from 'react'
import type { Pack, Shot } from '@/pack/types'
import type { ProjectHandle } from '@/fs/projectHandle'
import type { AdapterId } from '@/providers/vendors'

interface State {
  project: ProjectHandle | null
  pack: Pack | null
  activeShotSlug: string | null
  refFiles: string[]
  generations: string[]
  lightboxFile: string | null
}

let state: State = { project: null, pack: null, activeShotSlug: null, refFiles: [], generations: [], lightboxFile: null }
const subs = new Set<() => void>()

function emit() { for (const s of subs) s() }

// Debounced storyboard write — 500ms delay
let _writeTimer: ReturnType<typeof setTimeout> | null = null
function scheduleStoryboardWrite(delayMs = 500) {
  if (_writeTimer !== null) clearTimeout(_writeTimer)
  _writeTimer = setTimeout(async () => {
    _writeTimer = null
    const { project, pack } = state
    if (!project || !pack) return
    try {
      const { serialiseStoryboard } = await import('@/pack/serialise')
      await project.writeStoryboard(serialiseStoryboard(pack))
    } catch { /* swallow — autosave is best-effort */ }
  }, delayMs)
}

export const store = {
  getState: () => state,
  subscribe: (fn: () => void) => { subs.add(fn); return () => subs.delete(fn) },
  setProject(p: ProjectHandle) { state = { ...state, project: p }; emit() },
  setPack(p: Pack) { state = { ...state, pack: p, activeShotSlug: state.activeShotSlug ?? p.shots[0]?.slug ?? null }; emit() },
  setRefs(r: string[]) { state = { ...state, refFiles: r }; emit() },
  setActiveShot(slug: string) { state = { ...state, activeShotSlug: slug }; emit() },
  setGenerations(g: string[]) { state = { ...state, generations: g }; emit() },
  openLightbox(name: string) { state = { ...state, lightboxFile: name }; emit() },
  closeLightbox() { state = { ...state, lightboxFile: null }; emit() },
  updateShot(slug: string, patch: Partial<Shot>) {
    if (!state.pack) return
    const shots = state.pack.shots.map(s => s.slug === slug ? { ...s, ...patch } : s)
    state = { ...state, pack: { ...state.pack, shots } }; emit()
    scheduleStoryboardWrite()
  },
  setActiveProvider(id: AdapterId) {
    if (!state.pack) return
    state = { ...state, pack: { ...state.pack, frontmatter: { ...state.pack.frontmatter, active_provider: id } } }
    emit()
  },
  setActiveModel(modelLabel: string) {
    if (!state.pack) return
    state = { ...state, pack: { ...state.pack, frontmatter: { ...state.pack.frontmatter, active_model: modelLabel } } }
    emit()
  },
  reorderShots(from: number, to: number) {
    if (!state.pack) return
    if (from === to) return
    const shots = [...state.pack.shots]
    const [moved] = shots.splice(from, 1)
    if (!moved) return
    shots.splice(to, 0, moved)
    state = { ...state, pack: { ...state.pack, shots } }
    emit()
    scheduleStoryboardWrite()
  },
  // Exposed for tests and new_shot action
  _scheduleStoryboardWrite: scheduleStoryboardWrite,
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(state))
}

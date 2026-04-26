import { useState } from 'react'
import type { Shot, Block } from '@/pack/schema'
import { Stage1Setup } from './Stage1Setup'
import { Stage2Concept } from './Stage2Concept'
import { Stage3Style } from './Stage3Style'
import { Stage4Shots } from './Stage4Shots'
import { Stage5Review } from './Stage5Review'

export type TemplateId = 'cinematography' | 'bmw'

/**
 * Working state for the guide. Filled in across stages 1-5. The shape is
 * deliberately loose during the wizard—Stage 5 finalises into proper Pack
 * + Frontmatter shape before writing files.
 */
export interface GuideState {
  // Stage 1
  name: string
  slug: string
  destinationDir: FileSystemDirectoryHandle | null
  templateId: TemplateId | null

  // Stage 2 — concept
  summary: string
  mood: string
  refs: string[]                 // filenames living in <destination>/refs/

  // Stage 3 — style defaults that apply to new shots
  camera: string
  lens: string
  aspect: string
  selectedStyleBlocks: string[]
  selectedNegBlocks: string[]

  // Stage 4 — shot list
  shots: Shot[]
  activeShotIdx: number | null

  // Edit mode pre-populates this with the project's existing blocks.
  // When set, Stage 3 + Stage 5 + onComplete read available blocks from
  // here instead of parsing one of the bundled templates.
  availableBlocks: Block[] | null
}

interface Props {
  mode: 'create' | 'edit'
  initialState?: Partial<GuideState>
  onCancel: () => void
  onComplete: (state: GuideState) => Promise<void> | void
  onOpenSettings?: () => void
}

const TOTAL_STAGES = 5

export function GuideContainer({ mode, initialState, onCancel, onComplete, onOpenSettings }: Props) {
  const [stage, setStage] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [state, setState] = useState<GuideState>({
    name: initialState?.name ?? '',
    slug: initialState?.slug ?? '',
    destinationDir: initialState?.destinationDir ?? null,
    templateId: initialState?.templateId ?? null,
    summary: initialState?.summary ?? '',
    mood: initialState?.mood ?? '',
    refs: initialState?.refs ?? [],
    camera: initialState?.camera ?? '',
    lens: initialState?.lens ?? '',
    aspect: initialState?.aspect ?? '16:9',
    selectedStyleBlocks: initialState?.selectedStyleBlocks ?? [],
    selectedNegBlocks: initialState?.selectedNegBlocks ?? [],
    shots: initialState?.shots ?? [],
    activeShotIdx: initialState?.activeShotIdx ?? null,
    availableBlocks: initialState?.availableBlocks ?? null,
  })

  const update = (patch: Partial<GuideState>) => setState(s => ({ ...s, ...patch }))

  const next = () => setStage(s => Math.min(TOTAL_STAGES, s + 1))
  const back = () => setStage(s => Math.max(1, s - 1))

  // Per-stage advance gate. Edit mode skips the Stage 1 gate since those
  // fields are read-only and pre-populated.
  const canAdvance = ((): boolean => {
    if (mode === 'edit') return true
    if (stage === 1) {
      return (
        state.name.trim().length > 0 &&
        state.slug.trim().length > 0 &&
        state.destinationDir !== null &&
        state.templateId !== null
      )
    }
    if (stage === 2) {
      // Summary is required (1-3 sentences). Refs are optional.
      return state.summary.trim().length > 0
    }
    if (stage === 3) {
      // No hard gate yet — at least one style block selected feels like a
      // soft requirement, but we let the user proceed empty if they want to.
      return true
    }
    return true  // stage 4 lands next sub-chunk
  })()

  const submit = async () => {
    setSubmitting(true)
    try {
      await onComplete(state)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-void text-mist p-6">
      <header className="flex items-center justify-between mb-6 max-w-3xl mx-auto w-full">
        <div className="space-y-1">
          <h1 className="text-2xl tracking-tight">
            {mode === 'edit' ? 'Edit Project Guide' : 'Create New Project'}
          </h1>
          <p className="text-xs text-smoke uppercase tracking-widest">
            stage {stage} of {TOTAL_STAGES}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {onOpenSettings && (
            <button onClick={onOpenSettings} className="text-xs text-smoke underline">manage keys</button>
          )}
          <button onClick={onCancel} className="text-xs text-smoke underline">cancel</button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full">
        {stage === 1 && <Stage1Setup mode={mode} state={state} update={update} />}
        {stage === 2 && <Stage2Concept state={state} update={update} />}
        {stage === 3 && <Stage3Style state={state} update={update} />}
        {stage === 4 && <Stage4Shots state={state} update={update} />}
        {stage === 5 && <Stage5Review state={state} mode={mode} />}
      </main>

      <footer className="flex items-center justify-between mt-6 max-w-3xl mx-auto w-full">
        <button
          onClick={back}
          disabled={stage === 1}
          className="glass glass-pill px-4 py-2 text-sm disabled:text-smoke disabled:cursor-not-allowed"
        >back</button>
        {stage < TOTAL_STAGES ? (
          <button
            onClick={next}
            disabled={!canAdvance}
            className="glass glass-pill px-4 py-2 text-sm disabled:text-smoke disabled:cursor-not-allowed"
          >next</button>
        ) : (
          <button
            onClick={submit}
            disabled={submitting}
            className="glass glass-pill px-4 py-2 text-sm disabled:text-smoke"
          >{submitting ? 'working…' : mode === 'edit' ? 'save changes' : 'create'}</button>
        )}
      </footer>
    </div>
  )
}

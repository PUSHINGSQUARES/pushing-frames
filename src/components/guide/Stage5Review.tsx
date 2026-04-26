import { useMemo } from 'react'
import type { GuideState } from './GuideContainer'
import { buildStyleMarkdown, buildStoryboardMarkdown } from '@/pack/build_from_guide'

import cinemaStyle from '@/templates/cinematography/style.md?raw'
import bmwStyle from '@/templates/bmw/style.md?raw'

interface Props {
  state: GuideState
  mode: 'create' | 'edit'
}

/**
 * Stage 5 — Review. Shows previews of style.md and storyboard.md exactly
 * as they'll be written to the destination, plus a ref count. The actual
 * Create / Save action lives in the GuideContainer footer.
 */
export function Stage5Review({ state, mode }: Props) {
  // In edit mode, the "template" is the project's existing blocks rebuilt
  // back into markdown so buildStyleMarkdown's parse-and-filter pass keeps
  // working unchanged. Create mode uses the bundled template raw.
  const templateText = state.availableBlocks
    ? state.availableBlocks.map(b => `## ${b.name}\n${b.body}`).join('\n\n')
    : state.templateId === 'bmw' ? bmwStyle : cinemaStyle

  const stylePreview = useMemo(() => buildStyleMarkdown({
    name: state.name,
    slug: state.slug,
    summary: state.summary,
    mood: state.mood,
    templateText,
    selectedStyleBlocks: state.selectedStyleBlocks,
    selectedNegBlocks: state.selectedNegBlocks,
    shots: state.shots,
  }), [state, templateText])

  const storyboardPreview = useMemo(() => buildStoryboardMarkdown({
    name: state.name,
    slug: state.slug,
    shots: state.shots,
  }), [state.name, state.slug, state.shots])

  const dirName = state.destinationDir?.name ?? 'destination'

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg">Review</h2>
        <p className="text-xs text-smoke">
          {mode === 'edit'
            ? 'Verify the changes before saving back to the project folder.'
            : 'These three things will land in your destination folder. Hit create to ship them.'}
        </p>
      </header>

      <section className="border border-hairline rounded-md p-4 space-y-2">
        <header className="flex items-center justify-between">
          <span className="text-xs text-smoke uppercase tracking-widest">{dirName}/style.md</span>
          <span className="text-[10px] text-smoke">{state.selectedStyleBlocks.length + state.selectedNegBlocks.length} blocks</span>
        </header>
        <pre className="text-[10px] font-mono text-smoke whitespace-pre-wrap max-h-64 overflow-auto bg-black/30 rounded-sm p-2">{stylePreview}</pre>
      </section>

      <section className="border border-hairline rounded-md p-4 space-y-2">
        <header className="flex items-center justify-between">
          <span className="text-xs text-smoke uppercase tracking-widest">{dirName}/storyboard.md</span>
          <span className="text-[10px] text-smoke">{state.shots.length} shot{state.shots.length === 1 ? '' : 's'}</span>
        </header>
        <pre className="text-[10px] font-mono text-smoke whitespace-pre-wrap max-h-64 overflow-auto bg-black/30 rounded-sm p-2">{storyboardPreview}</pre>
      </section>

      <section className="border border-hairline rounded-md p-4 flex items-center justify-between">
        <span className="text-xs text-smoke uppercase tracking-widest">{dirName}/refs/</span>
        <span className="text-[10px] text-smoke">
          {state.refs.length} {state.refs.length === 1 ? 'reference' : 'references'} already imported
        </span>
      </section>
    </div>
  )
}

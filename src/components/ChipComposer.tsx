import { useStore, store } from '@/state/store'
import { ModelPicker } from './ModelPicker'
import { AssistPanel } from './AssistPanel'
import { VideoControls } from './VideoControls'
import { RefsUsedZone } from './RefsUsedZone'
import { VariationsPicker } from './VariationsPicker'
import { ResolutionPicker } from './ResolutionPicker'
import { addNewShot } from '@/actions/new_shot'
import type { AdapterId } from '@/providers/vendors'
import type { NormalisedRef } from '@/providers/types'

export function ChipComposer({ refs = [] }: { refs?: NormalisedRef[] }) {
  const pack = useStore(s => s.pack)
  const slug = useStore(s => s.activeShotSlug)

  if (!pack || !slug) return <p className="text-smoke text-sm">Open a project to begin.</p>
  const shot = pack.shots.find(s => s.slug === slug)
  if (!shot) return null

  const update = (patch: Partial<typeof shot>) => store.updateShot(slug, patch)

  const toggle = (arr: string[], name: string) => arr.includes(name) ? arr.filter(x => x !== name) : [...arr, name]

  return (
    <div className="space-y-3 p-4 border border-hairline">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs uppercase tracking-widest text-chalk">Shot — {shot.slug}</h2>
        <button onClick={addNewShot} className="glass glass-pill px-3 py-1 text-xs">+ new shot</button>
      </div>
      <textarea
        className="w-full bg-transparent border border-hairline p-2 font-sans text-sm"
        value={shot.action}
        onChange={e => update({ action: e.target.value })}
        rows={4}
      />
      <div className="grid grid-cols-3 gap-2 text-sm">
        <label className="flex flex-col"><span className="text-smoke text-xs">Camera</span>
          <input className="border border-hairline p-1" value={shot.camera ?? ''} onChange={e => update({ camera: e.target.value })} />
        </label>
        <label className="flex flex-col"><span className="text-smoke text-xs">Lens</span>
          <input className="border border-hairline p-1" value={shot.lens ?? ''} onChange={e => update({ lens: e.target.value })} />
        </label>
        <label className="flex flex-col"><span className="text-smoke text-xs">Aspect</span>
          <select className="border border-hairline p-1" value={shot.aspect ?? '16:9'} onChange={e => update({ aspect: e.target.value })}>
            {['1:1','16:9','9:16','4:3','21:9'].map(a => <option key={a}>{a}</option>)}
          </select>
        </label>
      </div>
      <ChipRail label="Style" all={pack.blocks.filter(b => b.name.startsWith('STYLE')).map(b => b.name)} selected={shot.styleBlocks} onToggle={name => update({ styleBlocks: toggle(shot.styleBlocks, name) })} />
      <ChipRail label="Negative" all={pack.blocks.filter(b => b.name.startsWith('NEG')).map(b => b.name)} selected={shot.negBlocks} onToggle={name => update({ negBlocks: toggle(shot.negBlocks, name) })} />
      <RefsUsedZone />
      <AssistPanel refs={refs} />
      <VideoControls />
      <div className="flex items-center gap-3 pt-2 border-t border-hairline mt-2">
        <span className="text-chalk text-xs uppercase">provider</span>
        <select
          value={pack.frontmatter.active_provider}
          onChange={e => store.setActiveProvider(e.target.value as AdapterId)}
          className="bg-transparent border border-hairline rounded-md p-1 text-xs"
        >
          {(['seedream','openai-image','gemini-image','imagen','openrouter','seedance','veo-3','kling'] as AdapterId[]).map(id => (
            <option key={id} value={id} className="bg-void text-mist">{id}</option>
          ))}
        </select>
        <span className="text-chalk text-xs uppercase">model</span>
        <ModelPicker
          adapter={pack.frontmatter.active_provider}
          value={pack.frontmatter.active_model}
          onChange={m => store.setActiveModel(m.label)}
        />
        <VariationsPicker />
        <ResolutionPicker />
      </div>
    </div>
  )
}

function ChipRail({ label, all, selected, onToggle }: { label: string; all: string[]; selected: string[]; onToggle: (n: string) => void }) {
  return (
    <div>
      <span className="text-smoke text-xs uppercase mr-2">{label}</span>
      {all.map(name => (
        <button
          key={name}
          onClick={() => onToggle(name)}
          className={`text-xs mr-1 mb-1 px-2 py-1 border ${selected.includes(name) ? 'bg-mist text-void border-mist' : 'bg-transparent text-ink border-dust'}`}
        >{name}</button>
      ))}
    </div>
  )
}

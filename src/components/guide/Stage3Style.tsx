import { useEffect, useMemo, useState } from 'react'
import type { GuideState } from './GuideContainer'

import cinemaStyle from '@/templates/cinematography/style.md?raw'
import bmwStyle from '@/templates/bmw/style.md?raw'

interface Props {
  state: GuideState
  update: (patch: Partial<GuideState>) => void
}

const CAMERA_OPTIONS = [
  'ARRI Alexa 35',
  'ARRI Alexa Mini LF',
  'ARRI Alexa 65',
  'RED Komodo 6K',
  'RED V-Raptor 8K',
  'Sony Venice 2',
  'DJI Inspire 3',
  'GoPro Hero',
]

const LENS_OPTIONS = [
  '24mm Prime T1.5',
  '35mm Prime T1.5',
  '50mm Prime T1.4',
  '85mm Portrait T1.2',
  '14mm Ultra-Wide T2.8',
  '135mm Telephoto T2.0',
  'Anamorphic 2x squeeze',
]

const ASPECT_OPTIONS = ['1:1', '4:3', '16:9', '9:16', '21:9']

/**
 * Extract block names from a style.md template. Looks for `## NAME`
 * headings and ignores HTML comments above them. Returns the names
 * grouped into STYLE_/NEG_ buckets.
 */
function extractBlocks(text: string): { style: string[]; neg: string[] } {
  const names = [...text.matchAll(/^##\s+([A-Z][A-Z0-9_]+)\s*$/gm)].map(m => m[1])
  return {
    style: names.filter(n => n.startsWith('STYLE_') || n === 'STYLE_GUIDE'),
    neg: names.filter(n => n.startsWith('NEG_')),
  }
}

export function Stage3Style({ state, update }: Props) {
  const blocks = useMemo(() => {
    if (state.availableBlocks) {
      // Edit mode — use the project's existing blocks as the available set.
      const names = state.availableBlocks.map(b => b.name)
      return {
        style: names.filter(n => n.startsWith('STYLE_') || n === 'STYLE_GUIDE'),
        neg: names.filter(n => n.startsWith('NEG_')),
      }
    }
    const text = state.templateId === 'bmw' ? bmwStyle : cinemaStyle
    return extractBlocks(text)
  }, [state.templateId, state.availableBlocks])

  // On first mount of stage 3 with empty selections, default to all STYLE
  // blocks selected and the first NEG block selected. The user can deselect.
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    if (seeded) return
    if (state.selectedStyleBlocks.length === 0 && state.selectedNegBlocks.length === 0) {
      update({
        selectedStyleBlocks: blocks.style,
        selectedNegBlocks: blocks.neg.slice(0, 2),
      })
    }
    setSeeded(true)
  }, [seeded, blocks, state.selectedStyleBlocks.length, state.selectedNegBlocks.length, update])

  const toggleStyle = (name: string) => {
    const next = state.selectedStyleBlocks.includes(name)
      ? state.selectedStyleBlocks.filter(b => b !== name)
      : [...state.selectedStyleBlocks, name]
    update({ selectedStyleBlocks: next })
  }
  const toggleNeg = (name: string) => {
    const next = state.selectedNegBlocks.includes(name)
      ? state.selectedNegBlocks.filter(b => b !== name)
      : [...state.selectedNegBlocks, name]
    update({ selectedNegBlocks: next })
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg">Style defaults</h2>
        <p className="text-xs text-smoke">
          Camera, lens, aspect, and the style blocks that apply to every new shot.
          Override per-shot later. These choices map to the brief a real DP would need.
        </p>
      </header>

      <ChipRow
        label="Camera default"
        options={CAMERA_OPTIONS}
        value={state.camera}
        onChange={v => update({ camera: v })}
      />
      <ChipRow
        label="Lens default"
        options={LENS_OPTIONS}
        value={state.lens}
        onChange={v => update({ lens: v })}
      />
      <ChipRow
        label="Aspect"
        options={ASPECT_OPTIONS}
        value={state.aspect}
        onChange={v => update({ aspect: v })}
      />

      <section className="space-y-2">
        <header>
          <h3 className="text-xs text-smoke uppercase tracking-widest">Style blocks (from template)</h3>
          <p className="text-[10px] text-smoke">Toggle which blocks land in your style.md. Bodies stay editable later.</p>
        </header>
        <div className="flex flex-wrap gap-2">
          {blocks.style.map(name => {
            const on = state.selectedStyleBlocks.includes(name)
            return (
              <button
                key={name}
                onClick={() => toggleStyle(name)}
                className={`text-xs px-2 py-1 border rounded-md ${on ? 'bg-mist text-void border-mist' : 'border-hairline text-smoke'}`}
              >{name}</button>
            )
          })}
          {blocks.style.length === 0 && <span className="text-xs text-smoke">no style blocks in this template</span>}
        </div>
      </section>

      <section className="space-y-2">
        <header>
          <h3 className="text-xs text-smoke uppercase tracking-widest">Negative blocks (from template)</h3>
          <p className="text-[10px] text-smoke">Pull against the AI defaults. Start with one or two; layer more per-shot.</p>
        </header>
        <div className="flex flex-wrap gap-2">
          {blocks.neg.map(name => {
            const on = state.selectedNegBlocks.includes(name)
            return (
              <button
                key={name}
                onClick={() => toggleNeg(name)}
                className={`text-xs px-2 py-1 border rounded-md ${on ? 'bg-mist text-void border-mist' : 'border-hairline text-smoke'}`}
              >{name}</button>
            )
          })}
          {blocks.neg.length === 0 && <span className="text-xs text-smoke">no negative blocks in this template</span>}
        </div>
      </section>
    </div>
  )
}

function ChipRow({ label, options, value, onChange }: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs text-smoke uppercase tracking-widest">{label}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(value === opt ? '' : opt)}
            className={`text-xs px-2 py-1 border rounded-md ${value === opt ? 'bg-mist text-void border-mist' : 'border-hairline text-smoke'}`}
          >{opt}</button>
        ))}
      </div>
    </section>
  )
}

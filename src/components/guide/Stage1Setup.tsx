import type { GuideState, TemplateId } from './GuideContainer'

interface Props {
  mode: 'create' | 'edit'
  state: GuideState
  update: (patch: Partial<GuideState>) => void
}

interface TemplateMeta {
  id: TemplateId | 'decision-frameworks'
  label: string
  blurb: string
  available: boolean
}

const TEMPLATES: TemplateMeta[] = [
  {
    id: 'cinematography',
    label: 'Cinematography Rules',
    blurb: 'Curated STYLE_/NEG_ block library that fights common AI failure modes. No shots—a starting palette.',
    available: true,
  },
  {
    id: 'bmw',
    label: 'BMW Worked Example',
    blurb: 'A real annotated pack with 6 shots showing the format end-to-end. Override every block with your own voice.',
    available: true,
  },
  {
    id: 'decision-frameworks',
    label: 'Decision Frameworks',
    blurb: 'Interactive lens and lighting Q&A. Coming in a future update.',
    available: false,
  },
]

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

export function Stage1Setup({ mode, state, update }: Props) {
  const onPickDir = async () => {
    try {
      const dir = await (window as unknown as {
        showDirectoryPicker: (opts: { mode: 'readwrite' }) => Promise<FileSystemDirectoryHandle>
      }).showDirectoryPicker({ mode: 'readwrite' })
      update({ destinationDir: dir })
    } catch {
      // User cancelled the picker — no-op.
    }
  }

  const onNameChange = (name: string) => {
    // Auto-derive slug while it's still tracking the name. Once the user
    // edits the slug independently, we stop overwriting it.
    const wasAutoSlug = state.slug === '' || state.slug === slugify(state.name)
    update({ name, slug: wasAutoSlug ? slugify(name) : state.slug })
  }

  const locked = mode === 'edit'

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <header>
          <h2 className="text-lg">Project setup</h2>
          <p className="text-xs text-smoke">
            {locked
              ? 'Project name, slug, destination, and template are locked once a project is created. Stages 2-5 are editable.'
              : 'Name your project, pick where it lives, and choose a starter template.'}
          </p>
        </header>

        <label className="block">
          <span className="text-xs text-smoke uppercase tracking-widest">Project name</span>
          <input
            disabled={locked}
            value={state.name}
            onChange={e => onNameChange(e.target.value)}
            placeholder="BMW M-Series Track Day"
            className="w-full bg-transparent border border-hairline rounded-md p-2 mt-1 text-sm disabled:text-smoke"
          />
        </label>

        <label className="block">
          <span className="text-xs text-smoke uppercase tracking-widest">Slug</span>
          <input
            disabled={locked}
            value={state.slug}
            onChange={e => update({ slug: slugify(e.target.value) })}
            placeholder="bmw-track-day"
            className="w-full bg-transparent border border-hairline rounded-md p-2 mt-1 text-sm font-mono disabled:text-smoke"
          />
          <span className="text-[10px] text-smoke">used for the project's frontmatter slug — folder name is independent</span>
        </label>
      </section>

      <section className="space-y-3">
        <header>
          <h3 className="text-sm uppercase tracking-widest text-smoke">Destination</h3>
          <p className="text-xs text-smoke">A folder where style.md, storyboard.md, refs/ and generations/ will live.</p>
        </header>
        <div className="flex items-center gap-3">
          <button
            disabled={locked}
            onClick={onPickDir}
            className="glass glass-pill px-4 py-2 text-sm disabled:text-smoke"
          >{state.destinationDir ? 'change folder' : 'pick destination folder'}</button>
          {state.destinationDir && (
            <span className="text-xs text-mist font-mono">{state.destinationDir.name}/</span>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <header>
          <h3 className="text-sm uppercase tracking-widest text-smoke">Starter template</h3>
          <p className="text-xs text-smoke">Seeds your style.md with curated blocks. Override every line with your own voice once you're in.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TEMPLATES.map(t => {
            const selected = state.templateId === t.id
            return (
              <button
                key={t.id}
                disabled={!t.available || locked}
                onClick={() => update({ templateId: t.id as TemplateId })}
                className={`text-left p-4 border rounded-md transition ${
                  selected ? 'border-mist bg-mist/10' : 'border-hairline'
                } ${!t.available ? 'opacity-50' : 'hover:bg-mist/5'} disabled:cursor-not-allowed`}
              >
                <div className="text-sm">{t.label}</div>
                <p className="text-[10px] text-smoke mt-1 leading-relaxed">{t.blurb}</p>
                {!t.available && <p className="text-[10px] text-smoke mt-2 italic">phase 2</p>}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

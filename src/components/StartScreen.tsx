interface Props {
  onOpenProject: () => void
  onCreateNew: () => void
  onOpenSettings: () => void
  hasKeys: boolean
  error?: string | null
}

/**
 * First screen after the vault passphrase. Two paths: open an existing
 * project (bypasses the guide entirely) or kick off the Create New
 * Project guide. Lives between unlock and the main app.
 *
 * Also prompts the user to add API keys before they hit the guide—
 * Gemini auto-generate / bulk-generate fail silently otherwise.
 */
export function StartScreen({ onOpenProject, onCreateNew, onOpenSettings, hasKeys, error }: Props) {
  return (
    <div className="min-h-screen grid place-items-center p-6 bg-void text-mist">
      <div className="w-full max-w-3xl space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-3xl tracking-tight">PUSHING FRAMES_</h1>
          <p className="text-smoke text-xs uppercase tracking-widest">cinematic prompt studio</p>
        </header>

        {!hasKeys && (
          <div className="border border-amber-400/40 bg-amber-400/5 rounded-md p-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-widest text-amber-200">Add your keys first</div>
              <p className="text-xs text-smoke">
                You need at least a Google API key for guide assistance, plus any provider keys you'll use to generate.
                Keys are encrypted with your vault passphrase and stored locally.
              </p>
            </div>
            <button onClick={onOpenSettings} className="glass glass-pill px-4 py-2 text-xs shrink-0">add keys</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={onOpenProject}
            className="glass glass-card p-8 text-left space-y-2 hover:bg-mist/5 transition"
          >
            <div className="text-sm uppercase tracking-widest text-smoke">existing</div>
            <div className="text-xl">Open Project</div>
            <p className="text-xs text-smoke leading-relaxed">
              Pick a folder that already has a style.md and storyboard.md. Drops you straight into the composer.
            </p>
          </button>

          <button
            onClick={onCreateNew}
            className="glass glass-card p-8 text-left space-y-2 hover:bg-mist/5 transition"
          >
            <div className="text-sm uppercase tracking-widest text-smoke">new</div>
            <div className="text-xl">Create New Project</div>
            <p className="text-xs text-smoke leading-relaxed">
              Walk through the project guide. Pick a template, write a brief, draft your first shots, then create.
            </p>
          </button>
        </div>

        {error && (
          <div className="glass glass-card px-4 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <p className="text-[10px] text-smoke uppercase tracking-widest">
            stop prompting · start defining outcomes
          </p>
          <button onClick={onOpenSettings} className="text-[10px] text-smoke underline">manage keys</button>
        </div>
      </div>
    </div>
  )
}

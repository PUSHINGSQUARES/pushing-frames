// Pure functions that turn the guide's working state into the markdown
// files that get written to disk. Used for both Stage 5 preview and the
// actual Create write. Hidden from the user — markdown is the artefact.

import YAML from 'yaml'
import { serialiseStoryboard } from './serialise'
import type { Pack, Shot } from './schema'

interface TemplateBlock {
  name: string
  body: string
}

/**
 * Extract `## NAME` blocks from a template's raw markdown. Ignores HTML
 * comments and prose preamble. Captures everything between one heading
 * and the next as the block body.
 */
export function parseTemplateBlocks(text: string): TemplateBlock[] {
  // Strip HTML comments first so they don't bleed into block bodies.
  const stripped = text.replace(/<!--[\s\S]*?-->/g, '')
  const lines = stripped.split(/\r?\n/)
  const blocks: TemplateBlock[] = []
  let current: TemplateBlock | null = null
  for (const line of lines) {
    const heading = line.match(/^##\s+([A-Z][A-Z0-9_]+)\s*$/)
    if (heading) {
      if (current) blocks.push({ name: current.name, body: current.body.trim() })
      current = { name: heading[1], body: '' }
      continue
    }
    if (current && !line.startsWith('# ')) current.body += line + '\n'
  }
  if (current) blocks.push({ name: current.name, body: current.body.trim() })
  return blocks
}

interface BuildInput {
  name: string
  slug: string
  summary: string
  mood: string
  templateText: string
  selectedStyleBlocks: string[]
  selectedNegBlocks: string[]
  shots: Shot[]
}

export function buildStyleMarkdown(input: BuildInput): string {
  const allBlocks = parseTemplateBlocks(input.templateText)
  const selected = new Set([...input.selectedStyleBlocks, ...input.selectedNegBlocks])
  const kept = allBlocks.filter(b => selected.has(b.name))

  const frontmatter = {
    title: input.name,
    slug: input.slug,
    pack_version: '0.1',
  }

  const fm = '---\n' + YAML.stringify(frontmatter).trimEnd() + '\n---\n\n'

  const intro = input.summary || input.mood
    ? '<!-- Project brief\n' +
      (input.summary ? `Summary: ${input.summary}\n` : '') +
      (input.mood ? `Mood: ${input.mood}\n` : '') +
      '-->\n\n'
    : ''

  const body = kept.map(b => `## ${b.name}\n${b.body}`).join('\n\n')

  return fm + intro + body + '\n'
}

export function buildStoryboardMarkdown(input: Pick<BuildInput, 'name' | 'slug' | 'shots'>): string {
  const pack: Pack = {
    frontmatter: {
      title: input.name,
      slug: input.slug,
      active_provider: 'seedream',
      variations_default: 1,
      budget_project: 20,
      budget_currency: 'GBP',
    },
    blocks: [],
    shots: input.shots,
  }
  return serialiseStoryboard(pack)
}

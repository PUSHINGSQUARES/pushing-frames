import YAML from 'yaml'

export function splitLegacyPack(raw: string): { style: string; storyboard: string } {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!fmMatch) throw new Error('legacy pack: no frontmatter')
  const [, yamlText, body] = fmMatch
  const fm = YAML.parse(yamlText) as Record<string, unknown>

  const shotsSplit = body.split(/^#\s+Shots\s*$/m)
  const blocksBody = shotsSplit[0].trim()
  const shotsBody = shotsSplit[1] ? `# Shots\n${shotsSplit[1].trim()}` : '# Shots\n'

  const styleFrontmatter = { title: `${fm.title ?? 'Legacy Style'} — migrated`, author: 'migrated' }
  const storyboardFrontmatter = {
    title: fm.title ?? 'Migrated Project',
    slug: fm.slug ?? 'migrated',
    active_provider: fm.active_provider ?? 'seedream',
    variations_default: 1,
    budget_project: fm.budget_project ?? 10,
    budget_currency: 'GBP',
    style_ref: './style.md',
  }

  return {
    style: `---\n${YAML.stringify(styleFrontmatter).trimEnd()}\n---\n\n${blocksBody}\n`,
    storyboard: `---\n${YAML.stringify(storyboardFrontmatter).trimEnd()}\n---\n\n${shotsBody}\n`,
  }
}

import YAML from 'yaml'
import type { Pack } from './types'

// Only storyboard.md is app-authored. Style is read-only.
export function serialiseStoryboard(pack: Pack): string {
  const body: string[] = []
  body.push('# Shots\n')
  body.push('| Shot | Provider | Model | Camera | Lens | Aspect | Action | Refs | Style | Neg | Mode | Duration |')
  body.push('|------|----------|-------|--------|------|--------|--------|------|-------|-----|------|----------|')
  for (const s of pack.shots) {
    body.push(`| ${s.slug} | ${s.provider ?? ''} | ${s.model ?? ''} | ${s.camera ?? ''} | ${s.lens ?? ''} | ${s.aspect ?? ''} | ${s.action} | ${s.refs.join(', ')} | ${s.styleBlocks.join(', ')} | ${s.negBlocks.join(', ')} | ${s.video_mode ?? ''} | ${s.duration_sec ?? ''} |`)
  }
  const yamlText = YAML.stringify(pack.frontmatter).trimEnd()
  return `---\n${yamlText}\n---\n${body.join('\n')}`
}

// Legacy serialiser — kept so existing roundtrip tests pass
export function serialisePack(pack: Pack): string {
  const body: string[] = []
  for (const b of pack.blocks) body.push(`## ${b.name}\n${b.body}\n`)
  body.push('# Shots\n')
  body.push('| Shot | Camera | Lens | Aspect | Action | Refs | Style | Neg |')
  body.push('|------|--------|------|--------|--------|------|-------|-----|')
  for (const s of pack.shots) {
    body.push(`| ${s.slug} | ${s.camera ?? ''} | ${s.lens ?? ''} | ${s.aspect ?? ''} | ${s.action} | ${s.refs.join(', ')} | ${s.styleBlocks.join(', ')} | ${s.negBlocks.join(', ')} |`)
  }
  const yamlText = YAML.stringify(pack.frontmatter).trimEnd()
  return `---\n${yamlText}\n---\n${body.join('\n')}`
}

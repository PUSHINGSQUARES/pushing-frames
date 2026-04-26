import YAML from 'yaml'
import { FrontmatterSchema, StyleSchema, StoryboardFrontmatterSchema, ShotSchema, type Style, type Block, type Pack, type Shot, validatePack } from './types'

const HEADER_RE = /^##\s+([A-Z_][A-Z0-9_]*)\s*$/
const SHOT_HEADER_RE = /^#\s+Shots\s*$/
const NOTES_HEADER_RE = /^#\s+Notes\s*$/

function splitFrontmatter(raw: string): { data: unknown; content: string } {
  if (!raw.startsWith('---')) return { data: {}, content: raw }
  const rest = raw.replace(/^---\r?\n/, '')
  const closeIdx = rest.search(/\r?\n---\r?\n/)
  if (closeIdx === -1) return { data: {}, content: raw }
  return {
    data: YAML.parse(rest.slice(0, closeIdx)) ?? {},
    content: rest.slice(closeIdx).replace(/^\r?\n---\r?\n/, ''),
  }
}

export function parseStyle(raw: string): Style {
  const fm = splitFrontmatter(raw)
  const lines = fm.content.split('\n')
  const blocks: Block[] = []
  let notes = ''
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (NOTES_HEADER_RE.test(line)) {
      i++
      notes = lines.slice(i).join('\n').trim()
      break
    }
    const h = line.match(HEADER_RE)
    if (h) {
      const name = h[1]
      const body: string[] = []
      i++
      while (i < lines.length && !HEADER_RE.test(lines[i]) && !NOTES_HEADER_RE.test(lines[i])) {
        body.push(lines[i]); i++
      }
      blocks.push({ name, body: body.join('\n').trim() })
      continue
    }
    i++
  }
  return StyleSchema.parse({ frontmatter: fm.data, blocks, notes: notes || undefined })
}

export function parseStoryboard(raw: string): { frontmatter: ReturnType<typeof StoryboardFrontmatterSchema.parse>; shots: Shot[] } {
  const fm = splitFrontmatter(raw)
  const frontmatter = StoryboardFrontmatterSchema.parse(fm.data)
  const lines = fm.content.split('\n')
  const shots: Shot[] = []
  let i = 0
  let inShots = false

  while (i < lines.length) {
    const line = lines[i]
    if (SHOT_HEADER_RE.test(line)) { inShots = true; i++; continue }
    if (!inShots) { i++; continue }
    if (line.trim().startsWith('|')) {
      const header = line.split('|').map(s => s.trim()).filter(Boolean).map(s => s.toLowerCase())
      i++
      if (i < lines.length && lines[i].trim().startsWith('|')) i++
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].split('|').map(s => s.trim()).filter((_v, idx) => idx > 0 && idx <= header.length)
        const row = Object.fromEntries(header.map((h, idx) => [h, cells[idx] ?? '']))
        shots.push(ShotSchema.parse({
          slug: row['shot'],
          provider: row['provider'] || undefined,
          model: row['model'] || undefined,
          camera: row['camera'] || undefined,
          lens: row['lens'] || undefined,
          aspect: row['aspect'] || undefined,
          action: row['action'],
          refs: splitCsv(row['refs']),
          styleBlocks: splitCsv(row['style']),
          negBlocks: splitCsv(row['neg']),
          video_mode: (row['mode'] as 'i2v' | 't2v') || undefined,
          duration_sec: row['duration'] ? Number(row['duration']) : undefined,
        }))
        i++
      }
      break
    }
    i++
  }
  return { frontmatter, shots }
}

// Build the in-memory Pack from style + storyboard
export function buildPack(style: Style, storyboard: ReturnType<typeof parseStoryboard>): Pack {
  const pack = {
    frontmatter: storyboard.frontmatter,
    blocks: style.blocks,
    shots: storyboard.shots,
  }
  return validatePack(pack)
}

// Legacy single-file parser — kept for backward compatibility during migration
export function parsePack(raw: string): Pack {
  const fm = splitFrontmatter(raw)
  const frontmatter = FrontmatterSchema.parse(fm.data)
  const lines = fm.content.split('\n')

  const blocks: Block[] = []
  const shots: Shot[] = []
  let i = 0
  let inShots = false

  while (i < lines.length) {
    const line = lines[i]
    if (SHOT_HEADER_RE.test(line)) { inShots = true; i++; continue }

    if (!inShots) {
      const h = line.match(HEADER_RE)
      if (h) {
        const name = h[1]
        const bodyLines: string[] = []
        i++
        while (i < lines.length && !HEADER_RE.test(lines[i]) && !SHOT_HEADER_RE.test(lines[i])) {
          bodyLines.push(lines[i]); i++
        }
        blocks.push({ name, body: bodyLines.join('\n').trim() })
        continue
      }
      i++
      continue
    }

    // In shots section — parse markdown table
    if (line.trim().startsWith('|')) {
      const header = line.split('|').map(s => s.trim()).filter(Boolean)
      i++ // header row
      if (i < lines.length && lines[i].trim().startsWith('|')) i++ // separator
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].split('|').map(s => s.trim()).filter((_v, idx, _arr) => idx > 0 && idx <= header.length)
        const row = Object.fromEntries(header.map((h, idx) => [h.toLowerCase(), cells[idx] ?? '']))
        shots.push(ShotSchema.parse({
          slug: row['shot'],
          camera: row['camera'] || undefined,
          lens: row['lens'] || undefined,
          aspect: row['aspect'] || undefined,
          action: row['action'],
          refs: splitCsv(row['refs']),
          styleBlocks: splitCsv(row['style']),
          negBlocks: splitCsv(row['neg']),
        }))
        i++
      }
      break
    }
    i++
  }

  return { frontmatter, blocks, shots }
}

function splitCsv(v: string | undefined): string[] {
  if (!v) return []
  return v.split(',').map(s => s.trim()).filter(Boolean)
}

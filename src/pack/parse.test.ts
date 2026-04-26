import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { parsePack, parseStyle, parseStoryboard, buildPack } from './parse'
import { serialisePack } from './serialise'

const __filename = fileURLToPath(import.meta.url)
const __dir = dirname(__filename)
const minimal = readFileSync(join(__dir, '__fixtures__/minimal.md'), 'utf8')
const styleFixture = readFileSync(join(__dir, '__fixtures__/style.md'), 'utf8')
const storyboardFixture = readFileSync(join(__dir, '__fixtures__/storyboard.md'), 'utf8')

describe('parsePack (legacy)', () => {
  it('parses frontmatter', () => {
    const pack = parsePack(minimal)
    expect(pack.frontmatter.title).toBe('Test Pack')
    expect(pack.frontmatter.active_provider).toBe('seedream')
    expect(pack.frontmatter.budget_project).toBe(10)
  })

  it('parses body blocks', () => {
    const pack = parsePack(minimal)
    expect(pack.blocks.map(b => b.name)).toEqual(['STYLE_GUIDE', 'NEG_HUMAN'])
    expect(pack.blocks[0].body).toContain('Kodak Vision3')
  })

  it('parses shot table', () => {
    const pack = parsePack(minimal)
    expect(pack.shots).toHaveLength(1)
    const s = pack.shots[0]
    expect(s.slug).toBe('shot_one')
    expect(s.camera).toBe('ARRI 35')
    expect(s.refs).toEqual(['ref1.jpg'])
    expect(s.styleBlocks).toEqual(['STYLE_GUIDE'])
    expect(s.negBlocks).toEqual(['NEG_HUMAN'])
  })
})

describe('roundtrip (legacy)', () => {
  it('parse-serialise-parse is identity on the Pack object', () => {
    const pack1 = parsePack(minimal)
    const text = serialisePack(pack1)
    const pack2 = parsePack(text)
    expect(pack2).toEqual(pack1)
  })
})

describe('parseStyle', () => {
  it('parses frontmatter + blocks + notes', () => {
    const s = parseStyle(styleFixture)
    expect(s.frontmatter?.title).toBe('Test Style')
    expect(s.blocks.map(b => b.name)).toEqual(['STYLE_GUIDE', 'NEG_HUMAN'])
    expect(s.notes).toContain('Warm tones')
  })
})

describe('parseStoryboard', () => {
  it('parses frontmatter + shots with per-shot provider', () => {
    const { frontmatter, shots } = parseStoryboard(storyboardFixture)
    expect(frontmatter.variations_default).toBe(4)
    expect(shots).toHaveLength(1)
    expect(shots[0].provider).toBe('seedream')
    expect(shots[0].model).toBe('seedream-5-0-260128')
  })
})

describe('buildPack', () => {
  it('merges style blocks + storyboard shots', () => {
    const pack = buildPack(parseStyle(styleFixture), parseStoryboard(storyboardFixture))
    expect(pack.blocks).toHaveLength(2)
    expect(pack.shots).toHaveLength(1)
  })
})

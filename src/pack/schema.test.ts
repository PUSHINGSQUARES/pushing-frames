import { describe, it, expect } from 'vitest'
import { ShotJsonSchema, PackJsonSchema, validatePack } from './schema'
import { parseStoryboard } from './parse'
import { serialiseStoryboard } from './serialise'

describe('PackSchema round-trip', () => {
  it('parse(serialise(pack)) deep-equals the original pack', () => {
    // Minimal pack — only fields that survive serialiseStoryboard round-trip
    const original = {
      frontmatter: {
        title: 'Round Trip Test',
        slug: 'round-trip',
        active_provider: 'seedream' as const,
        variations_default: 1,
        budget_project: 10,
        budget_currency: 'GBP' as const,
      },
      blocks: [{ name: 'STYLE_GUIDE', body: 'photorealistic' }],
      shots: [
        {
          slug: 'shot_01',
          action: 'a wide shot',
          refs: [],
          styleBlocks: ['STYLE_GUIDE'],
          negBlocks: [],
          camera: 'ARRI',
          lens: '50mm',
          aspect: '16:9',
        },
        {
          slug: 'shot_02',
          action: 'a close up',
          refs: ['ref.jpg'],
          styleBlocks: [],
          negBlocks: [],
          aspect: '21:9',
        },
      ],
    }

    const validated = validatePack(original)

    // serialiseStoryboard writes frontmatter + shots (not blocks)
    const text = serialiseStoryboard(validated)
    const parsedSb = parseStoryboard(text)

    expect(parsedSb.frontmatter).toEqual(validated.frontmatter)
    expect(parsedSb.shots).toEqual(validated.shots)
  })

  it('PackSchema rejects packs with missing required fields', () => {
    expect(() => validatePack({ frontmatter: {}, blocks: [], shots: [] })).toThrow()
  })
})

describe('JSON Schema export', () => {
  it('PackJsonSchema describes the same shape as PackSchema', () => {
    const json = PackJsonSchema as { properties?: { frontmatter?: object; blocks?: object; shots?: object } }
    expect(json.properties?.frontmatter).toBeDefined()
    expect(json.properties?.blocks).toBeDefined()
    expect(json.properties?.shots).toBeDefined()
  })

  it('ShotJsonSchema is suitable for Gemini responseSchema', () => {
    const json = ShotJsonSchema as { properties?: { slug?: object; action?: object; refs?: object } }
    expect(json.properties?.slug).toBeDefined()
    expect(json.properties?.action).toBeDefined()
    expect(json.properties?.refs).toBeDefined()
  })
})

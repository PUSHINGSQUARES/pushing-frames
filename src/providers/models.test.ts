import { describe, it, expect } from 'vitest'
import { listModels, getDefaultModel } from './models'

describe('models', () => {
  it('lists models for seedream', () => {
    const m = listModels('seedream')
    expect(m.length).toBeGreaterThan(0)
    expect(m[0].id).toContain('seedream')
  })
  it('returns default model when present', () => {
    expect(getDefaultModel('seedream').id).toBe('seedream-5-0-260128')
  })
  it('finds gpt-image-2 as default openai-image model', () => {
    const m = getDefaultModel('openai-image')
    expect(m.id).toBe('gpt-image-2')
    expect(m.tier).toBe('high')
  })
  it('lists 6 openai-image models including new tiers', () => {
    const m = listModels('openai-image')
    expect(m.length).toBe(6)
    const ids = m.map(x => x.id)
    expect(ids).toContain('gpt-image-2')
    expect(ids).toContain('gpt-image-1-mini')
    expect(ids).toContain('chatgpt-image-latest')
  })
  it('lists 3 gemini-image models including new ones', () => {
    const m = listModels('gemini-image')
    expect(m.length).toBe(3)
    expect(m.map(x => x.id)).toContain('gemini-3-pro-image-preview')
    expect(m.map(x => x.id)).toContain('gemini-3.1-flash-image-preview')
  })
  it('lists 3 imagen models with default', () => {
    const m = listModels('imagen')
    expect(m.length).toBe(3)
    expect(getDefaultModel('imagen').id).toBe('imagen-4.0-generate-001')
  })
  it('imagen models expose allowed_resolutions', () => {
    const m = getDefaultModel('imagen')
    expect(m.allowed_resolutions).toBeDefined()
    expect(m.allowed_resolutions!.length).toBeGreaterThan(0)
    expect(m.allowed_resolutions).toContain('1024x1024')
  })
  it('gemini-image models are aspect-only (allowed_resolutions is ["auto"])', () => {
    const m = getDefaultModel('gemini-image')
    expect(m.allowed_resolutions).toEqual(['auto'])
  })
})

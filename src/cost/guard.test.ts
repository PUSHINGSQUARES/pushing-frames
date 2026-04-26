import { describe, it, expect, beforeEach } from 'vitest'
import { CostGuard } from './guard'

describe('CostGuard', () => {
  let g: CostGuard
  beforeEach(() => { g = new CostGuard({ singleGen: 2, project: 10, global: 50 }) })

  it('admits a gen under all caps', () => {
    expect(g.admit(0.5)).toEqual({ ok: true })
  })

  it('blocks single-gen over cap', () => {
    expect(g.admit(3)).toEqual({ ok: false, reason: 'singleGen', limit: 2 })
  })

  it('blocks when project total would exceed cap', () => {
    g.record(9)
    expect(g.admit(2)).toEqual({ ok: false, reason: 'project', limit: 10 })
  })

  it('resets project total', () => {
    g.record(9); g.resetProject()
    expect(g.admit(2)).toEqual({ ok: true })
  })
})

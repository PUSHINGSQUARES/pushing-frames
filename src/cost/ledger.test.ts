import { describe, it, expect } from 'vitest'
import { formatLedgerEntry } from './ledger'

describe('ledger', () => {
  it('formats a JSONL line with all fields', () => {
    const line = formatLedgerEntry({
      ts: '2026-04-24T19:00:00Z',
      provider: 'seedream',
      shot: 'paddock_awakening',
      costGBP: 0.04,
      durationMs: 3500,
      outputFile: 'generations/x.png',
    })
    expect(line.endsWith('\n')).toBe(true)
    const obj = JSON.parse(line)
    expect(obj.provider).toBe('seedream')
    expect(obj.costGBP).toBe(0.04)
  })
})

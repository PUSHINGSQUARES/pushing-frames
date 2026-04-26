export interface LedgerEntry {
  ts: string
  provider: string
  shot: string
  costGBP: number
  durationMs: number
  outputFile: string
}

export function formatLedgerEntry(e: LedgerEntry): string {
  return JSON.stringify(e) + '\n'
}

export interface Caps { singleGen: number; project: number; global: number }
export type Admit = { ok: true } | { ok: false; reason: 'singleGen' | 'project' | 'global'; limit: number }

export class CostGuard {
  private projectTotal = 0
  private globalTotal = 0
  private sessionTotal = 0
  constructor(private caps: Caps) {}

  admit(cost: number): Admit {
    if (cost > this.caps.singleGen) return { ok: false, reason: 'singleGen', limit: this.caps.singleGen }
    if (this.projectTotal + cost > this.caps.project) return { ok: false, reason: 'project', limit: this.caps.project }
    if (this.globalTotal + cost > this.caps.global) return { ok: false, reason: 'global', limit: this.caps.global }
    return { ok: true }
  }

  record(cost: number): void {
    this.projectTotal += cost
    this.globalTotal += cost
    this.sessionTotal += cost
  }

  snapshot() { return { project: this.projectTotal, global: this.globalTotal, session: this.sessionTotal } }

  resetSession() { this.sessionTotal = 0 }
  resetProject() { this.projectTotal = 0; this.sessionTotal = 0 }
  resetGlobal() { this.globalTotal = 0; this.projectTotal = 0; this.sessionTotal = 0 }
  setCaps(caps: Partial<Caps>) { this.caps = { ...this.caps, ...caps } }
}

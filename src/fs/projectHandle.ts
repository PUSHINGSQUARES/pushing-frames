export interface ProjectHandle {
  readonly dir: FileSystemDirectoryHandle  // underlying handle, exposed so callers (e.g. the guide in edit mode) can write directly
  readStyle(): Promise<{ text: string; source: 'project' | 'master' | 'none' }>
  readStoryboard(): Promise<string | null>
  writeStoryboard(contents: string): Promise<void>
  // legacy migration surface
  readLegacyPack(): Promise<string | null>
  writeMigratedStyle(contents: string): Promise<void>
  renameLegacyToBak(): Promise<void>
  // unchanged
  listRefs(): Promise<string[]>
  readRef(name: string): Promise<Blob>
  importRef(file: File): Promise<string>
  writeGeneration(filename: string, bytes: Uint8Array, mime: string): Promise<string>
  writeMeta(filename: string, json: object): Promise<void>
  appendLedger(line: string): Promise<void>
  listGenerations(): Promise<string[]>
  readGeneration(name: string): Promise<Blob>
  readGenerationMeta(name: string): Promise<Record<string, unknown> | null>
  deleteGeneration(name: string): Promise<void>
}

export async function openProject(): Promise<ProjectHandle> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dir: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
  return wrapHandle(dir)
}

export function wrapHandle(dir: FileSystemDirectoryHandle): ProjectHandle {
  async function eachEntry(dh: FileSystemDirectoryHandle): Promise<FileSystemHandle[]> {
    // Default async iterator on FileSystemDirectoryHandle is .entries() per spec,
    // which yields [name, handle] tuples — not handles. Use .values() explicitly
    // so callers can read .kind / .name on each result.
    const out: FileSystemHandle[] = []
    for await (const handle of dh.values()) out.push(handle)
    return out
  }

  return {
    dir,
    async readStyle() {
      try {
        const f = await dir.getFileHandle('style.md')
        return { text: await (await f.getFile()).text(), source: 'project' as const }
      } catch { return { text: '', source: 'none' as const } }
    },
    async readStoryboard() {
      try {
        const f = await dir.getFileHandle('storyboard.md')
        return (await f.getFile()).text()
      } catch { return null }
    },
    async writeStoryboard(contents) {
      const f = await dir.getFileHandle('storyboard.md', { create: true })
      const w = await f.createWritable(); await w.write(contents); await w.close()
    },
    async readLegacyPack() {
      try {
        const f = await dir.getFileHandle('pack.md')
        return (await f.getFile()).text()
      } catch { return null }
    },
    async writeMigratedStyle(contents) {
      const f = await dir.getFileHandle('style.md', { create: true })
      const w = await f.createWritable(); await w.write(contents); await w.close()
    },
    async renameLegacyToBak() {
      // FSA doesn't support rename directly; copy to .bak and remove original
      try {
        const src = await dir.getFileHandle('pack.md')
        const srcBlob = await src.getFile()
        const dst = await dir.getFileHandle('pack.md.bak', { create: true })
        const w = await dst.createWritable(); await w.write(srcBlob); await w.close()
        await dir.removeEntry('pack.md')
      } catch { /* swallow; migration has already succeeded */ }
    },
    async listRefs() {
      const refsDir = await dir.getDirectoryHandle('refs', { create: true })
      const names: string[] = []
      for (const entry of await eachEntry(refsDir)) {
        // Skip macOS AppleDouble companions (._*) and dotfiles (.DS_Store etc.)
        if (entry.kind === 'file' && !entry.name.startsWith('.')) names.push(entry.name)
      }
      return names
    },
    async readRef(name) {
      const refsDir = await dir.getDirectoryHandle('refs')
      const f = await refsDir.getFileHandle(name)
      return f.getFile()
    },
    async importRef(file) {
      const refsDir = await dir.getDirectoryHandle('refs', { create: true })
      const f = await refsDir.getFileHandle(file.name, { create: true })
      const w = await f.createWritable(); await w.write(await file.arrayBuffer()); await w.close()
      return file.name
    },
    async writeGeneration(filename, bytes, mime) {
      const gens = await dir.getDirectoryHandle('generations', { create: true })
      const f = await gens.getFileHandle(filename, { create: true })
      const w = await f.createWritable(); await w.write(new Blob([bytes.buffer as ArrayBuffer], { type: mime })); await w.close()
      return `generations/${filename}`
    },
    async writeMeta(filename, json) {
      const gens = await dir.getDirectoryHandle('generations', { create: true })
      const f = await gens.getFileHandle(filename, { create: true })
      const w = await f.createWritable(); await w.write(JSON.stringify(json, null, 2)); await w.close()
    },
    async appendLedger(line) {
      const f = await dir.getFileHandle('cost.jsonl', { create: true })
      const existing = await (await f.getFile()).text().catch(() => '')
      const w = await f.createWritable(); await w.write(existing + line); await w.close()
    },
    async listGenerations() {
      const gens = await dir.getDirectoryHandle('generations', { create: true })
      const names: string[] = []
      for (const e of await eachEntry(gens)) {
        // Skip macOS AppleDouble companions (._*) that ExFAT drives accumulate,
        // and the metadata sidecars — we want image/video outputs only.
        if (e.kind === 'file' && !e.name.startsWith('._') && !e.name.endsWith('.meta.json')) {
          names.push(e.name)
        }
      }
      return names.sort().reverse()  // newest first
    },
    async readGeneration(name) {
      const gens = await dir.getDirectoryHandle('generations')
      const f = await gens.getFileHandle(name)
      return f.getFile()
    },
    async readGenerationMeta(name) {
      const metaName = name.replace(/\.[^.]+$/, '.meta.json')
      try {
        const gens = await dir.getDirectoryHandle('generations')
        const f = await gens.getFileHandle(metaName)
        return JSON.parse(await (await f.getFile()).text())
      } catch { return null }
    },
    async deleteGeneration(name) {
      const gens = await dir.getDirectoryHandle('generations')
      await gens.removeEntry(name)
      // Remove sidecar best-effort — absent sidecar is fine.
      const metaName = name.replace(/\.[^.]+$/, '.meta.json')
      try { await gens.removeEntry(metaName) } catch { /* no sidecar */ }
    },
  }
}

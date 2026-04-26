import type { Pack } from './types'

export function cascade(master: Pack | null, project: Pack): Pack {
  if (!master) return project
  const blockMap = new Map<string, string>()
  for (const b of master.blocks) blockMap.set(b.name, b.body)
  for (const b of project.blocks) blockMap.set(b.name, b.body)
  return {
    frontmatter: project.frontmatter,
    blocks: Array.from(blockMap, ([name, body]) => ({ name, body })),
    shots: project.shots,
  }
}

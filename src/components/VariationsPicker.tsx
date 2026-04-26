import { useStore, store } from '@/state/store'

export function VariationsPicker() {
  const pack = useStore(s => s.pack)
  const slug = useStore(s => s.activeShotSlug)
  if (!pack || !slug) return null
  const shot = pack.shots.find(s => s.slug === slug)
  if (!shot) return null
  const value = shot.variations ?? pack.frontmatter.variations_default ?? 1

  return (
    <>
      <span className="text-chalk text-xs uppercase">variations</span>
      <select
        value={value}
        onChange={e => store.updateShot(slug, { variations: Number(e.target.value) })}
        className="bg-transparent border border-hairline rounded-md p-1 text-xs"
      >
        {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n} className="bg-void">{n}</option>)}
      </select>
    </>
  )
}

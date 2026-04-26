import { listModels, type ModelInfo } from '@/providers/models'
import type { AdapterId } from '@/providers/vendors'

export function ModelPicker({ adapter, value, onChange }: {
  adapter: AdapterId
  value?: string
  onChange: (m: ModelInfo) => void
}) {
  const models = listModels(adapter)
  if (models.length === 0) return <span className="text-smoke text-xs">no models</span>
  return (
    <select
      className="bg-transparent border border-hairline rounded-md p-1 text-xs"
      value={value ?? models.find(m => m.default)?.label ?? models[0].label}
      onChange={e => {
        const m = models.find(x => x.label === e.target.value)
        if (m) onChange(m)
      }}
    >
      {models.map(m => <option key={m.label} className="bg-void text-mist">{m.label}</option>)}
    </select>
  )
}

import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface ShotCardProps {
  id: string
  active?: boolean        // draws the active-highlight border
  status?: 'queued' | 'running' | 'done' | 'failed'
  onClick?: () => void
  children?: ReactNode    // right-side actions slot — context-specific buttons
}

export function ShotCard({ id, active, status, onClick, children }: ShotCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const dot = status === 'running' ? 'bg-mist animate-pulse'
    : status === 'done' ? 'bg-green-400'
    : status === 'failed' ? 'bg-red-400'
    : status === 'queued' ? 'bg-amber-400'
    : 'bg-smoke/30'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs ${active ? 'bg-mist text-void border-mist' : 'border-hairline text-smoke'}`}
    >
      {/* Drag handle — small grip area on the left, listeners attach here */}
      <button
        {...attributes}
        {...listeners}
        aria-label={`Drag ${id}`}
        className="cursor-grab active:cursor-grabbing px-1 text-smoke"
      >⋮⋮</button>
      <button onClick={onClick} className="flex items-center gap-1.5 flex-1 text-left">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {id}
      </button>
      {children}
    </div>
  )
}

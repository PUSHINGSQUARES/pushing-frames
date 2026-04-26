import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  shape?: 'pill' | 'card'
  className?: string
}

export function GlassPill({ children, shape = 'card', className = '' }: Props) {
  const shapeClass = shape === 'pill' ? 'glass-pill px-4 py-2' : 'glass-card p-4'
  return <div className={`glass ${shapeClass} ${className}`}>{children}</div>
}

import { useState, useEffect } from 'react'
import { costGuard } from '@/state/services'

export function CostGuardView() {
  const [snap, setSnap] = useState(costGuard.snapshot())
  useEffect(() => {
    const id = setInterval(() => setSnap(costGuard.snapshot()), 500)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="glass glass-pill px-3 py-1.5 text-xs font-mono flex gap-4">
      <span>session £{snap.session.toFixed(2)}</span>
      <span>project £{snap.project.toFixed(2)}</span>
      <span>global £{snap.global.toFixed(2)}</span>
    </div>
  )
}

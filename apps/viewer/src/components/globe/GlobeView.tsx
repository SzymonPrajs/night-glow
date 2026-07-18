'use client'

import { useEffect } from 'react'
import { useAppState } from '../shell/app-state.tsx'
import { EMPTY_STATUS } from '../../lib/status/model.ts'

// Temporary placeholder — replaced by the MapLibre Globe engine in Phase 2.
export default function GlobeView() {
  const { setRuntime, setScience, setInspectorData } = useAppState()
  useEffect(() => {
    setRuntime(EMPTY_STATUS)
    setScience({ fidelity: 'synthetic fixture slice' })
    setInspectorData(null)
  }, [setRuntime, setScience, setInspectorData])
  return (
    <main className="viewPlaceholder">
      <p role="status">Globe engine is being installed…</p>
    </main>
  )
}

'use client'

import { useEffect } from 'react'
import { useAppState } from '../shell/app-state.tsx'
import { EMPTY_STATUS } from '../../lib/status/model.ts'

// Temporary placeholder — replaced by the WebGL2 Sky engine in Phase 3.
export default function ObserveView() {
  const { setRuntime, setScience, setInspectorData } = useAppState()
  useEffect(() => {
    setRuntime(EMPTY_STATUS)
    setScience({ fidelity: 'synthetic fixture slice' })
    setInspectorData(null)
  }, [setRuntime, setScience, setInspectorData])
  return (
    <main className="viewPlaceholder">
      <p role="status">Sky engine is being installed…</p>
    </main>
  )
}

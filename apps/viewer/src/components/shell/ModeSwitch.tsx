'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import styles from './shell.module.css'
import {
  buildGlobeQuery,
  buildObserveQuery,
  parseGlobeState,
  parseObserveState,
} from '../../lib/scenario/url-state.ts'

// The Globe/Sky mode switch. Shared scenario parameters (position, time) are
// carried across so switching mode never changes the question being asked.
export default function ModeSwitch() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const active: 'globe' | 'sky' = pathname.startsWith('/observe') ? 'sky' : 'globe'

  const go = (mode: 'globe' | 'sky') => {
    if (mode === active) return
    if (mode === 'sky') {
      const state = parseObserveState(searchParams)
      router.push(`/observe?${buildObserveQuery(state).toString()}`)
    } else {
      const state = parseGlobeState(searchParams)
      router.push(`/globe?${buildGlobeQuery(state).toString()}`)
    }
  }

  return (
    <div className={styles.modeSwitch} role="group" aria-label="View mode">
      <button
        type="button"
        className={`${styles.modeSegment} ${active === 'globe' ? styles.modeSegmentActive : ''}`}
        aria-current={active === 'globe' ? 'page' : undefined}
        onClick={() => go('globe')}
      >
        Globe
      </button>
      <button
        type="button"
        className={`${styles.modeSegment} ${active === 'sky' ? styles.modeSegmentActive : ''}`}
        aria-current={active === 'sky' ? 'page' : undefined}
        onClick={() => go('sky')}
      >
        Sky
      </button>
    </div>
  )
}

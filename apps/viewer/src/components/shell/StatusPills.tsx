'use client'

import { useAppState } from './app-state.tsx'
import { runtimeLabel } from '../../lib/status/model.ts'
import styles from './shell.module.css'

// Two deliberately distinct indicators: how the runtime is doing (computing,
// current, failed) and what the science is (fidelity, atmosphere selection).
// They must never read as one status.
export default function StatusPills() {
  const { runtime, science } = useAppState()
  const failed = runtime.kind === 'failed' || runtime.kind === 'stale-error'
  const scienceText = science.fidelity
    ? `${science.fidelity}${science.atmosphereLabel ? ` · ${science.atmosphereLabel}` : ''}`
    : 'no product yet'

  return (
    <div className={styles.pills}>
      <span
        className={failed ? styles.pillRuntimeFailed : styles.pillRuntime}
        role="status"
        aria-live="polite"
        aria-label={`Runtime status: ${runtimeLabel(runtime)}`}
      >
        <span className={styles.pillDot} aria-hidden />
        {runtimeLabel(runtime)}
      </span>
      <span
        className={styles.pillScience}
        title="Scientific fidelity and atmosphere selection"
        aria-label={`Scientific status: ${scienceText}`}
      >
        {scienceText}
      </span>
    </div>
  )
}

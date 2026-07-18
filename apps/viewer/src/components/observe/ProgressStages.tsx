'use client'

// Staged progress for a running scenario, using the real coordinator stage
// names. Honest progress: stages the coordinator has reported, nothing more.
import type { ProgressStage } from '../../lib/contracts/types.ts'
import styles from './observe.module.css'

const STAGES: { id: ProgressStage; label: string }[] = [
  { id: 'resolve_inputs', label: 'resolve inputs' },
  { id: 'load_environment', label: 'load environment' },
  { id: 'solve_transfer', label: 'solve transfer' },
  { id: 'publish_products', label: 'publish products' },
]

export default function ProgressStages({
  stage,
  completed,
}: {
  stage: ProgressStage | null
  completed: number
}) {
  const activeIndex = stage ? STAGES.findIndex((entry) => entry.id === stage) : -1
  return (
    <div className={styles.progress} role="status" aria-label="Computation progress">
      <ol className={styles.progressList}>
        {STAGES.map((entry, index) => (
          <li
            key={entry.id}
            className={`${styles.progressStep} ${
              index < activeIndex
                ? styles.progressDone
                : index === activeIndex
                  ? styles.progressActive
                  : ''
            }`}
          >
            {entry.label}
          </li>
        ))}
      </ol>
      <div className={styles.progressTrack} aria-hidden>
        <div className={styles.progressFill} style={{ width: `${Math.round(completed * 100)}%` }} />
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { formatLocalWithOffset, formatUtc } from '../../lib/format.ts'
import styles from './observe.module.css'

const HOUR_MS = 3_600_000

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * HOUR_MS).toISOString().replace(/\.000Z$/, 'Z')
}

// Committed-time controls for the Sky view. Buttons and the Now action commit
// immediately (new scenario); the scrub slider previews and commits on
// release. Preview state is always labelled.
export default function TimeBar({
  committedTimeUtc,
  onCommit,
}: {
  committedTimeUtc: string
  onCommit: (iso: string) => void
}) {
  const [previewOffsetHours, setPreviewOffsetHours] = useState<number | null>(null)
  const [lastCommitted, setLastCommitted] = useState(committedTimeUtc)

  // Reset the scrub window whenever a new time commits (render-time adjustment).
  if (lastCommitted !== committedTimeUtc) {
    setLastCommitted(committedTimeUtc)
    setPreviewOffsetHours(null)
  }

  const previewIso =
    previewOffsetHours === null ? null : addHours(committedTimeUtc, previewOffsetHours)

  return (
    <div className={styles.timeBar} aria-label="Observation time controls">
      <div className={styles.timeButtons}>
        <button
          type="button"
          className={styles.timeButton}
          onClick={() => onCommit(addHours(committedTimeUtc, -1))}
          aria-label="One hour earlier"
        >
          −1h
        </button>
        <div className={styles.timeReadout}>
          <span className="mono">{formatLocalWithOffset(previewIso ?? committedTimeUtc)}</span>
          {previewIso ? (
            <span className={styles.previewBadge}>preview — release to compute</span>
          ) : (
            <span className={styles.timeBasis}>local · stored as UTC</span>
          )}
        </div>
        <button
          type="button"
          className={styles.timeButton}
          onClick={() => onCommit(addHours(committedTimeUtc, 1))}
          aria-label="One hour later"
        >
          +1h
        </button>
        <button
          type="button"
          className={styles.timeButton}
          onClick={() => onCommit(new Date().toISOString().replace(/\.000Z$/, 'Z'))}
        >
          Now
        </button>
      </div>
      <input
        type="range"
        className={styles.timeScrub}
        min={-24}
        max={24}
        step={1}
        value={previewOffsetHours ?? 0}
        aria-label={`Scrub time around ${formatUtc(committedTimeUtc)}, plus or minus 24 hours`}
        onChange={(event) => setPreviewOffsetHours(Number(event.target.value))}
        onPointerUp={() => {
          if (previewIso && previewOffsetHours !== 0) onCommit(previewIso)
          else setPreviewOffsetHours(null)
        }}
        onKeyUp={(event) => {
          if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && previewIso) {
            onCommit(previewIso)
          }
        }}
      />
    </div>
  )
}

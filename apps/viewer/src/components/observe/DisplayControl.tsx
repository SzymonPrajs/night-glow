'use client'

import { useEffect, useState } from 'react'
import styles from './observe.module.css'

// Display-only controls: relative exposure and a subtle enhancement lift.
// These act on the retained HDR product in the renderer and never start a
// computation — the label says so, always.
export default function DisplayControl({
  exposureStops,
  enhance,
  onExposureChange,
  onEnhanceChange,
}: {
  exposureStops: number
  enhance: number
  onExposureChange: (stops: number) => void
  onEnhanceChange: (value: number) => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className={styles.displayAnchor}>
      <button
        type="button"
        className={styles.chromeButton}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Display
      </button>
      {open ? (
        <div className={styles.displayPanel} role="dialog" aria-label="Display settings">
          <p className={styles.panelTitle}>Display</p>
          <label className={styles.sliderRow}>
            <span>Exposure</span>
            <input
              type="range"
              min={-8}
              max={8}
              step={0.1}
              value={exposureStops}
              aria-label={`Exposure, ${exposureStops.toFixed(1)} stops relative to product normalization`}
              onChange={(event) => onExposureChange(Number(event.target.value))}
            />
            <span className="mono">{exposureStops >= 0 ? '+' : ''}{exposureStops.toFixed(1)}</span>
          </label>
          <label className={styles.sliderRow}>
            <span>Enhance</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={enhance}
              aria-label={`Enhancement, ${Math.round(enhance * 100)} percent`}
              onChange={(event) => onEnhanceChange(Number(event.target.value))}
            />
            <span className="mono">{Math.round(enhance * 100)}%</span>
          </label>
          <div className={styles.displayFooter}>
            <button
              type="button"
              className={styles.resetButton}
              onClick={() => {
                onExposureChange(0)
                onEnhanceChange(0)
              }}
            >
              Reset
            </button>
          </div>
          <p className={styles.displayNote}>
            Display only — radiance is normalized to the product maximum on load; these controls
            never change the computed sky.
          </p>
        </div>
      ) : null}
    </div>
  )
}

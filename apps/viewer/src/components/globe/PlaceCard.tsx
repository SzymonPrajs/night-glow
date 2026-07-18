'use client'

import { formatLatLon, formatValue } from '../../lib/format.ts'
import styles from './globe.module.css'

export interface PlaceCardData {
  latitudeDeg: number
  longitudeDeg: number
  /** Position within the map container, for anchoring the card. */
  point: { x: number; y: number }
  quantityLabel: string
  value: number | null
  unit: string
  validity: string
  coverageStatus: string | null
  releaseId: string
}

function validityLabel(data: PlaceCardData): string {
  if (data.coverageStatus === 'supported_dark_or_upper_bound') return 'supported dark / upper bound'
  return data.validity.replace(/_/g, ' ')
}

// Preview-pin card: the typed sample at a picked point plus the action that
// commits it as an observer scenario. Picking never mutates the URL.
export default function PlaceCard({
  data,
  onEnterSky,
  onClose,
}: {
  data: PlaceCardData
  onEnterSky: () => void
  onClose: () => void
}) {
  const copyCoordinates = async () => {
    const text = `${data.latitudeDeg.toFixed(6)}, ${data.longitudeDeg.toFixed(6)}`
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard unavailable; the coordinates remain visible for manual copy.
    }
  }

  return (
    <section
      className={styles.placeCard}
      style={{ left: data.point.x, top: data.point.y }}
      aria-label="Picked location"
    >
      <header className={styles.placeCardHeader}>
        <h3 className={styles.placeCardTitle}>Preview location</h3>
        <button type="button" className={styles.placeCardClose} onClick={onClose} aria-label="Close place card">
          ×
        </button>
      </header>
      <p className={`${styles.placeCardCoords} mono`}>{formatLatLon(data.latitudeDeg, data.longitudeDeg)}</p>
      <p className={styles.placeCardQuantity}>{data.quantityLabel}</p>
      <dl className={styles.placeCardList}>
        <dt>Value</dt>
        <dd className="mono">{data.value === null ? '—' : formatValue(data.value, data.unit)}</dd>
        <dt>Validity</dt>
        <dd>{validityLabel(data)}</dd>
        <dt>Source release</dt>
        <dd className="mono">{data.releaseId}</dd>
      </dl>
      <div className={styles.placeCardActions}>
        <button type="button" className={styles.enterSky} onClick={onEnterSky}>
          Enter sky here
        </button>
        <button type="button" className={styles.secondaryAction} onClick={copyCoordinates}>
          Copy
        </button>
      </div>
    </section>
  )
}

'use client'

import type { EnvironmentDisplayProduct } from '../../lib/contracts/types.ts'
import type { Ramp } from './grid.ts'
import { formatUtc, formatValue } from '../../lib/format.ts'
import styles from './globe.module.css'

export interface LegendModel {
  product: EnvironmentDisplayProduct
  ramp: Ramp
  /** Atmosphere selection valid time, when the product carries one. */
  validTimeUtc?: string
}

function shortLabel(product: EnvironmentDisplayProduct): string {
  if (product.source_domain === 'emission') return 'Light emission'
  if (product.quantity.includes('pressure')) return 'Surface pressure'
  return product.quantity
}

function description(product: EnvironmentDisplayProduct): string {
  if (product.source_domain === 'emission') {
    return 'DNB-band directional radiance, exact source cells'
  }
  if (product.vertical_selection) {
    return `Atmosphere at ${product.vertical_selection.value} ${product.vertical_selection.unit}`
  }
  return product.quantity
}

// Layer stack: one row per display product (single active layer for picking
// and legend), the active layer's legend, and display-state toggles.
export default function LayerDock({
  products,
  activeId,
  onSelect,
  legend,
  haloSupported,
  halo,
  onHaloChange,
  inspection,
  onInspectionChange,
  timeNote,
}: {
  products: EnvironmentDisplayProduct[]
  activeId: string
  onSelect: (id: string) => void
  legend: LegendModel | null
  haloSupported: boolean
  halo: boolean
  onHaloChange: (on: boolean) => void
  inspection: boolean
  onInspectionChange: (on: boolean) => void
  timeNote: string | null
}) {
  const gradient = legend
    ? `linear-gradient(90deg, ${legend.ramp.stops.map(([t, c]) => `${c} ${Math.round(t * 100)}%`).join(', ')})`
    : undefined

  return (
    <aside className={styles.dock} aria-label="Layers and legend">
      <h2 className={styles.dockTitle}>Layers</h2>
      <div className={styles.layerList} role="radiogroup" aria-label="Active layer">
        {products.map((product) => (
          <button
            key={product.environment_display_product_id}
            type="button"
            role="radio"
            aria-checked={product.environment_display_product_id === activeId}
            className={`${styles.layerRow} ${
              product.environment_display_product_id === activeId ? styles.layerRowActive : ''
            }`}
            onClick={() => onSelect(product.environment_display_product_id)}
          >
            <span
              className={`${styles.domainBadge} ${
                product.source_domain === 'emission' ? styles.domainEmission : styles.domainAtmosphere
              }`}
            >
              {product.source_domain === 'emission' ? 'Emission' : 'Atmosphere'}
            </span>
            <span className={styles.layerName}>{shortLabel(product)}</span>
            <span className={`${styles.layerUnit} mono`}>{product.unit}</span>
          </button>
        ))}
      </div>

      {legend ? (
        <section className={styles.legend} aria-label="Legend">
          <h3 className={styles.legendTitle}>{shortLabel(legend.product)}</h3>
          <p className={styles.legendDescription}>{description(legend.product)}</p>
          <div className={styles.legendRamp} style={{ background: gradient }} aria-hidden />
          <div className={styles.legendScale}>
            <span className="mono">{legend.ramp.domainLabel}</span>
          </div>
          <p className={styles.legendNote}>
            Normalization: {legend.ramp.normalizationLabel}. Colour shows {legend.product.quantity}{' '}
            in {legend.product.unit}
            {legend.product.aggregation ? `, aggregated as ${legend.product.aggregation}` : ''}.
          </p>
          <p className={styles.legendNote}>
            Outlines: solid = valid · dashed = supported dark/upper bound · dotted =
            missing/censored/masked.
          </p>
          {legend.product.source_domain === 'atmosphere' && legend.validTimeUtc ? (
            <p className={styles.legendNote}>
              Standard scenario · valid <span className="mono">{formatUtc(legend.validTimeUtc)}</span>.
            </p>
          ) : null}
        </section>
      ) : null}

      <div className={styles.toggles}>
        {haloSupported ? (
          <label className={styles.toggleRow}>
            <input type="checkbox" checked={halo} onChange={(event) => onHaloChange(event.target.checked)} />
            Emphasis halo <span className={styles.toggleHint}>(display only)</span>
          </label>
        ) : null}
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={inspection}
            onChange={(event) => onInspectionChange(event.target.checked)}
          />
          Cell boundaries <span className={styles.toggleHint}>(inspection)</span>
        </label>
      </div>

      {timeNote ? (
        <p className={styles.timeNote} role="note">
          {timeNote}
        </p>
      ) : null}
    </aside>
  )
}

export function legendValueLabel(value: number, unit: string): string {
  return formatValue(value, unit)
}

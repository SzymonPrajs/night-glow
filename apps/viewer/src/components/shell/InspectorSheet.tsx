'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppState, type InspectorTab } from './app-state.tsx'
import { loadFixtureManifest, type FixtureManifest } from '../../lib/fixtures/client.ts'
import { formatUtc } from '../../lib/format.ts'
import styles from './shell.module.css'

const TABS: { id: InspectorTab; label: string }[] = [
  { id: 'products', label: 'Products' },
  { id: 'computation', label: 'Computation' },
  { id: 'provenance', label: 'Provenance' },
]

function EmptyState({ children }: { children: string }) {
  return <p className={styles.emptyState}>{children}</p>
}

function Definition({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{term}</dt>
      <dd className="mono">{children}</dd>
    </>
  )
}

// One action away from anywhere: the scientific inspector. It separates
// runtime availability, input evidence/validity and numerical fidelity, and
// lists the four resolutions independently.
export default function InspectorSheet() {
  const { inspectorOpen, inspectorTab, closeInspector, setInspectorTab, inspectorData } = useAppState()
  const [manifest, setManifest] = useState<FixtureManifest | null>(null)
  const sheetRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!inspectorOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeInspector()
    }
    window.addEventListener('keydown', onKeyDown)
    sheetRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [inspectorOpen, closeInspector])

  useEffect(() => {
    if (!inspectorOpen || inspectorTab !== 'provenance' || manifest) return
    let cancelled = false
    loadFixtureManifest()
      .then((loaded) => !cancelled && setManifest(loaded))
      .catch(() => !cancelled && setManifest(null))
    return () => {
      cancelled = true
    }
  }, [inspectorOpen, inspectorTab, manifest])

  if (!inspectorOpen) return null

  const { scenario, product, capabilities, stageTimings, failure, resolutions, environmentDisplay } =
    inspectorData ?? {}

  const download = () => {
    if (!scenario) return
    const payload = {
      scenario,
      product: product
        ? { ...product, values: Array.from(product.values) }
        : null,
      note: 'Synthetic contract fixture slice — not a calibrated sky prediction.',
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `nightglow-scenario-rev${scenario.scenario_revision}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <button type="button" className={styles.backdrop} aria-label="Close inspector" onClick={closeInspector} />
      <aside
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Scientific inspector"
        ref={sheetRef}
        tabIndex={-1}
      >
        <div className={styles.sheetHeader}>
          <h2 className={styles.sheetTitle}>Inspector</h2>
          <div className={styles.tabs} role="tablist" aria-label="Inspector sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={inspectorTab === tab.id}
                className={`${styles.tab} ${inspectorTab === tab.id ? styles.tabActive : ''}`}
                onClick={() => setInspectorTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button type="button" className={styles.button} onClick={closeInspector} aria-label="Close inspector">
            Close
          </button>
        </div>
        <div className={styles.sheetBody}>
          {inspectorTab === 'products' ? (
            <>
              {environmentDisplay ? (
                <>
                  <h3 className={styles.sectionTitle}>
                    Environment display products ({environmentDisplay.schemaRevision})
                  </h3>
                  {environmentDisplay.products.map((displayProduct) => (
                    <dl key={displayProduct.environment_display_product_id} className={styles.definitionList} style={{ marginBottom: 16 }}>
                      <Definition term="Product">{displayProduct.environment_display_product_id}</Definition>
                      <Definition term="Build revision">{displayProduct.environment_display_build_revision}</Definition>
                      <Definition term="Source">{displayProduct.source_release_id}</Definition>
                      <Definition term="Quantity">{displayProduct.quantity}</Definition>
                      <Definition term="Unit">{displayProduct.unit}</Definition>
                      <Definition term="Shape">
                        {displayProduct.shape.join(' × ')} ({displayProduct.axis_order.join(' × ')})
                      </Definition>
                      {displayProduct.aggregation ? (
                        <Definition term="Aggregation">{displayProduct.aggregation}</Definition>
                      ) : null}
                      {displayProduct.vertical_selection ? (
                        <Definition term="Vertical selection">
                          {displayProduct.vertical_selection.quantity} = {displayProduct.vertical_selection.value}{' '}
                          {displayProduct.vertical_selection.unit}
                        </Definition>
                      ) : null}
                      <Definition term="Validity">
                        {displayProduct.data_validity.join(', ')}
                      </Definition>
                    </dl>
                  ))}
                </>
              ) : null}
              {scenario ? (
                <>
                <h3 className={styles.sectionTitle}>Scenario (revision {scenario.scenario_revision})</h3>
                <pre className={styles.pre}>{JSON.stringify(scenario, null, 2)}</pre>
                {product ? (
                  <>
                    <h3 className={styles.sectionTitle}>Observer render product</h3>
                    <dl className={styles.definitionList}>
                      <Definition term="Quantity">{product.quantity}</Definition>
                      <Definition term="Unit">{product.unit}</Definition>
                      <Definition term="Shape">
                        {product.shape.join(' × ')} (elevation × azimuth × linear RGB)
                      </Definition>
                      <Definition term="Component">{product.componentType}</Definition>
                      <Definition term="Barrier">{product.coherentBarrier}</Definition>
                      <Definition term="Fidelity">{product.fidelity}</Definition>
                      <Definition term="Convergence">
                        {product.convergence.status} (residual {product.convergence.relativeResidual})
                      </Definition>
                      <Definition term="Memory high water">{product.memoryHighWaterBytes} bytes</Definition>
                      <Definition term="Model revision">{product.physicsModelRevision}</Definition>
                      <Definition term="Data manifest">{product.physicsDataManifestId}</Definition>
                    </dl>
                  </>
                ) : null}
                {failure ? (
                  <>
                    <h3 className={styles.sectionTitle}>Last failure</h3>
                    <dl className={styles.definitionList}>
                      <Definition term="Category">{failure.category}</Definition>
                      <Definition term="Message">{failure.message}</Definition>
                    </dl>
                  </>
                ) : null}
              </>
              ) : null}
              {!scenario && !environmentDisplay ? (
                <EmptyState>Nothing computed yet — commit a scenario from the Sky view first.</EmptyState>
              ) : null}
            </>
          ) : null}

          {inspectorTab === 'computation' ? (
            capabilities ? (
              <>
                <h3 className={styles.sectionTitle}>Coordinator capabilities</h3>
                <dl className={styles.definitionList}>
                  <Definition term="Protocol">{capabilities.protocolRevision}</Definition>
                  <Definition term="Environment ABI">{capabilities.environmentAbiRevision}</Definition>
                  <Definition term="Physics ABI">{capabilities.physicsAbiRevision}</Definition>
                  <Definition term="Transferables">{capabilities.transferableBuffers ? 'yes' : 'no'}</Definition>
                  <Definition term="Wasm threads">{capabilities.wasmThreads ? 'yes' : 'no'}</Definition>
                  <Definition term="SharedArrayBuffer">{capabilities.sharedArrayBuffer ? 'yes' : 'no'}</Definition>
                </dl>
                {stageTimings && Object.keys(stageTimings).length > 0 ? (
                  <>
                    <h3 className={styles.sectionTitle}>Stage timings</h3>
                    <dl className={styles.definitionList}>
                      {Object.entries(stageTimings).map(([stage, ms]) => (
                        <Definition key={stage} term={stage}>
                          {ms!.toFixed(1)} ms
                        </Definition>
                      ))}
                    </dl>
                  </>
                ) : null}
                {resolutions ? (
                  <>
                    <h3 className={styles.sectionTitle}>Resolutions (kept separate)</h3>
                    <dl className={styles.definitionList}>
                      <Definition term="Environment source">{resolutions.environmentSource}</Definition>
                      <Definition term="Physics angular">{resolutions.physicsAngular}</Definition>
                      <Definition term="Render product">{resolutions.renderProduct}</Definition>
                      <Definition term="Canvas">{resolutions.canvas}</Definition>
                    </dl>
                  </>
                ) : null}
              </>
            ) : (
              <EmptyState>The coordinator has not run yet in this session.</EmptyState>
            )
          ) : null}

          {inspectorTab === 'provenance' ? (
            <>
              <h3 className={styles.sectionTitle}>Fixture provenance</h3>
              {manifest ? (
                <>
                  <dl className={styles.definitionList}>
                    <Definition term="Fixture revision">{manifest.fixture_revision}</Definition>
                    <Definition term="Licence">{manifest.license}</Definition>
                    <Definition term="Created">{formatUtc(manifest.created_utc)}</Definition>
                    <Definition term="Hash algorithm">{manifest.hash_algorithm}</Definition>
                  </dl>
                  <h3 className={styles.sectionTitle}>Content hashes</h3>
                  <ul className={styles.hashList}>
                    {Object.entries(manifest.files).map(([file, hash]) => (
                      <li key={file}>
                        {file} — {hash}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <EmptyState>Fixture manifest unavailable.</EmptyState>
              )}
              <h3 className={styles.sectionTitle}>Export</h3>
              <p style={{ color: 'var(--dim)', fontSize: 12 }}>
                Download the committed scenario and its render product, including every pinned
                release and model identity.
              </p>
              <button type="button" className={styles.button} onClick={download} disabled={!scenario}>
                Download scenario + result JSON
              </button>
            </>
          ) : null}
        </div>
      </aside>
    </>
  )
}

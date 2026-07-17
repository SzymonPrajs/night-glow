import { Layers3 } from 'lucide-react'
import type { PhysicalGlowAnalysisState } from '../hooks/usePhysicalGlow'
import { clamp } from '../lib/skyModel'

export type AnalysisPresentation = {
  state: 'initial' | 'loading' | 'updating' | 'live' | 'stale-error' | 'unavailable'
  label: string
  shortLabel: string
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'error'
  busy: boolean
}

type PhysicalAnalysisPanelProps = {
  physicalGlow: PhysicalGlowAnalysisState
  presentation: AnalysisPresentation
}

export default function PhysicalAnalysisPanel({ physicalGlow, presentation }: PhysicalAnalysisPanelProps) {
  return (
    <div className="analysis-block">
      <div className="analysis-title">
        <span><Layers3 size={15} /> Physical sky analysis</span>
        <DataStatus presentation={presentation} />
      </div>
      <SolverProgress physicalGlow={physicalGlow} presentation={presentation} />
      <SolverTimings physicalGlow={physicalGlow} />
      <div className="analysis-grid">
        <div><strong>{physicalGlow.emissionDiagnostics?.rings.length ?? 81}</strong><span>distance rings</span></div>
        <div><strong>{physicalGlow.result?.azimuthCount ?? 720}</strong><span>bearings</span></div>
        <div><strong>{physicalGlow.result?.elevationDeg.length ?? 22}</strong><span>adaptive elevations</span></div>
        <div><strong>{physicalGlow.result?.wavelengthsNm.length ?? 8}</strong><span>spectral bands</span></div>
      </div>
      <RadianceBreakdown physicalGlow={physicalGlow} />
      {physicalGlow.error && (
        <p className={`analysis-message ${physicalGlow.result ? 'warning' : 'error'}`} role="alert">
          {physicalGlow.error}
        </p>
      )}
    </div>
  )
}

function DataStatus({ presentation }: { presentation: AnalysisPresentation }) {
  return <span className={`data-status ${presentation.tone}`} title={presentation.label}><i />{presentation.shortLabel}</span>
}

function SolverProgress({
  physicalGlow,
  presentation,
}: {
  physicalGlow: PhysicalGlowAnalysisState
  presentation: AnalysisPresentation
}) {
  const progress = Math.round(clamp(physicalGlow.progress, 0, 100))
  const rows = [
    { label: 'Source grid', value: physicalGlow.components.emission * 100 },
    { label: 'Atmosphere kernel', value: physicalGlow.components.kernel * 100 },
    { label: 'Sky convolution', value: physicalGlow.components.propagation * 100 },
    { label: 'Numerical checks', value: physicalGlow.components.diagnostics * 100 },
  ]
  return (
    <div className={`analysis-progress ${presentation.tone}`}>
      <div className="analysis-progress-label">
        <span>{physicalGlow.stage}</span>
        <strong>{progress}%</strong>
      </div>
      <div
        className="analysis-progress-track"
        role="progressbar"
        aria-label="Physical sky analysis progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={physicalGlow.stage}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="analysis-progress-components" aria-label="Analysis component progress">
        {rows.map((row) => (
          <div key={row.label} className={row.value >= 99.5 ? 'complete' : row.value > 0 ? 'active' : ''}>
            <span>{row.label}</span>
            <i><b style={{ width: `${clamp(row.value, 0, 100)}%` }} /></i>
            <strong>{Math.round(row.value)}%</strong>
          </div>
        ))}
      </div>
      {physicalGlow.detail && <p className="analysis-progress-detail">{physicalGlow.detail}</p>}
    </div>
  )
}

function SolverTimings({ physicalGlow }: { physicalGlow: PhysicalGlowAnalysisState }) {
  const timings = physicalGlow.result?.timings
  if (!timings) return null
  const entries = [
    ['grid', physicalGlow.emissionBuildMs ?? 0],
    ['kernel', timings.kernelMs],
    ['sky', timings.propagationMs],
    ['checks', timings.diagnosticsMs],
  ] as const
  return (
    <div className="solver-timings" aria-label="Solver timing breakdown">
      {entries.map(([label, milliseconds]) => (
        <span key={label}><i>{label}</i><strong>{milliseconds < 10 ? milliseconds.toFixed(1) : milliseconds.toFixed(0)} ms</strong></span>
      ))}
    </div>
  )
}

function RadianceBreakdown({ physicalGlow }: { physicalGlow: PhysicalGlowAnalysisState }) {
  const result = physicalGlow.result
  const rings = physicalGlow.emissionDiagnostics?.rings
  if (!result || !rings) return null
  const groups = [
    { label: '0–20 km', minimum: 0, maximum: 20 },
    { label: '20–100 km', minimum: 20, maximum: 100 },
    { label: '100–300 km', minimum: 100, maximum: 300 },
    { label: '300–1000 km', minimum: 300, maximum: 1001 },
  ].map((group) => {
    let radiance = 0
    rings.forEach((entry, ringIndex) => {
      if (entry.ring.midpointKm < group.minimum || entry.ring.midpointKm >= group.maximum) return
      const base = ringIndex * 3
      radiance += luminance(
        result.ringMeanRgbRadiance[base],
        result.ringMeanRgbRadiance[base + 1],
        result.ringMeanRgbRadiance[base + 2],
      )
    })
    return { ...group, radiance }
  })
  const total = groups.reduce((sum, group) => sum + group.radiance, 0)
  const sourceLayers = result.componentContributions.map((component) => ({
    id: component.id,
    label: component.label ?? component.id,
    radiance: luminance(
      component.meanRgbRadiance[0],
      component.meanRgbRadiance[1],
      component.meanRgbRadiance[2],
    ),
  })).filter((component) => component.radiance > 0)
  const sourceLayerTotal = sourceLayers.reduce((sum, component) => sum + component.radiance, 0)

  return (
    <div className="radiance-breakdown">
      <div className="breakdown-heading"><span>Glow by distance</span><strong>{(result.diagnostics.distantContributionFraction * 100).toFixed(1)}% beyond 300 km</strong></div>
      {groups.map((group) => {
        const fraction = total > 0 ? group.radiance / total : 0
        return (
          <div className="radiance-row" key={group.label}>
            <span>{group.label}</span>
            <i><b style={{ width: `${fraction * 100}%` }} /></i>
            <strong>{Math.round(fraction * 100)}%</strong>
          </div>
        )
      })}
      {sourceLayers.length > 0 && (
        <>
          <div className="breakdown-heading source-heading"><span>Glow by source layer</span><strong>{sourceLayers.length}</strong></div>
          {sourceLayers.map((component) => {
            const fraction = sourceLayerTotal > 0 ? component.radiance / sourceLayerTotal : 0
            return (
              <div className="radiance-row source-layer-row" key={component.id}>
                <span title={component.label}>{component.label}</span>
                <i><b style={{ width: `${fraction * 100}%` }} /></i>
                <strong>{Math.round(fraction * 100)}%</strong>
              </div>
            )
          })}
        </>
      )}
      <div className="model-badges">
        <span>Rayleigh</span><span>Aerosol</span><span>Cloud</span><span>Multiple scatter</span>
      </div>
    </div>
  )
}

function luminance(red: number, green: number, blue: number) {
  return Math.max(0, red * 0.2126 + green * 0.7152 + blue * 0.0722)
}

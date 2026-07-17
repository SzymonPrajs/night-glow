import { CloudSun, RefreshCw } from 'lucide-react'
import type { SkyMetrics } from '../types'
import type { AnalysisPresentation } from './PhysicalAnalysisPanel'

type SkyStatusBarProps = {
  skyState?: string
  metrics: SkyMetrics
  weatherName: string
  presentation: AnalysisPresentation
}

export default function SkyStatusBar({ skyState, metrics, weatherName, presentation }: SkyStatusBarProps) {
  return (
    <section
      className={`sky-summary ${presentation.tone}`}
      aria-label="Sky visibility summary"
      aria-busy={presentation.busy}
      data-analysis-state={presentation.state}
    >
      <div className="summary-metrics">
        <SummaryMetric label={skyState ? 'Sky state' : 'Bortle'} value={skyState ?? `Class ${metrics.bortle}`} />
        <SummaryMetric label="Sky quality" value={`${metrics.zenithMag.toFixed(2)} mag/arcsec²`} />
        <SummaryMetric label="Naked-eye limit" value={`+${metrics.limitingMagnitude.toFixed(1)}`} />
        <SummaryMetric label="Visible stars" value={`~${metrics.visibleStars.toLocaleString()}`} />
      </div>
      <div className="weather-status" role="status" aria-live="polite" aria-atomic="true">
        <CloudSun size={16} aria-hidden="true" />
        <span><small>Weather</small><strong>{weatherName}</strong></span>
        <i aria-hidden="true" />
        <span className="model-state">
          <small>Model</small>
          <strong>{presentation.busy && <RefreshCw size={12} aria-hidden="true" />}{presentation.label}</strong>
        </span>
      </div>
    </section>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <div className="summary-metric" title={`${label}: ${value}`}><span>{label}</span><strong>{value}</strong></div>
}

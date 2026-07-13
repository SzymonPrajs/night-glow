import { useEffect, useMemo, useState } from 'react'
import {
  Clock3,
  CloudSun,
  Layers3,
  LocateFixed,
  Map,
  MapPin,
  Minus,
  MousePointer2,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Settings2,
  X,
} from 'lucide-react'
import LocationMap from './components/LocationMap'
import SettingsPanel from './components/SettingsPanel'
import SkyCanvas from './components/SkyCanvas'
import { usePhysicalGlow, type PhysicalGlowAnalysisState } from './hooks/usePhysicalGlow'
import { getSolarSystem } from './lib/astronomy'
import { analyzeOpenMap, fallbackAnalysis } from './lib/osm'
import { calculatePhysicalSkyMetrics } from './lib/physicalGlowField'
import { clamp } from './lib/skyModel'
import type { Atmosphere, Location, MapAnalysis } from './types'

const INITIAL_LOCATION: Location = {
  lat: 52.2297,
  lon: 21.0122,
  label: 'Warsaw, Poland',
}

const INITIAL_ATMOSPHERE: Atmosphere = {
  aerosol: 0.12,
  humidity: 0.45,
  cloud: 0.08,
  cloudBase: 6.5,
  angstromExponent: 1.3,
  aerosolScaleHeightKm: 1.4,
  aerosolSingleScatteringAlbedo: 0.92,
  aerosolAsymmetry: 0.68,
  cloudThicknessKm: 1.8,
  cloudOpticalDepth: 8,
  groundAlbedo: 0.14,
  maxScatteringOrder: 3,
}

const EMPTY_ANALYSIS: MapAnalysis = {
  status: 'idle',
  progress: 0,
  stage: 'Waiting for a location',
  sources: [],
  builtAreaKm2: 0,
  roadLengthKm: 0,
}

export default function App() {
  const [location, setLocation] = useState(INITIAL_LOCATION)
  const [atmosphere, setAtmosphere] = useState(INITIAL_ATMOSPHERE)
  const [analysis, setAnalysis] = useState<MapAnalysis>(EMPTY_ANALYSIS)
  const [date, setDate] = useState(() => new Date())
  const [mapOpen, setMapOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mapPinned, setMapPinned] = useState(() => localStorage.getItem('night-glow:map-pinned') === 'true')
  const [settingsPinned, setSettingsPinned] = useState(() => localStorage.getItem('night-glow:settings-pinned') === 'true')
  const [resetViewToken, setResetViewToken] = useState(0)
  const [view, setView] = useState({ azimuth: 180, altitude: 17, fov: 62 })
  const physicalGlow = usePhysicalGlow(location, analysis.sources, atmosphere)

  useEffect(() => {
    const controller = new AbortController()
    setAnalysis((current) => ({
      ...current,
      status: 'loading',
      progress: 5,
      stage: 'Preparing map survey',
      sources: [],
      builtAreaKm2: 0,
      roadLengthKm: 0,
      message: undefined,
    }))
    const timer = window.setTimeout(async () => {
      try {
        const result = await analyzeOpenMap(location, controller.signal, (progress, stage) => {
          if (!controller.signal.aborted) {
            setAnalysis((current) => current.status === 'loading' ? { ...current, progress, stage } : current)
          }
        })
        if (controller.signal.aborted) return
        setAnalysis(result)
      } catch (error) {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : 'OpenStreetMap data is temporarily unavailable.'
        setAnalysis(fallbackAnalysis(location, `${message}. Showing a conservative local baseline.`))
      }
    }, 550)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [location])

  useEffect(() => {
    localStorage.setItem('night-glow:map-pinned', String(mapPinned))
  }, [mapPinned])

  useEffect(() => {
    localStorage.setItem('night-glow:settings-pinned', String(settingsPinned))
  }, [settingsPinned])

  const solarSystem = useMemo(() => getSolarSystem(date, location), [date, location])
  const sun = solarSystem.find((object) => object.kind === 'sun')
  const moon = solarSystem.find((object) => object.kind === 'moon')
  const moonLight = moon && moon.altitude > 0
    ? (moon.phase ?? 0) * Math.sin((clamp(moon.altitude, 0, 90) * Math.PI) / 180)
    : 0
  const metrics = useMemo(
    () => calculatePhysicalSkyMetrics(physicalGlow.result, date, location, atmosphere, sun?.altitude, moonLight),
    [physicalGlow.result, date, location, atmosphere, sun?.altitude, moonLight],
  )

  const nudgeTime = (hours: number) => setDate((current) => new Date(current.getTime() + hours * 3_600_000))
  const direction = compassDirection(view.azimuth)
  const setMapPin = (pinned: boolean) => {
    setMapPinned(pinned)
    if (pinned) setMapOpen(true)
    if (pinned && window.innerWidth <= 720) {
      setSettingsPinned(false)
      setSettingsOpen(false)
    }
  }
  const setSettingsPin = (pinned: boolean) => {
    setSettingsPinned(pinned)
    if (pinned) setSettingsOpen(true)
    if (pinned && window.innerWidth <= 720) {
      setMapPinned(false)
      setMapOpen(false)
    }
  }

  return (
    <main className="app-shell">
      <SkyCanvas
        location={location}
        atmosphere={atmosphere}
        glowField={physicalGlow.result}
        metrics={metrics}
        date={date}
        solarSystem={solarSystem}
        resetViewToken={resetViewToken}
        onViewChange={setView}
      />

      <div className="vignette" aria-hidden="true" />
      <div className="zenith-marker" aria-hidden="true"><span /></div>

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><span /><i /></div>
          <div>
            <strong>Night Glow</strong>
            <span>Sky & light atlas</span>
          </div>
        </div>

        <div className="sky-summary" aria-label="Sky visibility summary">
          <SummaryMetric label="Bortle" value={`Class ${metrics.bortle}`} />
          <SummaryMetric label="Sky quality" value={`${metrics.zenithMag.toFixed(2)} mag`} />
          <SummaryMetric label="Naked-eye limit" value={`+${metrics.limitingMagnitude.toFixed(1)}`} />
          <SummaryMetric label="Visible stars" value={`~${metrics.visibleStars.toLocaleString()}`} />
        </div>

        <div aria-hidden="true" />
      </header>

      <SideDrawer
        side="left"
        label="Location map"
        tabIcon={<Map size={18} />}
        panelClass="location-panel"
        panelLabel="Observer location and light sources"
        pinned={mapPinned}
        open={mapOpen}
        onOpenChange={setMapOpen}
      >
          <PanelHeader
            icon={<MapPin size={17} />}
            title="Observer location"
            pinned={mapPinned}
            onPinnedChange={setMapPin}
            onClose={() => { setMapPinned(false); setMapOpen(false) }}
          />
          <LocationMap location={location} sources={analysis.sources} status={analysis.status} heading={view.azimuth} onChange={setLocation} />
          <div className="coordinates">
            <LocateFixed size={14} />
            <span>{location.lat.toFixed(4)}° {location.lat >= 0 ? 'N' : 'S'}</span>
            <span>{Math.abs(location.lon).toFixed(4)}° {location.lon >= 0 ? 'E' : 'W'}</span>
          </div>
          <div className="analysis-block">
            <div className="analysis-title">
              <span><Layers3 size={14} /> Physical sky analysis</span>
              <DataStatus analysis={analysis} physicalGlow={physicalGlow} />
            </div>
            <SurveyProgress analysis={analysis} physicalGlow={physicalGlow} />
            <div className="analysis-grid">
              <div><strong>{physicalGlow.emissionDiagnostics?.rings.length ?? 81}</strong><span>distance rings</span></div>
              <div><strong>{physicalGlow.result?.azimuthCount ?? 720}</strong><span>bearings</span></div>
              <div><strong>{physicalGlow.result?.wavelengthsNm.length ?? 8}</strong><span>spectral bands</span></div>
            </div>
            <RadianceBreakdown physicalGlow={physicalGlow} />
            <div className="map-detail-summary">
              <span>{formatArea(analysis.builtAreaKm2)} mapped area</span>
              <span>{analysis.roadLengthKm.toFixed(0)} km roads</span>
              <span>{analysis.sources.length.toLocaleString()} features</span>
            </div>
            {analysis.message && <p className="analysis-message">{analysis.message}</p>}
            {physicalGlow.error && <p className="analysis-message">{physicalGlow.error}</p>}
          </div>
      </SideDrawer>

      <SideDrawer
        side="right"
        label="Atmosphere settings"
        tabIcon={<Settings2 size={18} />}
        panelClass="settings-panel"
        panelLabel="Atmospheric scattering settings"
        pinned={settingsPinned}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      >
          <PanelHeader
            icon={<CloudSun size={17} />}
            title="Atmosphere"
            pinned={settingsPinned}
            onPinnedChange={setSettingsPin}
            onClose={() => { setSettingsPinned(false); setSettingsOpen(false) }}
          />
          <SettingsPanel atmosphere={atmosphere} onChange={setAtmosphere} />
      </SideDrawer>

      <div className="view-readout" aria-label="Current view direction">
        <div className="compass-disc"><span style={{ transform: `rotate(${-view.azimuth}deg)` }}>N</span></div>
        <div><strong>{direction} {Math.round(view.azimuth)}°</strong><span>{Math.round(view.altitude)}° altitude · {Math.round(view.fov)}° field</span></div>
      </div>

      <div className="interaction-hint">
        <MousePointer2 size={14} /> Drag to look around <span /> Scroll to zoom
      </div>

      <div className="time-dock">
        <button className="dock-button" onClick={() => nudgeTime(-1)} aria-label="One hour earlier"><Minus size={16} /><span>1h</span></button>
        <label className="date-control">
          <Clock3 size={16} />
          <input
            type="datetime-local"
            value={toLocalInput(date)}
            onChange={(event) => {
              const next = new Date(event.target.value)
              if (!Number.isNaN(next.getTime())) setDate(next)
            }}
            aria-label="Observation date and time"
          />
        </label>
        <button className="now-button" onClick={() => setDate(new Date())}>Now</button>
        <button className="dock-button" onClick={() => nudgeTime(1)} aria-label="One hour later"><Plus size={16} /><span>1h</span></button>
      </div>

      <button className="reset-view" onClick={() => setResetViewToken((token) => token + 1)}>
        <RotateCcw size={15} /> Reset view
      </button>

      <div className="sky-legend" aria-label="Sky object legend">
        <span><i className="legend-star" /> Stars</span>
        <span><i className="legend-planet" /> Planets</span>
        <span><i className="legend-deep" /> Clusters & deep sky</span>
      </div>
    </main>
  )
}

type SideDrawerProps = {
  side: 'left' | 'right'
  label: string
  tabIcon: React.ReactNode
  panelClass: string
  panelLabel: string
  pinned: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function SideDrawer({ side, label, tabIcon, panelClass, panelLabel, pinned, open, onOpenChange, children }: SideDrawerProps) {
  const expanded = pinned || open
  return (
    <section
      className={`side-drawer ${side} ${expanded ? 'is-open' : ''} ${pinned ? 'is-pinned' : ''}`}
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => { if (!pinned) onOpenChange(false) }}
      onFocusCapture={() => onOpenChange(true)}
      onBlurCapture={(event) => {
        if (!pinned && !event.currentTarget.contains(event.relatedTarget as Node | null)) onOpenChange(false)
      }}
    >
      <div className="drawer-hover-strip" aria-hidden="true" />
      <button
        className="drawer-tab"
        onClick={() => onOpenChange(true)}
        aria-label={`Show ${label}`}
        aria-expanded={expanded}
      >
        {tabIcon}
        <span>{label}</span>
      </button>
      <aside className={`glass-panel drawer-panel ${panelClass}`} aria-label={panelLabel} aria-hidden={!expanded}>
        {children}
      </aside>
    </section>
  )
}

function PanelHeader({ icon, title, pinned, onPinnedChange, onClose }: {
  icon: React.ReactNode
  title: string
  pinned: boolean
  onPinnedChange: (pinned: boolean) => void
  onClose: () => void
}) {
  return (
    <div className="panel-header">
      <div className="panel-title">{icon}<strong>{title}</strong></div>
      <div className="panel-actions">
        <button
          className={pinned ? 'pin-button active' : 'pin-button'}
          onClick={() => onPinnedChange(!pinned)}
          aria-label={pinned ? `Unpin ${title}` : `Pin ${title} open`}
          aria-pressed={pinned}
        >
          {pinned ? <PinOff size={15} /> : <Pin size={15} />}
        </button>
        <button onClick={onClose} aria-label={`Close ${title}`}><X size={15} /></button>
      </div>
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <div className="summary-metric"><span>{label}</span><strong>{value}</strong></div>
}

function DataStatus({ analysis, physicalGlow }: { analysis: MapAnalysis; physicalGlow: PhysicalGlowAnalysisState }) {
  if (physicalGlow.status === 'loading') return <span className="data-status loading"><i /> solving</span>
  if (physicalGlow.status === 'live' && analysis.status === 'fallback') {
    return <span className="data-status fallback"><i /> regional</span>
  }
  if (physicalGlow.status === 'live') return <span className="data-status live"><i /> physical</span>
  if (physicalGlow.status === 'error') return <span className="data-status fallback"><i /> previous field</span>
  return <span className="data-status"><i /> waiting</span>
}

function SurveyProgress({ analysis, physicalGlow }: { analysis: MapAnalysis; physicalGlow: PhysicalGlowAnalysisState }) {
  const mapProgress = analysis.status === 'live' || analysis.status === 'fallback'
    ? 100
    : clamp(analysis.progress, 0, 100)
  const progress = Math.round(clamp(physicalGlow.progress * 0.9 + mapProgress * 0.1, 0, 100))
  const rows = [
    { label: 'Emission rings', value: physicalGlow.components.emission * 100 },
    { label: 'Local map detail', value: mapProgress },
    { label: 'Atmosphere kernel', value: physicalGlow.components.kernel * 100 },
    { label: 'Sky convolution', value: physicalGlow.components.propagation * 100 },
    { label: 'Numerical checks', value: physicalGlow.components.diagnostics * 100 },
  ]
  return (
    <div className={`analysis-progress ${physicalGlow.status}`}>
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
  return (
    <div className="radiance-breakdown">
      <div className="breakdown-heading"><span>Glow by distance</span><strong>{(result.diagnostics.outerTailFractionEstimate * 100).toFixed(1)}% outer tail</strong></div>
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
      <div className="model-badges">
        <span>Rayleigh</span><span>Aerosol</span><span>Cloud</span><span>Multiple scatter</span>
      </div>
    </div>
  )
}

function luminance(red: number, green: number, blue: number) {
  return Math.max(0, red * 0.2126 + green * 0.7152 + blue * 0.0722)
}

function toLocalInput(date: Date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

function compassDirection(degrees: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return directions[Math.round(degrees / 45) % 8]
}

function formatArea(area: number) {
  return area < 10 ? `${area.toFixed(1)} km²` : `${area.toFixed(0)} km²`
}

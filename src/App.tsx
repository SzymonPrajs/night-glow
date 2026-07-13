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
import { getSolarSystem } from './lib/astronomy'
import { analyzeOpenMap, fallbackAnalysis } from './lib/osm'
import { calculateSkyMetrics, clamp } from './lib/skyModel'
import type { Atmosphere, Location, MapAnalysis } from './types'

const INITIAL_LOCATION: Location = {
  lat: 52.2297,
  lon: 21.0122,
  label: 'Warsaw, Poland',
}

const INITIAL_ATMOSPHERE: Atmosphere = {
  aerosol: 0.28,
  humidity: 0.45,
  cloud: 0.08,
  cloudBase: 6.5,
}

const EMPTY_ANALYSIS: MapAnalysis = {
  status: 'idle',
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

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setAnalysis((current) => ({ ...current, status: 'loading', message: undefined }))
      try {
        const result = await analyzeOpenMap(location, controller.signal)
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
    () => calculateSkyMetrics(analysis.sources, atmosphere, sun?.altitude, moonLight),
    [analysis.sources, atmosphere, sun?.altitude, moonLight],
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
        sources={analysis.sources}
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
          <LocationMap location={location} sources={analysis.sources} status={analysis.status} onChange={setLocation} />
          <div className="coordinates">
            <LocateFixed size={14} />
            <span>{location.lat.toFixed(4)}° {location.lat >= 0 ? 'N' : 'S'}</span>
            <span>{Math.abs(location.lon).toFixed(4)}° {location.lon >= 0 ? 'E' : 'W'}</span>
          </div>
          <div className="analysis-block">
            <div className="analysis-title">
              <span><Layers3 size={14} /> Open map survey</span>
              <DataStatus status={analysis.status} />
            </div>
            <div className="analysis-grid">
              <div><strong>{formatArea(analysis.builtAreaKm2)}</strong><span>built-up area</span></div>
              <div><strong>{analysis.roadLengthKm.toFixed(0)} km</strong><span>major roads</span></div>
              <div><strong>{analysis.sources.length}</strong><span>light sources</span></div>
            </div>
            {analysis.message && <p className="analysis-message">{analysis.message}</p>}
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

function DataStatus({ status }: { status: MapAnalysis['status'] }) {
  if (status === 'loading') return <span className="data-status loading"><i /> loading</span>
  if (status === 'live') return <span className="data-status live"><i /> live OSM</span>
  if (status === 'fallback') return <span className="data-status fallback"><i /> baseline</span>
  return <span className="data-status"><i /> waiting</span>
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

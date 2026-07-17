import { useEffect, useMemo, useState } from 'react'
import {
  Clock3,
  CloudSun,
  Compass,
  LocateFixed,
  Map,
  MapPin,
  Minus,
  MousePointer2,
  Plus,
  RotateCcw,
  Settings2,
} from 'lucide-react'
import LocationMap from './components/LocationMap'
import PhysicalAnalysisPanel, { type AnalysisPresentation } from './components/PhysicalAnalysisPanel'
import SettingsPanel from './components/SettingsPanel'
import SideDrawer, { PanelHeader } from './components/SideDrawer'
import SkyCanvas from './components/SkyCanvas'
import SkyPresentationControl from './components/SkyPresentationControl'
import SkyStatusBar from './components/SkyStatusBar'
import { usePhysicalGlow, type PhysicalGlowAnalysisState } from './hooks/usePhysicalGlow'
import { getSolarSystem } from './lib/astronomy'
import { moonSkyStrength } from './lib/celestialLight'
import { calculatePhysicalSkyMetrics } from './lib/physicalGlowField'
import { DEFAULT_SEEING_CONDITIONS } from './lib/seeing'
import { DEFAULT_ATMOSPHERE, findWeatherPreset } from './lib/weatherPresets'
import type { Atmosphere, Location, SeeingConditions } from './types'

const INITIAL_LOCATION: Location = {
  lat: 52.2297,
  lon: 21.0122,
  label: 'Warsaw, Poland',
}

const SKY_ENHANCEMENT_STORAGE_KEY = 'night-glow:sky-enhancement'
const LEGACY_APPEARANCE_STORAGE_KEY = 'night-glow:appearance-mode'
const MAP_PIN_STORAGE_KEY = 'night-glow:map-pinned'
const SETTINGS_PIN_STORAGE_KEY = 'night-glow:settings-pinned'
const COMPACT_QUERY = '(max-width: 1099px)'

function storedSkyEnhancement() {
  const stored = localStorage.getItem(SKY_ENHANCEMENT_STORAGE_KEY)
  if (stored != null && stored.trim() !== '') {
    const parsed = Number(stored)
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0
  }
  const legacy = localStorage.getItem(LEGACY_APPEARANCE_STORAGE_KEY)
  return legacy === 'atlas' ? 1 : 0
}

export default function App() {
  const [location, setLocation] = useState(INITIAL_LOCATION)
  const [atmosphere, setAtmosphere] = useState<Atmosphere>(() => ({ ...DEFAULT_ATMOSPHERE }))
  const [seeing, setSeeing] = useState<SeeingConditions>(() => ({ ...DEFAULT_SEEING_CONDITIONS }))
  const [skyEnhancement, setSkyEnhancement] = useState(storedSkyEnhancement)
  const [date, setDate] = useState(() => new Date())
  const [mapOpen, setMapOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mapPinned, setMapPinned] = useState(() => localStorage.getItem(MAP_PIN_STORAGE_KEY) === 'true')
  const [settingsPinned, setSettingsPinned] = useState(() => localStorage.getItem(SETTINGS_PIN_STORAGE_KEY) === 'true')
  const [lastActiveDrawer, setLastActiveDrawer] = useState<'map' | 'settings'>('map')
  const [resetViewToken, setResetViewToken] = useState(0)
  const [view, setView] = useState({ azimuth: 180, altitude: 17, fov: 62 })
  const compactLayout = useMediaQuery(COMPACT_QUERY)
  const physicalGlow = usePhysicalGlow(location, atmosphere)

  useEffect(() => {
    localStorage.setItem(MAP_PIN_STORAGE_KEY, String(mapPinned))
  }, [mapPinned])

  useEffect(() => {
    localStorage.setItem(SETTINGS_PIN_STORAGE_KEY, String(settingsPinned))
  }, [settingsPinned])

  useEffect(() => {
    localStorage.setItem(SKY_ENHANCEMENT_STORAGE_KEY, String(skyEnhancement))
    localStorage.removeItem(LEGACY_APPEARANCE_STORAGE_KEY)
  }, [skyEnhancement])

  useEffect(() => {
    if (!compactLayout || !mapPinned || !settingsPinned) return
    if (lastActiveDrawer === 'settings') {
      setMapPinned(false)
      setMapOpen(false)
    } else {
      setSettingsPinned(false)
      setSettingsOpen(false)
    }
  }, [compactLayout, lastActiveDrawer, mapPinned, settingsPinned])

  const solarSystem = useMemo(() => getSolarSystem(date, location), [date, location])
  const sun = solarSystem.find((object) => object.kind === 'sun')
  const moon = solarSystem.find((object) => object.kind === 'moon')
  const moonLight = moonSkyStrength(moon, atmosphere)
  const metrics = useMemo(
    () => calculatePhysicalSkyMetrics(physicalGlow.result, date, location, atmosphere, sun?.altitude, moonLight),
    [physicalGlow.result, date, location, atmosphere, sun?.altitude, moonLight],
  )
  const skyState = solarSkyState(sun?.altitude)
  const weatherName = findWeatherPreset(atmosphere)?.name ?? 'Custom'
  const analysisPresentation = presentAnalysis(physicalGlow)
  const timeZone = useMemo(() => deviceTimeZoneLabel(date), [date])
  const direction = compassDirection(view.azimuth)
  const mapExpanded = mapPinned || mapOpen

  const nudgeTime = (hours: number) => setDate((current) => new Date(current.getTime() + hours * 3_600_000))
  const setDrawerOpen = (drawer: 'map' | 'settings', open: boolean) => {
    if (open) setLastActiveDrawer(drawer)
    if (drawer === 'map') {
      setMapOpen(open)
      if (open && compactLayout) {
        setSettingsOpen(false)
        setSettingsPinned(false)
      }
    } else {
      setSettingsOpen(open)
      if (open && compactLayout) {
        setMapOpen(false)
        setMapPinned(false)
      }
    }
  }
  const setDrawerPinned = (drawer: 'map' | 'settings', pinned: boolean) => {
    setLastActiveDrawer(drawer)
    if (drawer === 'map') {
      setMapPinned(pinned)
      if (pinned) setMapOpen(true)
      if (pinned && compactLayout) {
        setSettingsPinned(false)
        setSettingsOpen(false)
      }
    } else {
      setSettingsPinned(pinned)
      if (pinned) setSettingsOpen(true)
      if (pinned && compactLayout) {
        setMapPinned(false)
        setMapOpen(false)
      }
    }
  }

  return (
    <main className="app-shell" data-sky-enhancement={skyEnhancement.toFixed(2)} data-compact={compactLayout || undefined}>
      <SkyCanvas
        location={location}
        atmosphere={atmosphere}
        seeing={seeing}
        skyEnhancement={skyEnhancement}
        moonLight={moonLight}
        glowField={physicalGlow.result}
        metrics={metrics}
        date={date}
        solarSystem={solarSystem}
        resetViewToken={resetViewToken}
        onViewChange={setView}
      />

      <div className="vignette" aria-hidden="true" />
      <div className="view-center-reticle" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span /><i /></div>
          <div>
            <strong>Night Glow</strong>
            <span>Sky & light atlas</span>
          </div>
        </div>
        <SkyStatusBar
          skyState={skyState}
          metrics={metrics}
          weatherName={weatherName}
          presentation={analysisPresentation}
        />
        <SkyPresentationControl value={skyEnhancement} onChange={setSkyEnhancement} />
      </header>

      <SideDrawer
        side="left"
        label="Location map"
        tabLabel="Location"
        tabIcon={<Map size={19} />}
        panelClass="location-panel"
        panelLabel="Observer location and physical sky analysis"
        pinned={mapPinned}
        open={mapOpen}
        onOpenChange={(open) => setDrawerOpen('map', open)}
      >
        <PanelHeader
          icon={<MapPin size={18} />}
          title="Observer location"
          pinned={mapPinned}
          onPinnedChange={(pinned) => setDrawerPinned('map', pinned)}
          onClose={() => { setMapPinned(false); setMapOpen(false) }}
        />
        <LocationMap location={location} heading={view.azimuth} visible={mapExpanded} onChange={setLocation} />
        <div className="location-readout">
          <strong>{location.label}</strong>
          <div className="coordinates">
            <LocateFixed size={15} />
            <span>{Math.abs(location.lat).toFixed(4)}° {location.lat >= 0 ? 'N' : 'S'}</span>
            <span>{Math.abs(location.lon).toFixed(4)}° {location.lon >= 0 ? 'E' : 'W'}</span>
          </div>
        </div>
        <PhysicalAnalysisPanel physicalGlow={physicalGlow} presentation={analysisPresentation} />
      </SideDrawer>

      <SideDrawer
        side="right"
        label="Sky settings"
        tabLabel="Settings"
        tabIcon={<Settings2 size={19} />}
        panelClass="settings-panel"
        panelLabel="Atmospheric scattering and weather settings"
        pinned={settingsPinned}
        open={settingsOpen}
        onOpenChange={(open) => setDrawerOpen('settings', open)}
      >
        <PanelHeader
          icon={<CloudSun size={18} />}
          title="Atmosphere"
          pinned={settingsPinned}
          onPinnedChange={(pinned) => setDrawerPinned('settings', pinned)}
          onClose={() => { setSettingsPinned(false); setSettingsOpen(false) }}
        />
        <SettingsPanel
          atmosphere={atmosphere}
          seeing={seeing}
          viewAltitude={view.altitude}
          analysis={physicalGlow}
          onChange={setAtmosphere}
          onSeeingChange={setSeeing}
        />
      </SideDrawer>

      <div className="view-readout" aria-label="Current view direction">
        <div className="compass-disc"><Compass size={17} aria-hidden="true" /></div>
        <div><strong>{direction} {Math.round(view.azimuth)}°</strong><span>{Math.round(view.altitude)}° altitude · {formatFieldOfView(view.fov)} field</span></div>
      </div>

      <div className="interaction-hint" aria-hidden="true">
        <MousePointer2 size={15} />
        <span className="fine-pointer-copy">Drag to look <i /> Scroll to zoom</span>
        <span className="coarse-pointer-copy">Drag to look <i /> Pinch to zoom</span>
      </div>

      <div className="time-dock">
        <button className="dock-button" type="button" onClick={() => nudgeTime(-1)} aria-label="One hour earlier"><Minus size={17} /><span>1h</span></button>
        <label className="date-control">
          <Clock3 size={17} />
          <span className="date-fields">
            <input
              type="datetime-local"
              value={toLocalInput(date)}
              onChange={(event) => {
                const next = new Date(event.target.value)
                if (!Number.isNaN(next.getTime())) setDate(next)
              }}
              aria-label="Observation date and time, device local"
              aria-describedby="device-time-zone"
            />
            <small id="device-time-zone">Device time · {timeZone}</small>
          </span>
        </label>
        <button className="now-button" type="button" onClick={() => setDate(new Date())}>Now</button>
        <button className="dock-button" type="button" onClick={() => nudgeTime(1)} aria-label="One hour later"><Plus size={17} /><span>1h</span></button>
      </div>

      <button className="reset-view" type="button" onClick={() => setResetViewToken((token) => token + 1)}>
        <RotateCcw size={16} /> Reset view
      </button>

      <div className="sky-legend" aria-label="Sky object legend">
        <span><i className="legend-star" /> Stars</span>
        <span><i className="legend-planet" /> Planets</span>
        <span><i className="legend-deep" /> Clusters & deep sky</span>
      </div>
    </main>
  )
}

function presentAnalysis(physicalGlow: PhysicalGlowAnalysisState): AnalysisPresentation {
  if (physicalGlow.status === 'loading' && physicalGlow.result) {
    return { state: 'updating', label: 'Updating — showing previous field', shortLabel: 'Updating previous', tone: 'warning', busy: true }
  }
  if (physicalGlow.status === 'loading') {
    return { state: 'loading', label: 'Building sky model', shortLabel: 'Building', tone: 'info', busy: true }
  }
  if (physicalGlow.status === 'live') {
    return { state: 'live', label: 'Physical field current', shortLabel: 'Current', tone: 'success', busy: false }
  }
  if (physicalGlow.status === 'error' && physicalGlow.result) {
    return { state: 'stale-error', label: 'Update failed — showing last valid field', shortLabel: 'Last valid field', tone: 'warning', busy: false }
  }
  if (physicalGlow.status === 'error') {
    return { state: 'unavailable', label: 'Physical analysis unavailable', shortLabel: 'Unavailable', tone: 'error', busy: false }
  }
  return { state: 'initial', label: 'Waiting for sky model', shortLabel: 'Waiting', tone: 'neutral', busy: false }
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}

function toLocalInput(date: Date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

function deviceTimeZoneLabel(date: Date) {
  const name = Intl.DateTimeFormat().resolvedOptions().timeZone
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '−'
  const absoluteMinutes = Math.abs(offsetMinutes)
  const hours = Math.floor(absoluteMinutes / 60)
  const minutes = absoluteMinutes % 60
  const offset = `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  return name ? `${name} (${offset})` : offset
}

function formatFieldOfView(fov: number) {
  if (fov >= 10) return `${Math.round(fov)}°`
  if (fov >= 1) return `${fov.toFixed(1)}°`
  return `${(fov * 60).toFixed(fov < 0.2 ? 1 : 0)}′`
}

function compassDirection(degrees: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return directions[Math.round(degrees / 45) % 8]
}

function solarSkyState(solarAltitude: number | undefined) {
  if (solarAltitude == null || solarAltitude <= -18) return undefined
  if (solarAltitude <= -12) return 'Astronomical twilight'
  if (solarAltitude <= -6) return 'Nautical twilight'
  if (solarAltitude <= 0) return 'Civil twilight'
  return 'Daylight'
}

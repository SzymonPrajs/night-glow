// Committed shareable state lives in the URL. A copied URL must reproduce the
// same scientific question, so parsing is strict and defaults are explicit.
// Preview (pointer/scrub) state never touches these values.

export interface SearchParamSource {
  get(name: string): string | null
}

export const FIXTURE_DEFAULTS = {
  latitudeDeg: 52.01,
  longitudeDeg: 21.01,
  heightM: 120,
  requestedTimeUtc: '2024-01-15T00:00:00Z',
  globeZoom: 11,
  defaultLayerId: 'display:emission:fixture:2x2:v1',
  atmosphereMode: 'standard_scenario',
} as const

export interface GlobeUrlState {
  layer: string
  requestedTimeUtc: string
  latitudeDeg: number
  longitudeDeg: number
  zoom: number
}

export interface ObserveUrlState {
  latitudeDeg: number
  longitudeDeg: number
  heightM: number
  requestedTimeUtc: string
  atmosphereMode: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parseNumber(raw: string | null): number | null {
  if (raw === null) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function parseLatitude(raw: string | null, fallback: number): number {
  const value = parseNumber(raw)
  return value === null ? fallback : clamp(value, -90, 90)
}

function parseLongitude(raw: string | null, fallback: number): number {
  const value = parseNumber(raw)
  return value === null ? fallback : clamp(value, -180, 180)
}

function parseTime(raw: string | null, fallback: string): string {
  if (raw === null) return fallback
  // Preserve the exact string: the coordinator pins scenario times by string
  // identity against the compatibility manifest, so no Date round-trip here.
  return Number.isNaN(new Date(raw).getTime()) ? fallback : raw
}

export function parseGlobeState(params: SearchParamSource): GlobeUrlState {
  return {
    layer: params.get('layer') ?? FIXTURE_DEFAULTS.defaultLayerId,
    requestedTimeUtc: parseTime(params.get('requested_time_utc'), FIXTURE_DEFAULTS.requestedTimeUtc),
    latitudeDeg: parseLatitude(params.get('lat'), FIXTURE_DEFAULTS.latitudeDeg),
    longitudeDeg: parseLongitude(params.get('lon'), FIXTURE_DEFAULTS.longitudeDeg),
    zoom: clamp(parseNumber(params.get('zoom')) ?? FIXTURE_DEFAULTS.globeZoom, 1, 18),
  }
}

export function parseObserveState(params: SearchParamSource): ObserveUrlState {
  const height = parseNumber(params.get('height'))
  return {
    latitudeDeg: parseLatitude(params.get('lat'), FIXTURE_DEFAULTS.latitudeDeg),
    longitudeDeg: parseLongitude(params.get('lon'), FIXTURE_DEFAULTS.longitudeDeg),
    heightM: height === null ? FIXTURE_DEFAULTS.heightM : clamp(height, -500, 9000),
    requestedTimeUtc: parseTime(params.get('requested_time_utc'), FIXTURE_DEFAULTS.requestedTimeUtc),
    atmosphereMode: params.get('atmosphere_mode') ?? FIXTURE_DEFAULTS.atmosphereMode,
  }
}

function formatCoordinate(value: number): string {
  // Trim trailing zeros while keeping enough precision for scenario identity.
  return String(Number(value.toFixed(6)))
}

export function buildGlobeQuery(state: GlobeUrlState): URLSearchParams {
  const query = new URLSearchParams()
  query.set('layer', state.layer)
  query.set('requested_time_utc', state.requestedTimeUtc)
  query.set('lat', formatCoordinate(state.latitudeDeg))
  query.set('lon', formatCoordinate(state.longitudeDeg))
  query.set('zoom', formatCoordinate(state.zoom))
  return query
}

export function buildObserveQuery(state: ObserveUrlState): URLSearchParams {
  const query = new URLSearchParams()
  query.set('lat', formatCoordinate(state.latitudeDeg))
  query.set('lon', formatCoordinate(state.longitudeDeg))
  query.set('height', formatCoordinate(state.heightM))
  query.set('height_datum', 'ellipsoidal')
  query.set('requested_time_utc', state.requestedTimeUtc)
  query.set('atmosphere_mode', state.atmosphereMode)
  return query
}

export interface CoordinateParseResult {
  ok: true
  latitudeDeg: number
  longitudeDeg: number
}

export interface CoordinateParseError {
  ok: false
  message: string
}

// Accepts "lat, lon" in decimal degrees (the keyboard/screen-reader path to
// any point on Earth).
export function parseCoordinateInput(raw: string): CoordinateParseResult | CoordinateParseError {
  const parts = raw.split(/[,\s]+/).filter((part) => part.length > 0)
  if (parts.length !== 2) {
    return { ok: false, message: 'Enter two decimal degrees separated by a comma, e.g. 52.01, 21.01' }
  }
  const [lat, lon] = parts.map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, message: 'Coordinates must be decimal numbers' }
  }
  if (lat < -90 || lat > 90) return { ok: false, message: 'Latitude must be between -90 and 90' }
  if (lon < -180 || lon > 180) return { ok: false, message: 'Longitude must be between -180 and 180' }
  return { ok: true, latitudeDeg: lat, longitudeDeg: lon }
}

import type { LightSource, Location, MapAnalysis } from '../types'
import { bearingDegrees, distanceKm, geometryCentroid, lineLengthKm, polygonAreaKm2 } from './geo'

type OsmPoint = { lat: number; lon: number }
type OsmElement = {
  id: number
  type: 'node' | 'way' | 'relation'
  lat?: number
  lon?: number
  center?: OsmPoint
  geometry?: Array<OsmPoint | null>
  tags?: Record<string, string>
}

const LANDUSE_FACTOR: Record<string, number> = {
  residential: 1,
  industrial: 1.55,
  commercial: 1.85,
  retail: 2.05,
}

const ROAD_FACTOR: Record<string, number> = {
  motorway: 1.2,
  trunk: 1,
  primary: 0.72,
  secondary: 0.46,
}

const PLACE_FLUX: Record<string, number> = {
  city: 72,
  town: 22,
  village: 4,
}

const ESTIMATED_LANDUSE_AREA: Record<string, number> = {
  residential: 0.22,
  industrial: 0.31,
  commercial: 0.13,
  retail: 0.09,
}

export async function analyzeOpenMap(
  location: Location,
  signal?: AbortSignal,
  onProgress?: (progress: number, stage: string) => void,
): Promise<MapAnalysis> {
  const query = `[out:json][timeout:20];
way["landuse"~"^(residential|industrial|commercial|retail)$"](around:9000,${location.lat},${location.lon})->.land;
way["highway"~"^(motorway|trunk|primary|secondary)$"](around:9000,${location.lat},${location.lon})->.roads;
node["place"~"^(city|town|village)$"](around:38000,${location.lat},${location.lon})->.places;
.places out center 80;
.land out center geom 340;
.roads out center geom 340;`
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]
  const groupController = new AbortController()
  const abortGroup = () => groupController.abort()
  signal?.addEventListener('abort', abortGroup, { once: true })
  try {
    onProgress?.(14, 'Querying nearby map features')
    const data = await Promise.any(endpoints.map(async (endpoint) => {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      }, groupController.signal, 24_000)
      if (!response.ok) throw new Error(`OpenStreetMap analysis returned ${response.status}`)
      onProgress?.(62, 'Downloading mapped features')
      const payload = (await response.json()) as { elements: OsmElement[]; remark?: string }
      if (payload.remark && !payload.elements.length) throw new Error('OpenStreetMap survey timed out')
      return payload
    }))
    onProgress?.(78, 'Measuring areas and roads')
    await yieldToDisplay()
    const result = processElements(location, data.elements)
    onProgress?.(94, 'Updating the horizon model')
    return result
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('OpenStreetMap survey timed out')
  } finally {
    groupController.abort()
    signal?.removeEventListener('abort', abortGroup)
  }
}

function processElements(location: Location, elements: OsmElement[]): MapAnalysis {
  const built: LightSource[] = []
  const roads: LightSource[] = []
  const places: LightSource[] = []
  let builtAreaKm2 = 0
  let roadLengthKm = 0

  for (const element of elements) {
    const tags = element.tags ?? {}
    const geometry = (element.geometry ?? []).filter((point): point is OsmPoint => Boolean(point))
    const center = element.center ?? (geometry.length ? geometryCentroid(geometry) : undefined) ??
      (element.lat != null && element.lon != null ? { lat: element.lat, lon: element.lon } : undefined)
    if (!center) continue

    if (tags.landuse && LANDUSE_FACTOR[tags.landuse]) {
      const area = polygonAreaKm2(geometry) || ESTIMATED_LANDUSE_AREA[tags.landuse]
      if (area < 0.015 || area > 180) continue
      builtAreaKm2 += area
      built.push(makeSource(location, {
        id: `built-${element.type}-${element.id}`,
        name: tags.name || `${titleCase(tags.landuse)} area`,
        category: 'built',
        center,
        flux: Math.pow(area, 0.78) * LANDUSE_FACTOR[tags.landuse] * 5.4,
        areaKm2: area,
      }))
    }

    if (tags.highway && ROAD_FACTOR[tags.highway]) {
      const length = lineLengthKm(geometry) || (tags.highway === 'motorway' ? 0.9 : 0.42)
      if (length < 0.08 || length > 80) continue
      roadLengthKm += length
      roads.push(makeSource(location, {
        id: `road-${element.id}`,
        name: tags.name || `${titleCase(tags.highway)} road`,
        category: 'road',
        center,
        flux: Math.pow(length, 0.72) * ROAD_FACTOR[tags.highway] * 1.7,
        lengthKm: length,
      }))
    }

    if (tags.place && PLACE_FLUX[tags.place]) {
      const population = Number.parseInt(tags.population?.replace(/\D/g, '') || '0', 10)
      const estimatedArea = population > 0
        ? population / (tags.place === 'city' ? 4200 : tags.place === 'town' ? 3000 : 1700)
        : tags.place === 'city' ? 120 : tags.place === 'town' ? 18 : 2.4
      const base = population > 0 ? Math.min(150, Math.pow(population / 700, 0.58)) : PLACE_FLUX[tags.place]
      places.push(makeSource(location, {
        id: `place-${element.id}`,
        name: tags.name || titleCase(tags.place),
        category: 'place',
        center,
        flux: base,
        areaKm2: estimatedArea,
      }))
    }
  }

  // Distant city/town anchors and the largest local emitters best describe the horizon.
  if (builtAreaKm2 < 0.1) {
    builtAreaKm2 = places
      .filter((place) => place.distanceKm < 18)
      .reduce((sum, place) => sum + (place.areaKm2 ?? 0), 0)
  }

  const sources = [
    ...places.sort((a, b) => b.flux - a.flux).slice(0, 14),
    ...built.sort((a, b) => b.flux - a.flux).slice(0, 54),
    ...roads.sort((a, b) => b.flux - a.flux).slice(0, 30),
  ]

  return {
    status: 'live',
    progress: 100,
    stage: 'Survey complete',
    sources,
    builtAreaKm2,
    roadLengthKm,
    message: sources.length ? undefined : 'No modeled emitters found in the survey radius.',
  }
}

function makeSource(location: Location, input: {
  id: string
  name: string
  category: LightSource['category']
  center: OsmPoint
  flux: number
  areaKm2?: number
  lengthKm?: number
}): LightSource {
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    lat: input.center.lat,
    lon: input.center.lon,
    bearing: bearingDegrees(location, input.center),
    distanceKm: distanceKm(location, input.center),
    flux: input.flux,
    areaKm2: input.areaKm2,
    lengthKm: input.lengthKm,
  }
}

export function fallbackAnalysis(location: Location, message: string): MapAnalysis {
  return {
    status: 'fallback',
    progress: 100,
    stage: 'Baseline ready',
    sources: [{
      id: 'baseline',
      name: 'Local settlement baseline',
      category: 'place',
      lat: location.lat,
      lon: location.lon,
      bearing: 180,
      distanceKm: 0.8,
      flux: 3,
    }],
    builtAreaKm2: 0,
    roadLengthKm: 0,
    message,
  }
}

function yieldToDisplay() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0))
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  parentSignal?.addEventListener('abort', abort, { once: true })
  const timeout = window.setTimeout(abort, timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
    parentSignal?.removeEventListener('abort', abort)
  }
}

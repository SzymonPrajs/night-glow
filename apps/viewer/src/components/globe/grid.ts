// Pure geometry and colour mapping for Globe display products. No MapLibre
// imports here — this module turns typed products into GeoJSON-ready cell
// features so it can be unit-tested without a browser.
import type {
  CoverageStatus,
  DataValidity,
  EnvironmentDisplayProduct,
} from '../../lib/contracts/types.ts'

export type CellStateClass = 'valid' | 'dark' | 'invalid'

export interface CellFeature {
  /** Closed polygon ring [lon, lat] with the first point repeated at the end. */
  ring: [number, number][]
  center: [number, number]
  index: number
  value: number
  validity: DataValidity
  coverageStatus: CoverageStatus | null
  stateClass: CellStateClass
  color: string
}

export interface ProductGeometry {
  longitudes: number[]
  latitudes: number[]
  coverageByIndex?: (CoverageStatus | null)[]
}

/** n axis centres -> n+1 cell edges (midpoints, outer edges extrapolated). */
export function cellEdges(centers: number[]): number[] {
  if (centers.length === 0) return []
  if (centers.length === 1) return [centers[0] - 0.005, centers[0] + 0.005]
  const edges: number[] = []
  for (let i = 0; i < centers.length - 1; i += 1) {
    edges.push((centers[i] + centers[i + 1]) / 2)
  }
  const firstStep = edges[0] - centers[0]
  const lastStep = centers[centers.length - 1] - edges[edges.length - 1]
  return [centers[0] - firstStep, ...edges, centers[centers.length - 1] + lastStep]
}

export interface Ramp {
  /** Normalized stops: position 0..1 -> CSS rgb() colour. */
  stops: [number, string][]
  /** Maps a physical value to 0..1 within the declared domain. */
  normalize: (value: number) => number
  normalizationLabel: string
  domainLabel: string
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function rampColor(stops: [number, string][], t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [t0, c0] = stops[i]
    const [t1, c1] = stops[i + 1]
    if (clamped <= t1) {
      const span = t1 - t0 || 1
      const f = (clamped - t0) / span
      const [r0, g0, b0] = hexToRgb(c0)
      const [r1, g1, b1] = hexToRgb(c1)
      const mix = (a: number, b: number) => Math.round(a + (b - a) * f)
      return `rgb(${mix(r0, r1)}, ${mix(g0, g1)}, ${mix(b0, b1)})`
    }
  }
  const [, last] = stops[stops.length - 1]
  const [r, g, b] = hexToRgb(last)
  return `rgb(${r}, ${g}, ${b})`
}

const EMISSION_STOPS: [number, string][] = [
  [0, '#0b1220'],
  [0.35, '#3a2c1a'],
  [0.65, '#8a5a2a'],
  [0.88, '#f0b269'],
  [1, '#ffe4b8'],
]

const PRESSURE_STOPS: [number, string][] = [
  [0, '#0b1220'],
  [0.35, '#173a5e'],
  [0.65, '#2f6db3'],
  [0.88, '#8dc8ff'],
  [1, '#dff0ff'],
]

const GENERIC_ATMOSPHERE_STOPS: [number, string][] = [
  [0, '#0b1220'],
  [0.4, '#1d4450'],
  [0.7, '#2f8a83'],
  [1, '#b8f0e0'],
]

function extent(values: number[]): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const value of values) {
    if (value < min) min = value
    if (value > max) max = value
  }
  return [min, max]
}

/** Per-product normalization. Emission uses a log10 domain (labelled); the
 * atmosphere fixture products use linear domains over their value extent. */
export function rampForProduct(product: EnvironmentDisplayProduct): Ramp {
  if (product.source_domain === 'emission') {
    const positive = product.values.filter((value) => value > 0)
    const floor = positive.length > 0 ? Math.min(...positive) / 10 : 1e-3
    const [, max] = extent(product.values)
    const top = Math.max(max, floor * 10)
    const normalize = (value: number) => {
      const clamped = Math.max(value, floor)
      return (Math.log10(clamped) - Math.log10(floor)) / (Math.log10(top) - Math.log10(floor))
    }
    return {
      stops: EMISSION_STOPS,
      normalize,
      normalizationLabel: 'log10',
      domainLabel: `${floor.toPrecision(2)}–${top} ${product.unit} (below floor shown at floor)`,
    }
  }
  const [min, max] = extent(product.values)
  const span = max - min || 1
  const stops = product.quantity.includes('pressure') ? PRESSURE_STOPS : GENERIC_ATMOSPHERE_STOPS
  return {
    stops,
    normalize: (value) => (value - min) / span,
    normalizationLabel: 'linear',
    domainLabel: `${min}–${max} ${product.unit}`,
  }
}

function classify(validity: DataValidity, coverage: CoverageStatus | null): CellStateClass {
  if (coverage === 'supported_dark_or_upper_bound') return 'dark'
  return validity === 'valid' ? 'valid' : 'invalid'
}

/** Builds cell features in product axis order ([latitude, longitude], row-major). */
export function buildCellFeatures(
  product: EnvironmentDisplayProduct,
  geometry: ProductGeometry,
  ramp: Ramp,
): CellFeature[] {
  const [latCount, lonCount] = product.shape
  const lonEdges = cellEdges(geometry.longitudes)
  const latEdges = cellEdges(geometry.latitudes)
  const features: CellFeature[] = []
  for (let i = 0; i < latCount; i += 1) {
    for (let j = 0; j < lonCount; j += 1) {
      const index = i * lonCount + j
      const validity = product.data_validity[index] ?? 'missing'
      const coverageStatus = geometry.coverageByIndex?.[index] ?? null
      const value = product.values[index]
      const stateClass = classify(validity, coverageStatus)
      const west = lonEdges[j]
      const east = lonEdges[j + 1]
      const south = latEdges[i]
      const north = latEdges[i + 1]
      features.push({
        ring: [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
        center: [(west + east) / 2, (south + north) / 2],
        index,
        value,
        validity,
        coverageStatus,
        stateClass,
        color:
          stateClass === 'invalid'
            ? 'rgba(93, 108, 136, 0.35)'
            : stateClass === 'dark'
              ? 'rgba(11, 18, 32, 0.85)'
              : rampColor(ramp.stops, ramp.normalize(value)),
      })
    }
  }
  return features
}

export function graticuleFeatures(stepDeg = 10): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (let lon = -180; lon <= 180; lon += stepDeg) {
    features.push({
      type: 'Feature',
      properties: { kind: 'graticule' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [lon, -85],
          [lon, 85],
        ],
      },
    })
  }
  for (let lat = -80; lat <= 80; lat += stepDeg) {
    features.push({
      type: 'Feature',
      properties: { kind: 'graticule' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-180, lat],
          [180, lat],
        ],
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

export function cellsToGeoJSON(features: CellFeature[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features.map((cell) => ({
      type: 'Feature',
      properties: {
        index: cell.index,
        value: cell.value,
        validity: cell.validity,
        coverageStatus: cell.coverageStatus,
        stateClass: cell.stateClass,
        color: cell.color,
      },
      geometry: { type: 'Polygon', coordinates: [cell.ring] },
    })),
  }
}

/** Halo anchors (cell centres + normalized weight) for the emission emphasis layer. */
export function haloGeoJSON(features: CellFeature[], ramp: Ramp): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features
      .filter((cell) => cell.stateClass === 'valid')
      .map((cell) => ({
        type: 'Feature',
        properties: { weight: ramp.normalize(cell.value) },
        geometry: { type: 'Point', coordinates: cell.center },
      })),
  }
}

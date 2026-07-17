export const SPECTRAL_BANDS = [
  { id: 'violet', wavelengthNm: 420, widthNm: 30 },
  { id: 'blue', wavelengthNm: 450, widthNm: 30 },
  { id: 'blueGreen', wavelengthNm: 480, widthNm: 30 },
  { id: 'cyan', wavelengthNm: 510, widthNm: 30 },
  { id: 'green', wavelengthNm: 550, widthNm: 40 },
  { id: 'sodium', wavelengthNm: 589, widthNm: 38 },
  { id: 'orangeRed', wavelengthNm: 625, widthNm: 35 },
  { id: 'red', wavelengthNm: 680, widthNm: 55 },
] as const

export const SPECTRAL_BAND_COUNT = SPECTRAL_BANDS.length

export type GeoPoint = {
  lat: number
  lon: number
}

export type SpectralFluxInput = readonly number[] | Float64Array

export type EmissionEvidence =
  | 'calibrated-inventory'
  | 'measured-radiance'
  | 'built-population-proxy'
  | 'road-proxy'

export const EVIDENCE_PRECEDENCE: Readonly<Record<EmissionEvidence, number>> = {
  'calibrated-inventory': 400,
  'measured-radiance': 300,
  'built-population-proxy': 200,
  'road-proxy': 100,
}

type EmissionSourceBase = {
  id: string
  name: string
  component: string
  /**
   * Candidates that estimate the same physical light must share a coverageId.
   * Only the highest-precedence evidence for a coverageId is deposited.
   */
  coverageId: string
  evidence: EmissionEvidence
  /** Overrides the normal evidence ordering for an explicitly calibrated layer. */
  precedence?: number
  spectralFlux: SpectralFluxInput
  provenance?: string
}

export type EllipseEmissionSource = EmissionSourceBase & {
  geometry: 'ellipse'
  center: GeoPoint
  /** Ellipse radii, not full diameters. */
  semiMajorKm: number
  semiMinorKm: number
  /** Clockwise from north. */
  rotationDeg: number
}

export type PolygonEmissionSource = EmissionSourceBase & {
  geometry: 'polygon'
  vertices: readonly GeoPoint[]
}

export type RoadEmissionSource = EmissionSourceBase & {
  geometry: 'road'
  points: readonly GeoPoint[]
  widthKm: number
}

export type EmissionSource = EllipseEmissionSource | PolygonEmissionSource | RoadEmissionSource

export type PolarRing = {
  index: number
  innerKm: number
  outerKm: number
  midpointKm: number
  widthKm: number
  resolution: 'detailed' | 'tail'
}

export type IsotropicFallback = {
  /** This flux has no invented bearing or distance and is never written to grid cells. */
  spectralFlux: Float64Array
  reason: string
}

export type EmissionSourceReport = {
  id: string
  name: string
  component: string
  coverageId: string
  status: 'deposited' | 'partially-outside-domain' | 'outside-domain' | 'superseded'
  selectedEvidence: EmissionEvidence
  supersededBy?: string[]
  sampleCount: number
  depositedFraction: number
  inputSpectralFlux: number[]
  depositedSpectralFlux: number[]
  outsideDomainSpectralFlux: number[]
}

export type RingFluxDiagnostic = {
  ring: PolarRing
  spectralFlux: number[]
  totalFlux: number
  cumulativeSpectralFlux: number[]
  cumulativeTotalFlux: number
  cumulativeFraction: number
  componentTotals: Readonly<Record<string, number>>
}

export type ComponentFluxDiagnostic = {
  component: string
  spectralFlux: number[]
  totalFlux: number
  fractionOfDeposited: number
  ringTotals: number[]
}

export type ConservationDiagnostic = {
  acceptedSpectralFlux: number[]
  depositedSpectralFlux: number[]
  outsideDomainSpectralFlux: number[]
  residualSpectralFlux: number[]
  maxRelativeError: number
}

export type EmissionDiagnostics = {
  candidateSpectralFlux: number[]
  supersededSpectralFlux: number[]
  conservation: ConservationDiagnostic
  rings: RingFluxDiagnostic[]
  components: ComponentFluxDiagnostic[]
  sources: EmissionSourceReport[]
}

export type EmissionGrid = {
  mode: 'directional' | 'isotropic-only'
  observer: GeoPoint
  sectorCount: number
  sectorWidthDeg: number
  rings: readonly PolarRing[]
  bands: typeof SPECTRAL_BANDS
  fluxUnit: string
  /** Flattened as ((ring * sectorCount + sector) * bandCount + band). */
  values: Float64Array
  /** Flattened as ring * bandCount + band, one array per physical component. */
  componentRingValues: ReadonlyMap<string, Float64Array>
  isotropicFallback?: IsotropicFallback
  diagnostics: EmissionDiagnostics
}

export type BuildEmissionGridOptions = {
  observer: GeoPoint
  sources: readonly EmissionSource[]
  fluxUnit?: string
  sampleSpacingKm?: number
  maxSamplesPerSource?: number
  fallback?: {
    spectralFlux: SpectralFluxInput
    reason: string
  }
}

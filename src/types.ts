export type Location = {
  lat: number
  lon: number
  label: string
}

export type Atmosphere = {
  /** Aerosol optical depth at 550 nm. */
  aerosol: number
  /** Relative humidity as a 0..1 fraction. */
  humidity: number
  /** Fractional cloud coverage as a 0..1 fraction. */
  cloud: number
  /** Cloud base above the observer in kilometres. */
  cloudBase: number
  angstromExponent: number
  aerosolScaleHeightKm: number
  aerosolSingleScatteringAlbedo: number
  aerosolAsymmetry: number
  cloudThicknessKm: number
  cloudOpticalDepth: number
  groundAlbedo: number
  maxScatteringOrder: number
}

export type LightSource = {
  id: string
  name: string
  category: 'built' | 'road' | 'place'
  lat: number
  lon: number
  bearing: number
  distanceKm: number
  flux: number
  areaKm2?: number
  lengthKm?: number
  geometry?: {
    type: 'polygon' | 'line'
    points: Array<{ lat: number; lon: number }>
  }
  population?: number
  provenance?: string
}

export type MapAnalysis = {
  status: 'idle' | 'loading' | 'live' | 'fallback' | 'error'
  progress: number
  stage: string
  sources: LightSource[]
  builtAreaKm2: number
  roadLengthKm: number
  message?: string
}

export type SkyMetrics = {
  zenithMag: number
  limitingMagnitude: number
  bortle: number
  glowIndex: number
  visibleStars: number
}

export type Location = {
  lat: number
  lon: number
  label: string
}

export type Atmosphere = {
  aerosol: number
  humidity: number
  cloud: number
  cloudBase: number
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

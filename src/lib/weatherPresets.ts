import type { Atmosphere } from '../types'

export type WeatherPreset = {
  id: string
  name: string
  summary: string
  values: Atmosphere
}

const NUMERICAL_SCATTER_ORDERS = 4
const TEMPERATE_GROUND_ALBEDO = 0.15

export const WEATHER_PRESETS: readonly WeatherPreset[] = [
  {
    id: 'crisp',
    name: 'Crisp clear',
    summary: 'Very dry · exceptional transparency',
    values: {
      aerosol: 0.04, humidity: 0.28, cloud: 0, cloudBase: 8, angstromExponent: 1.5,
      aerosolScaleHeightKm: 1.2, aerosolSingleScatteringAlbedo: 0.91, aerosolAsymmetry: 0.62,
      cloudThicknessKm: 1.5, cloudOpticalDepth: 0, groundAlbedo: TEMPERATE_GROUND_ALBEDO,
      maxScatteringOrder: NUMERICAL_SCATTER_ORDERS,
    },
  },
  {
    id: 'typical',
    name: 'Typical clear',
    summary: 'Poland mean AOD · cloudless',
    values: {
      aerosol: 0.14, humidity: 0.5, cloud: 0, cloudBase: 6.5, angstromExponent: 1.3,
      aerosolScaleHeightKm: 1.4, aerosolSingleScatteringAlbedo: 0.92, aerosolAsymmetry: 0.68,
      cloudThicknessKm: 1.8, cloudOpticalDepth: 0, groundAlbedo: TEMPERATE_GROUND_ALBEDO,
      maxScatteringOrder: NUMERICAL_SCATTER_ORDERS,
    },
  },
  {
    id: 'humid',
    name: 'Humid',
    summary: 'Moist air · a little low cloud',
    values: {
      aerosol: 0.1, humidity: 0.82, cloud: 0.12, cloudBase: 2.5, angstromExponent: 1.2,
      aerosolScaleHeightKm: 1.5, aerosolSingleScatteringAlbedo: 0.95, aerosolAsymmetry: 0.74,
      cloudThicknessKm: 1.3, cloudOpticalDepth: 4, groundAlbedo: TEMPERATE_GROUND_ALBEDO,
      maxScatteringOrder: NUMERICAL_SCATTER_ORDERS,
    },
  },
  {
    id: 'winter-smog',
    name: 'Winter smog',
    summary: 'Dense fine aerosol · shallow inversion',
    values: {
      aerosol: 0.4, humidity: 0.82, cloud: 0.05, cloudBase: 2.8, angstromExponent: 1.65,
      aerosolScaleHeightKm: 0.55, aerosolSingleScatteringAlbedo: 0.94, aerosolAsymmetry: 0.7,
      cloudThicknessKm: 0.8, cloudOpticalDepth: 2, groundAlbedo: 0.18,
      maxScatteringOrder: NUMERICAL_SCATTER_ORDERS,
    },
  },
  {
    id: 'thin-cirrus',
    name: 'Thin cirrus',
    summary: 'High veil · optical depth 0.25',
    values: {
      aerosol: 0.1, humidity: 0.5, cloud: 0.65, cloudBase: 8.5, angstromExponent: 1.35,
      aerosolScaleHeightKm: 1.3, aerosolSingleScatteringAlbedo: 0.93, aerosolAsymmetry: 0.69,
      cloudThicknessKm: 2, cloudOpticalDepth: 0.25, groundAlbedo: TEMPERATE_GROUND_ALBEDO,
      maxScatteringOrder: NUMERICAL_SCATTER_ORDERS,
    },
  },
  {
    id: 'broken-low',
    name: 'Broken low cloud',
    summary: '55% cover · bright local patches',
    values: {
      aerosol: 0.14, humidity: 0.8, cloud: 0.55, cloudBase: 1, angstromExponent: 1.15,
      aerosolScaleHeightKm: 1.1, aerosolSingleScatteringAlbedo: 0.95, aerosolAsymmetry: 0.75,
      cloudThicknessKm: 1, cloudOpticalDepth: 6, groundAlbedo: TEMPERATE_GROUND_ALBEDO,
      maxScatteringOrder: NUMERICAL_SCATTER_ORDERS,
    },
  },
  {
    id: 'low-overcast',
    name: 'Low overcast',
    summary: 'Opaque deck · strong urban bounce',
    values: {
      aerosol: 0.14, humidity: 0.85, cloud: 1, cloudBase: 0.8, angstromExponent: 1.15,
      aerosolScaleHeightKm: 1.1, aerosolSingleScatteringAlbedo: 0.95, aerosolAsymmetry: 0.75,
      cloudThicknessKm: 1, cloudOpticalDepth: 15, groundAlbedo: TEMPERATE_GROUND_ALBEDO,
      maxScatteringOrder: NUMERICAL_SCATTER_ORDERS,
    },
  },
  {
    id: 'snow-overcast',
    name: 'Snow overcast',
    summary: 'Low deck · reflective snow cover',
    values: {
      aerosol: 0.14, humidity: 0.88, cloud: 1, cloudBase: 0.7, angstromExponent: 1.15,
      aerosolScaleHeightKm: 1.1, aerosolSingleScatteringAlbedo: 0.95, aerosolAsymmetry: 0.75,
      cloudThicknessKm: 1, cloudOpticalDepth: 15, groundAlbedo: 0.65,
      maxScatteringOrder: NUMERICAL_SCATTER_ORDERS,
    },
  },
] as const

export const DEFAULT_WEATHER_PRESET_ID = 'typical'

export const DEFAULT_ATMOSPHERE: Atmosphere = {
  ...WEATHER_PRESETS.find((preset) => preset.id === DEFAULT_WEATHER_PRESET_ID)!.values,
}

const ATMOSPHERE_FIELDS = Object.keys(DEFAULT_ATMOSPHERE) as Array<keyof Atmosphere>

export function atmosphereMatchesPreset(
  atmosphere: Atmosphere,
  preset: WeatherPreset | Atmosphere,
) {
  const values = 'values' in preset ? preset.values : preset
  return ATMOSPHERE_FIELDS.every((field) => Math.abs(atmosphere[field] - values[field]) <= 1e-9)
}

export function findWeatherPreset(atmosphere: Atmosphere) {
  return WEATHER_PRESETS.find((preset) => atmosphereMatchesPreset(atmosphere, preset))
}

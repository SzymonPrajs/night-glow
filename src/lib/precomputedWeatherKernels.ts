import type { Atmosphere } from '../types'
import { POLAR_RINGS, SPECTRAL_BANDS } from './emission'
import type { PhysicalGlowKernelGrid } from './physicalGlowProtocol'
import {
  atmosphericKernelCacheKey,
  DEFAULT_RELATIVE_AZIMUTHS_DEG,
  DEFAULT_SKY_ELEVATIONS_DEG,
  type AtmosphereInput,
  type KernelGridSpec,
  type RadiativeTransferInput,
  type SpectralBand,
} from './physics'
import { findWeatherPreset, type WeatherPreset } from './weatherPresets'

const WORKER_DISTANCE_CANDIDATES_KM = [
  0.125, 0.375, 0.75, 1.5, 3, 7.5, 15, 30, 45, 75, 150, 250, 400, 600, 800,
]
const MAXIMUM_RING_DISTANCE_KM = Math.max(...POLAR_RINGS.map((ring) => ring.midpointKm))

/** Keep this layout in lockstep with physicalGlow.worker.ts::makeKernelGrid. */
export const PRECOMPUTED_WEATHER_KERNEL_GRID: Readonly<KernelGridSpec> = Object.freeze({
  distancesKm: Object.freeze([
    ...new Set(
      WORKER_DISTANCE_CANDIDATES_KM
        .filter((distanceKm) => distanceKm <= MAXIMUM_RING_DISTANCE_KM)
        .concat(MAXIMUM_RING_DISTANCE_KM),
    ),
  ].sort((a, b) => a - b)),
  relativeAzimuthsDeg: DEFAULT_RELATIVE_AZIMUTHS_DEG,
  elevationsDeg: DEFAULT_SKY_ELEVATIONS_DEG,
})

/** Keep these IDs and widths in lockstep with physicalGlow.worker.ts::bandsFromWavelengths. */
export const PRECOMPUTED_WEATHER_KERNEL_BANDS: readonly SpectralBand[] = Object.freeze(
  SPECTRAL_BANDS.map((band, index) => Object.freeze({
    id: `band-${index}-${band.wavelengthNm}nm`,
    wavelengthNm: band.wavelengthNm,
    widthNm: 40,
  })),
)

export const PRECOMPUTED_WEATHER_KERNEL_VALUE_COUNT =
  PRECOMPUTED_WEATHER_KERNEL_GRID.distancesKm.length *
  PRECOMPUTED_WEATHER_KERNEL_GRID.elevationsDeg.length *
  PRECOMPUTED_WEATHER_KERNEL_GRID.relativeAzimuthsDeg.length *
  PRECOMPUTED_WEATHER_KERNEL_BANDS.length

export const PRECOMPUTED_WEATHER_KERNEL_BYTE_LENGTH =
  PRECOMPUTED_WEATHER_KERNEL_VALUE_COUNT * Float32Array.BYTES_PER_ELEMENT

export const PRECOMPUTED_WEATHER_TRANSFER_OPTIONS: Readonly<RadiativeTransferInput> = Object.freeze({
  observerAltitudeKm: 0.15,
  atmosphereTopKm: 60,
  multipleScattering: Object.freeze({
    maxOrders: 4,
    tolerance: 0.01,
    maxContinuationRatio: 0.92,
    closeTruncatedTail: true,
  }),
})

export type LoadedPrecomputedWeatherKernel = {
  cacheKey: string
  kernel: PhysicalGlowKernelGrid
}

/**
 * Loads an exact shipped weather preset. Custom slider states deliberately
 * return null and continue through the analytic worker path.
 *
 * No promise, ArrayBuffer, or typed array is retained here: callers may safely
 * transfer every returned buffer to the worker without detaching a future load.
 */
export async function loadPrecomputedWeatherKernel(
  atmosphere: Atmosphere,
  signal?: AbortSignal,
): Promise<LoadedPrecomputedWeatherKernel | null> {
  const preset = findWeatherPreset(atmosphere)
  if (!preset) return null

  const cacheKey = precomputedWeatherKernelCacheKey(preset)
  const response = await fetch(precomputedWeatherKernelAssetUrl(preset, cacheKey), {
    cache: 'force-cache',
    signal,
  })
  if (!response.ok) {
    throw new Error(`Unable to load ${preset.name} atmosphere kernel (${response.status})`)
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength !== PRECOMPUTED_WEATHER_KERNEL_BYTE_LENGTH) {
    throw new Error(
      `${preset.name} atmosphere kernel is ${buffer.byteLength.toLocaleString()} bytes; ` +
      `expected ${PRECOMPUTED_WEATHER_KERNEL_BYTE_LENGTH.toLocaleString()}`,
    )
  }

  return {
    cacheKey,
    kernel: {
      distanceKm: Float32Array.from(PRECOMPUTED_WEATHER_KERNEL_GRID.distancesKm),
      relativeAzimuthDeg: Float32Array.from(PRECOMPUTED_WEATHER_KERNEL_GRID.relativeAzimuthsDeg),
      elevationDeg: Float32Array.from(PRECOMPUTED_WEATHER_KERNEL_GRID.elevationsDeg),
      wavelengthsNm: Float32Array.from(PRECOMPUTED_WEATHER_KERNEL_BANDS, (band) => band.wavelengthNm),
      values: littleEndianFloat32(buffer),
      radianceUnit: 'relative-radiance-per-unit-upward-spectral-power',
      confidence: 1,
    },
  }
}

export function precomputedWeatherKernelAssetUrl(
  preset: WeatherPreset,
  cacheKey = precomputedWeatherKernelCacheKey(preset),
) {
  const baseUrl = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
  return `${baseUrl}kernels/weather-${preset.id}.f32?kernel=${encodeURIComponent(cacheKey)}`
}

export function precomputedWeatherKernelCacheKey(preset: WeatherPreset) {
  return atmosphericKernelCacheKey(
    atmosphereInput(preset.values),
    PRECOMPUTED_WEATHER_KERNEL_GRID,
    transferOptions(preset),
    PRECOMPUTED_WEATHER_KERNEL_BANDS,
  )
}

export function precomputedWeatherAtmosphereInput(atmosphere: Atmosphere): AtmosphereInput {
  return atmosphereInput(atmosphere)
}

export function precomputedWeatherTransferOptions(preset: WeatherPreset): RadiativeTransferInput {
  return transferOptions(preset)
}

function atmosphereInput(atmosphere: Atmosphere): AtmosphereInput {
  return {
    aerosolOpticalDepth550: atmosphere.aerosol,
    angstromExponent: atmosphere.angstromExponent,
    aerosolScaleHeightKm: atmosphere.aerosolScaleHeightKm,
    aerosolSingleScatteringAlbedo: atmosphere.aerosolSingleScatteringAlbedo,
    aerosolAsymmetry: atmosphere.aerosolAsymmetry,
    relativeHumidity: atmosphere.humidity,
    groundAlbedo: atmosphere.groundAlbedo,
    cloud: {
      coverage: atmosphere.cloud,
      baseAltitudeKm: atmosphere.cloudBase,
      thicknessKm: atmosphere.cloudThicknessKm,
      opticalDepth: atmosphere.cloudOpticalDepth,
    },
  }
}

function transferOptions(preset: WeatherPreset): RadiativeTransferInput {
  return {
    ...PRECOMPUTED_WEATHER_TRANSFER_OPTIONS,
    multipleScattering: {
      ...PRECOMPUTED_WEATHER_TRANSFER_OPTIONS.multipleScattering,
      maxOrders: preset.values.maxScatteringOrder,
    },
  }
}

function littleEndianFloat32(buffer: ArrayBuffer) {
  const endianProbe = new Uint16Array([1])
  if (new Uint8Array(endianProbe.buffer)[0] === 1) return new Float32Array(buffer)

  const source = new DataView(buffer)
  const values = new Float32Array(PRECOMPUTED_WEATHER_KERNEL_VALUE_COUNT)
  for (let index = 0; index < values.length; index += 1) {
    values[index] = source.getFloat32(index * Float32Array.BYTES_PER_ELEMENT, true)
  }
  return values
}

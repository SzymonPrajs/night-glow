import {
  nonNegativeFinite,
  normalizeAtmosphere,
  normalizeRadiativeTransferOptions,
  prepareAtmosphere,
} from './atmosphere'
import { DEFAULT_KERNEL_GRID, DEFAULT_SPECTRAL_BANDS } from './constants'
import { angularDistanceDegrees } from './geometry'
import { computePreparedUnitSourceSpectrum } from './radiativeTransfer'
import type {
  AtmosphereInput,
  AsyncKernelBuildOptions,
  AtmosphericKernel,
  KernelBuildOptions,
  KernelGridSpec,
  RadiativeTransferInput,
  SerializedAtmosphericKernel,
  SpectralBand,
} from './types'

/**
 * Cache/asset ABI for the numerical transfer model.
 *
 * Increment this whenever kernel-producing maths changes, even if the
 * atmosphere, grid, options, and bands have not. Serialized-kernel schema
 * versioning is separate from this numerical-model revision.
 */
export const ATMOSPHERIC_KERNEL_MODEL_REVISION = 2

export function buildAtmosphericKernel(
  atmosphereInput: AtmosphereInput = {},
  gridInput: KernelGridSpec = DEFAULT_KERNEL_GRID,
  buildOptions: KernelBuildOptions = {},
): AtmosphericKernel {
  const context = prepareKernelBuild(atmosphereInput, gridInput, buildOptions)

  for (let distance = 0; distance < context.grid.distancesKm.length; distance += 1) {
    for (let elevation = 0; elevation < context.grid.elevationsDeg.length; elevation += 1) {
      for (let azimuth = 0; azimuth < context.grid.relativeAzimuthsDeg.length; azimuth += 1) {
        computeKernelCell(context, distance, elevation, azimuth)
        reportKernelProgress(context, buildOptions.onProgress)
      }
    }
  }
  return finishKernelBuild(context)
}

/**
 * Worker-friendly kernel construction. Numerical cells are identical to the
 * synchronous builder, but periodic task yields allow cancellation messages
 * to be processed before a stale slider request finishes the whole grid.
 */
export async function buildAtmosphericKernelAsync(
  atmosphereInput: AtmosphereInput = {},
  gridInput: KernelGridSpec = DEFAULT_KERNEL_GRID,
  buildOptions: AsyncKernelBuildOptions = {},
): Promise<AtmosphericKernel> {
  const context = prepareKernelBuild(atmosphereInput, gridInput, buildOptions)
  const yieldEvery = Math.max(16, Math.floor(buildOptions.yieldEvery ?? 128))
  if (buildOptions.shouldCancel?.()) throw new Error('Atmospheric kernel build cancelled')

  for (let distance = 0; distance < context.grid.distancesKm.length; distance += 1) {
    for (let elevation = 0; elevation < context.grid.elevationsDeg.length; elevation += 1) {
      for (let azimuth = 0; azimuth < context.grid.relativeAzimuthsDeg.length; azimuth += 1) {
        computeKernelCell(context, distance, elevation, azimuth)
        reportKernelProgress(context, buildOptions.onProgress)
        if (context.completed % yieldEvery === 0 && context.completed < context.totalCells) {
          await yieldToEventLoop()
          if (buildOptions.shouldCancel?.()) throw new Error('Atmospheric kernel build cancelled')
        }
      }
    }
  }
  return finishKernelBuild(context)
}

type KernelBuildContext = ReturnType<typeof prepareKernelBuild>

function prepareKernelBuild(
  atmosphereInput: AtmosphereInput,
  gridInput: KernelGridSpec,
  buildOptions: KernelBuildOptions,
) {
  const grid = normalizeKernelGrid(gridInput)
  const bands = normalizeBands(buildOptions.bands ?? DEFAULT_SPECTRAL_BANDS)
  const atmosphere = prepareAtmosphere(atmosphereInput, bands)
  const options = normalizeRadiativeTransferOptions(toRadiativeTransferInput(buildOptions))
  const totalCells = grid.distancesKm.length * grid.elevationsDeg.length * grid.relativeAzimuthsDeg.length
  return {
    grid,
    bands,
    atmosphere,
    options,
    values: new Float32Array(totalCells * bands.length),
    totalCells,
    completed: 0,
    maxOrdersUsed: 0,
  }
}

function computeKernelCell(
  context: KernelBuildContext,
  distanceIndex: number,
  elevationIndex: number,
  azimuthIndex: number,
) {
  const spectrum = computePreparedUnitSourceSpectrum(
    context.grid.distancesKm[distanceIndex],
    context.grid.relativeAzimuthsDeg[azimuthIndex],
    context.grid.elevationsDeg[elevationIndex],
    context.atmosphere,
    context.options,
  )
  const base = kernelValueIndex(
    distanceIndex,
    elevationIndex,
    azimuthIndex,
    0,
    context.grid,
    context.bands.length,
  )
  for (let band = 0; band < context.bands.length; band += 1) {
    context.values[base + band] = nonNegativeFinite(spectrum.radiance[band])
    context.maxOrdersUsed = Math.max(context.maxOrdersUsed, spectrum.ordersUsed[band])
  }
  context.completed += 1
}

function reportKernelProgress(
  context: KernelBuildContext,
  onProgress: KernelBuildOptions['onProgress'],
) {
  if (onProgress && (context.completed === context.totalCells || context.completed % 16 === 0)) {
    onProgress(context.completed, context.totalCells)
  }
}

function finishKernelBuild(context: KernelBuildContext): AtmosphericKernel {
  return {
    version: 1,
    key: atmosphericKernelCacheKey(
      context.atmosphere.state,
      context.grid,
      context.options,
      context.bands,
    ),
    bands: context.bands,
    grid: context.grid,
    atmosphere: context.atmosphere.state,
    options: context.options,
    values: context.values,
    units: 'relative-radiance-per-unit-upward-spectral-power',
    maxOrdersUsed: context.maxOrdersUsed,
  }
}

function yieldToEventLoop() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

export function atmosphericKernelCacheKey(
  atmosphereInput: AtmosphereInput,
  gridInput: KernelGridSpec,
  optionsInput: RadiativeTransferInput = {},
  bandsInput: readonly SpectralBand[] = DEFAULT_SPECTRAL_BANDS,
) {
  const atmosphere = normalizeAtmosphere(atmosphereInput)
  const grid = normalizeKernelGrid(gridInput)
  const options = normalizeRadiativeTransferOptions(optionsInput)
  const bands = normalizeBands(bandsInput)
  const description = JSON.stringify({
    modelRevision: ATMOSPHERIC_KERNEL_MODEL_REVISION,
    atmosphere,
    grid,
    options,
    bands,
  })
  return `atmosphere-v${ATMOSPHERIC_KERNEL_MODEL_REVISION}-${fnv1a(description)}`
}

/** Trilinear lookup. Relative azimuth is folded to [0, 180] by symmetry. */
export function sampleAtmosphericKernel(
  kernel: AtmosphericKernel,
  distanceKm: number,
  relativeAzimuthDeg: number,
  elevationDeg: number,
  output = new Float64Array(kernel.bands.length),
) {
  if (output.length < kernel.bands.length) throw new Error('Output spectrum is shorter than the kernel band count')
  const distance = findBracket(kernel.grid.distancesKm, distanceKm)
  const elevation = findBracket(kernel.grid.elevationsDeg, elevationDeg)
  const azimuth = findBracket(kernel.grid.relativeAzimuthsDeg, angularDistanceDegrees(relativeAzimuthDeg, 0))
  output.fill(0)
  for (let distanceCorner = 0; distanceCorner < 2; distanceCorner += 1) {
    const di = distanceCorner === 0 ? distance.lower : distance.upper
    const dw = distanceCorner === 0 ? 1 - distance.fraction : distance.fraction
    for (let elevationCorner = 0; elevationCorner < 2; elevationCorner += 1) {
      const ei = elevationCorner === 0 ? elevation.lower : elevation.upper
      const ew = elevationCorner === 0 ? 1 - elevation.fraction : elevation.fraction
      for (let azimuthCorner = 0; azimuthCorner < 2; azimuthCorner += 1) {
        const ai = azimuthCorner === 0 ? azimuth.lower : azimuth.upper
        const aw = azimuthCorner === 0 ? 1 - azimuth.fraction : azimuth.fraction
        const weight = dw * ew * aw
        if (weight === 0) continue
        const base = kernelValueIndex(di, ei, ai, 0, kernel.grid, kernel.bands.length)
        for (let bandIndex = 0; bandIndex < kernel.bands.length; bandIndex += 1) {
          output[bandIndex] += kernel.values[base + bandIndex] * weight
        }
      }
    }
  }
  for (let bandIndex = 0; bandIndex < kernel.bands.length; bandIndex += 1) {
    output[bandIndex] = nonNegativeFinite(output[bandIndex])
  }
  return output
}

export function serializeAtmosphericKernel(kernel: AtmosphericKernel): SerializedAtmosphericKernel {
  return { ...kernel, values: Array.from(kernel.values) }
}

export function deserializeAtmosphericKernel(serialized: SerializedAtmosphericKernel): AtmosphericKernel {
  if (serialized.version !== 1) throw new Error(`Unsupported atmospheric kernel version ${serialized.version}`)
  const grid = normalizeKernelGrid(serialized.grid)
  const bands = normalizeBands(serialized.bands)
  const expectedLength =
    grid.distancesKm.length * grid.elevationsDeg.length * grid.relativeAzimuthsDeg.length * bands.length
  if (serialized.values.length !== expectedLength) {
    throw new Error(`Atmospheric kernel has ${serialized.values.length} values; expected ${expectedLength}`)
  }
  const values = Float32Array.from(serialized.values, nonNegativeFinite)
  const restored: AtmosphericKernel = {
    ...serialized,
    bands,
    grid,
    atmosphere: normalizeAtmosphere(serialized.atmosphere),
    options: normalizeRadiativeTransferOptions(serialized.options),
    values,
  }
  const expectedKey = atmosphericKernelCacheKey(restored.atmosphere, grid, restored.options, bands)
  if (restored.key !== expectedKey) throw new Error('Atmospheric kernel cache key does not match its contents')
  return restored
}

export function kernelValueIndex(
  distanceIndex: number,
  elevationIndex: number,
  azimuthIndex: number,
  bandIndex: number,
  grid: KernelGridSpec,
  bandCount: number,
) {
  return (((distanceIndex * grid.elevationsDeg.length + elevationIndex) *
    grid.relativeAzimuthsDeg.length + azimuthIndex) * bandCount + bandIndex)
}

function normalizeKernelGrid(grid: KernelGridSpec): KernelGridSpec {
  const distancesKm = finiteSortedUnique(grid.distancesKm, 'kernel distances', 0, 20000)
  const relativeAzimuthsDeg = finiteSortedUnique(grid.relativeAzimuthsDeg, 'relative azimuths', 0, 180)
  const elevationsDeg = finiteSortedUnique(grid.elevationsDeg, 'elevations', 0, 90)
  if (relativeAzimuthsDeg[0] !== 0 || relativeAzimuthsDeg[relativeAzimuthsDeg.length - 1] !== 180) {
    throw new Error('Relative-azimuth grid must include both 0 and 180 degrees')
  }
  return { distancesKm, relativeAzimuthsDeg, elevationsDeg }
}

function normalizeBands(bands: readonly SpectralBand[]) {
  if (!bands.length) throw new Error('At least one spectral band is required')
  const ids = new Set<string>()
  return bands.map((band, index) => {
    const id = band.id || `band-${index}`
    if (ids.has(id)) throw new Error(`Duplicate spectral band id ${id}`)
    ids.add(id)
    if (!Number.isFinite(band.wavelengthNm) || band.wavelengthNm <= 0) {
      throw new Error(`Invalid wavelength for spectral band ${id}`)
    }
    if (!Number.isFinite(band.widthNm) || band.widthNm <= 0) {
      throw new Error(`Invalid width for spectral band ${id}`)
    }
    return { id, wavelengthNm: band.wavelengthNm, widthNm: band.widthNm }
  })
}

function finiteSortedUnique(
  values: readonly number[],
  label: string,
  minimum: number,
  maximum: number,
) {
  if (!values.length) throw new Error(`${label} cannot be empty`)
  const result = Array.from(new Set(values))
  for (const value of result) {
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new Error(`${label} must contain finite values between ${minimum} and ${maximum}`)
    }
  }
  result.sort((a, b) => a - b)
  return result
}

function findBracket(values: readonly number[], rawValue: number) {
  const value = Number.isFinite(rawValue) ? rawValue : values[0]
  if (value <= values[0]) return { lower: 0, upper: 0, fraction: 0 }
  const last = values.length - 1
  if (value >= values[last]) return { lower: last, upper: last, fraction: 0 }
  let low = 0
  let high = last
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (values[middle] <= value) low = middle
    else high = middle
  }
  return {
    lower: low,
    upper: high,
    fraction: (value - values[low]) / (values[high] - values[low]),
  }
}

function toRadiativeTransferInput(options: KernelBuildOptions): RadiativeTransferInput {
  return {
    atmosphereTopKm: options.atmosphereTopKm,
    observerAltitudeKm: options.observerAltitudeKm,
    sourceAltitudeKm: options.sourceAltitudeKm,
    sourceRadiusKm: options.sourceRadiusKm,
    emissionProfile: options.emissionProfile,
    multipleScattering: options.multipleScattering,
  }
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

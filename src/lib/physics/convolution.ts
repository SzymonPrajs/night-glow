import { nonNegativeFinite } from './atmosphere'
import { sampleAtmosphericKernel } from './kernel'
import type {
  AtmosphericKernel,
  ConvolutionPlanOptions,
  RingConvolutionPlan,
  RingEmissionField,
  SpectralSkyField,
} from './types'

/**
 * Wraps an arbitrary polar emission array without coupling this module to the
 * map/emission implementation. Values are spectral upward power in
 * [ring][sector][band] order.
 */
export function createRingEmissionField(
  ringDistancesKm: readonly number[],
  sectorCount: number,
  bandIds: readonly string[],
  spectralPower?: Float64Array,
  azimuthOffsetDeg = 0,
): RingEmissionField {
  const rings = normalizeRingDistances(ringDistancesKm)
  const sectors = normalizeSectorCount(sectorCount)
  const bands = normalizeBandIds(bandIds)
  const expectedLength = rings.length * sectors * bands.length
  const values = spectralPower ?? new Float64Array(expectedLength)
  if (values.length !== expectedLength) {
    throw new Error(`Ring emission field has ${values.length} values; expected ${expectedLength}`)
  }
  validateNonNegativeArray(values, 'Ring emission field')
  return {
    ringDistancesKm: rings,
    sectorCount: sectors,
    azimuthOffsetDeg: normalizeAzimuth(azimuthOffsetDeg),
    bandIds: bands,
    spectralPower: values,
  }
}

/** Adds one non-negative source spectrum to an existing ring/sector cell. */
export function addRingSectorSpectrum(
  field: RingEmissionField,
  ringIndex: number,
  sectorIndex: number,
  spectrum: ArrayLike<number>,
  scale = 1,
) {
  if (!Number.isInteger(ringIndex) || ringIndex < 0 || ringIndex >= field.ringDistancesKm.length) {
    throw new Error(`Ring index ${ringIndex} is outside the emission field`)
  }
  if (!Number.isInteger(sectorIndex) || sectorIndex < 0 || sectorIndex >= field.sectorCount) {
    throw new Error(`Sector index ${sectorIndex} is outside the emission field`)
  }
  if (spectrum.length !== field.bandIds.length) {
    throw new Error(`Source spectrum has ${spectrum.length} bands; expected ${field.bandIds.length}`)
  }
  if (!Number.isFinite(scale) || scale < 0) throw new Error('Source spectrum scale must be finite and non-negative')
  const base = (ringIndex * field.sectorCount + sectorIndex) * field.bandIds.length
  for (let bandIndex = 0; bandIndex < field.bandIds.length; bandIndex += 1) {
    const value = spectrum[bandIndex]
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Source spectrum band ${bandIndex} must be finite and non-negative`)
    }
    field.spectralPower[base + bandIndex] += value * scale
  }
}

/**
 * Precomputes the circular-convolution transfer functions for a particular
 * ring layout. The kernel's even relative-azimuth response is represented by
 * a real cosine series up to the angular resolution supported by its grid.
 */
export function createRingConvolutionPlan(
  kernel: AtmosphericKernel,
  ringDistancesKm: readonly number[],
  sectorCount: number,
  elevationsDeg: readonly number[] = kernel.grid.elevationsDeg,
  planOptions: ConvolutionPlanOptions = {},
): RingConvolutionPlan {
  const configuration = normalizePlanConfiguration(
    kernel,
    ringDistancesKm,
    sectorCount,
    elevationsDeg,
    planOptions,
  )
  const {
    rings,
    sectors,
    elevations,
    bandIds,
    harmonicCount,
  } = configuration
  const harmonicWidth = harmonicCount + 1
  const cosineTable = new Float64Array(harmonicWidth * sectors)
  const sineTable = new Float64Array(harmonicWidth * sectors)
  for (let harmonic = 0; harmonic <= harmonicCount; harmonic += 1) {
    const tableBase = harmonic * sectors
    for (let sector = 0; sector < sectors; sector += 1) {
      const phase = 2 * Math.PI * harmonic * sector / sectors
      cosineTable[tableBase + sector] = Math.cos(phase)
      sineTable[tableBase + sector] = Math.sin(phase)
    }
  }

  const bandCount = bandIds.length
  const kernelHarmonics = new Float64Array(
    elevations.length * rings.length * bandCount * harmonicWidth,
  )
  // Odd oversampling avoids a special Nyquist coefficient and integrates the
  // piecewise-linear angular kernel much more accurately than its native grid.
  const angularSampleCount = Math.max(33, 4 * harmonicCount + 1)
  const quadratureCosines = new Float64Array(harmonicWidth * angularSampleCount)
  for (let harmonic = 0; harmonic <= harmonicCount; harmonic += 1) {
    const row = harmonic * angularSampleCount
    for (let sample = 0; sample < angularSampleCount; sample += 1) {
      quadratureCosines[row + sample] = Math.cos(2 * Math.PI * harmonic * sample / angularSampleCount)
    }
  }
  const spectrum = new Float64Array(bandCount)
  const coefficients = new Float64Array(bandCount * harmonicWidth)

  for (let elevationIndex = 0; elevationIndex < elevations.length; elevationIndex += 1) {
    for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
      coefficients.fill(0)
      for (let sample = 0; sample < angularSampleCount; sample += 1) {
        const relativeAzimuthDeg = 360 * sample / angularSampleCount
        sampleAtmosphericKernel(
          kernel,
          rings[ringIndex],
          relativeAzimuthDeg,
          elevations[elevationIndex],
          spectrum,
        )
        for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
          const weightedValue = spectrum[bandIndex] / angularSampleCount
          const coefficientBase = bandIndex * harmonicWidth
          for (let harmonic = 0; harmonic <= harmonicCount; harmonic += 1) {
            coefficients[coefficientBase + harmonic] +=
              weightedValue * quadratureCosines[harmonic * angularSampleCount + sample]
          }
        }
      }
      for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
        const destination = planHarmonicIndex(
          elevationIndex,
          ringIndex,
          bandIndex,
          0,
          rings.length,
          bandCount,
          harmonicWidth,
        )
        const source = bandIndex * harmonicWidth
        kernelHarmonics.set(coefficients.subarray(source, source + harmonicWidth), destination)
      }
    }
  }

  return {
    version: 1,
    key: planKey(configuration, kernel.key),
    kernelKey: kernel.key,
    ringDistancesKm: rings,
    elevationsDeg: elevations,
    sectorCount: sectors,
    bandIds,
    harmonicCount,
    kernelHarmonics,
    cosineTable,
    sineTable,
  }
}

/** Returns the key before doing the comparatively expensive harmonic precomputation. */
export function ringConvolutionPlanCacheKey(
  kernel: AtmosphericKernel,
  ringDistancesKm: readonly number[],
  sectorCount: number,
  elevationsDeg: readonly number[] = kernel.grid.elevationsDeg,
  planOptions: ConvolutionPlanOptions = {},
) {
  const configuration = normalizePlanConfiguration(
    kernel,
    ringDistancesKm,
    sectorCount,
    elevationsDeg,
    planOptions,
  )
  return planKey(configuration, kernel.key)
}

/**
 * Fast all-sky convolution. Work scales as O(R B M N + E B M (R + N))
 * instead of the direct O(E R B N^2), where M is normally only 36 for the
 * default five-degree angular kernel.
 */
export function convolveRingEmissionField(
  kernel: AtmosphericKernel,
  field: RingEmissionField,
  elevationsDeg: readonly number[] = kernel.grid.elevationsDeg,
  suppliedPlan?: RingConvolutionPlan,
): SpectralSkyField {
  validateField(kernel, field)
  const plan = suppliedPlan ?? createRingConvolutionPlan(
    kernel,
    field.ringDistancesKm,
    field.sectorCount,
    elevationsDeg,
  )
  validatePlan(kernel, field, elevationsDeg, plan)

  const ringCount = field.ringDistancesKm.length
  const sectorCount = field.sectorCount
  const bandCount = field.bandIds.length
  const elevationCount = plan.elevationsDeg.length
  const harmonicWidth = plan.harmonicCount + 1
  const transformLength = ringCount * bandCount * harmonicWidth
  const sourceReal = new Float64Array(transformLength)
  const sourceImaginary = new Float64Array(transformLength)

  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
      const transformBase = (ringIndex * bandCount + bandIndex) * harmonicWidth
      for (let harmonic = 0; harmonic <= plan.harmonicCount; harmonic += 1) {
        const tableBase = harmonic * sectorCount
        let real = 0
        let imaginary = 0
        for (let sector = 0; sector < sectorCount; sector += 1) {
          const inputIndex = (ringIndex * sectorCount + sector) * bandCount + bandIndex
          const power = field.spectralPower[inputIndex]
          real += power * plan.cosineTable[tableBase + sector]
          imaginary -= power * plan.sineTable[tableBase + sector]
        }
        sourceReal[transformBase + harmonic] = real
        sourceImaginary[transformBase + harmonic] = imaginary
      }
    }
  }

  const skyTransformLength = elevationCount * bandCount * harmonicWidth
  const skyReal = new Float64Array(skyTransformLength)
  const skyImaginary = new Float64Array(skyTransformLength)
  for (let elevationIndex = 0; elevationIndex < elevationCount; elevationIndex += 1) {
    for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
      const skyBase = (elevationIndex * bandCount + bandIndex) * harmonicWidth
      for (let harmonic = 0; harmonic <= plan.harmonicCount; harmonic += 1) {
        let real = 0
        let imaginary = 0
        for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
          const transfer = plan.kernelHarmonics[planHarmonicIndex(
            elevationIndex,
            ringIndex,
            bandIndex,
            harmonic,
            ringCount,
            bandCount,
            harmonicWidth,
          )]
          const source = (ringIndex * bandCount + bandIndex) * harmonicWidth + harmonic
          real += transfer * sourceReal[source]
          imaginary += transfer * sourceImaginary[source]
        }
        skyReal[skyBase + harmonic] = real
        skyImaginary[skyBase + harmonic] = imaginary
      }
    }
  }

  const radiance = new Float32Array(elevationCount * sectorCount * bandCount)
  for (let elevationIndex = 0; elevationIndex < elevationCount; elevationIndex += 1) {
    for (let sector = 0; sector < sectorCount; sector += 1) {
      for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
        const skyBase = (elevationIndex * bandCount + bandIndex) * harmonicWidth
        let value = skyReal[skyBase]
        for (let harmonic = 1; harmonic <= plan.harmonicCount; harmonic += 1) {
          const tableIndex = harmonic * sectorCount + sector
          value += 2 * (
            skyReal[skyBase + harmonic] * plan.cosineTable[tableIndex] -
            skyImaginary[skyBase + harmonic] * plan.sineTable[tableIndex]
          )
        }
        radiance[(elevationIndex * sectorCount + sector) * bandCount + bandIndex] =
          nonNegativeFinite(value)
      }
    }
  }

  const azimuthsDeg = Array.from(
    { length: sectorCount },
    (_, sector) => normalizeAzimuth(field.azimuthOffsetDeg + 360 * sector / sectorCount),
  )
  return {
    azimuthsDeg,
    elevationsDeg: plan.elevationsDeg,
    bandIds: plan.bandIds,
    radiance,
  }
}

function planHarmonicIndex(
  elevationIndex: number,
  ringIndex: number,
  bandIndex: number,
  harmonic: number,
  ringCount: number,
  bandCount: number,
  harmonicWidth: number,
) {
  return (((elevationIndex * ringCount + ringIndex) * bandCount + bandIndex) * harmonicWidth + harmonic)
}

function normalizePlanConfiguration(
  kernel: AtmosphericKernel,
  ringDistancesKm: readonly number[],
  sectorCount: number,
  elevationsDeg: readonly number[],
  planOptions: ConvolutionPlanOptions,
) {
  const rings = normalizeRingDistances(ringDistancesKm)
  const sectors = normalizeSectorCount(sectorCount)
  const elevations = elevationsDeg.map((elevation) => {
    if (!Number.isFinite(elevation) || elevation < 0 || elevation > 90) {
      throw new Error('Convolution elevations must be finite values from 0 to 90 degrees')
    }
    return elevation
  })
  if (!elevations.length) throw new Error('At least one convolution elevation is required')
  const bandIds = normalizeBandIds(kernel.bands.map((band) => band.id))
  const maximumGap = kernel.grid.relativeAzimuthsDeg.reduce(
    (gap, value, index, values) => index === 0 ? gap : Math.max(gap, value - values[index - 1]),
    0,
  )
  const angularNyquist = maximumGap > 0 ? Math.floor(180 / maximumGap) : 0
  const sectorNyquist = Math.floor((sectors - 1) / 2)
  const requested = planOptions.maxHarmonics ?? angularNyquist
  if (!Number.isFinite(requested) || requested < 0) {
    throw new Error('Maximum harmonic count must be finite and non-negative')
  }
  const harmonicCount = Math.min(Math.floor(requested), angularNyquist, sectorNyquist)
  return { rings, sectors, elevations, bandIds, harmonicCount }
}

function planKey(
  configuration: ReturnType<typeof normalizePlanConfiguration>,
  kernelKey: string,
) {
  const description = JSON.stringify({ version: 1, kernelKey, ...configuration })
  return `ring-convolution-v1-${fnv1a(description)}`
}

function validateField(kernel: AtmosphericKernel, field: RingEmissionField) {
  normalizeSectorCount(field.sectorCount)
  const expectedLength = field.ringDistancesKm.length * field.sectorCount * field.bandIds.length
  if (field.spectralPower.length !== expectedLength) {
    throw new Error(`Ring emission field has ${field.spectralPower.length} values; expected ${expectedLength}`)
  }
  validateNonNegativeArray(field.spectralPower, 'Ring emission field')
  assertSameStrings(field.bandIds, kernel.bands.map((band) => band.id), 'emission field and kernel bands')
}

function validatePlan(
  kernel: AtmosphericKernel,
  field: RingEmissionField,
  elevationsDeg: readonly number[],
  plan: RingConvolutionPlan,
) {
  if (plan.version !== 1 || plan.kernelKey !== kernel.key) {
    throw new Error('Convolution plan was built for a different atmospheric kernel')
  }
  if (plan.sectorCount !== field.sectorCount) {
    throw new Error('Convolution plan sector count does not match the emission field')
  }
  assertSameNumbers(plan.ringDistancesKm, field.ringDistancesKm, 'convolution plan and emission rings')
  assertSameNumbers(plan.elevationsDeg, elevationsDeg, 'convolution plan and requested elevations')
  assertSameStrings(plan.bandIds, field.bandIds, 'convolution plan and emission bands')
  const harmonicWidth = plan.harmonicCount + 1
  const expectedHarmonics =
    plan.elevationsDeg.length * plan.ringDistancesKm.length * plan.bandIds.length * harmonicWidth
  if (plan.kernelHarmonics.length !== expectedHarmonics) throw new Error('Invalid convolution plan harmonics')
  if (plan.cosineTable.length !== harmonicWidth * plan.sectorCount ||
      plan.sineTable.length !== harmonicWidth * plan.sectorCount) {
    throw new Error('Invalid convolution plan trigonometric tables')
  }
}

function normalizeRingDistances(distances: readonly number[]) {
  if (!distances.length) throw new Error('At least one ring distance is required')
  return distances.map((distance) => {
    if (!Number.isFinite(distance) || distance < 0) {
      throw new Error('Ring distances must be finite and non-negative')
    }
    return distance
  })
}

function normalizeSectorCount(sectorCount: number) {
  if (!Number.isInteger(sectorCount) || sectorCount < 3) {
    throw new Error('Sector count must be an integer of at least three')
  }
  return sectorCount
}

function normalizeBandIds(bandIds: readonly string[]) {
  if (!bandIds.length) throw new Error('At least one spectral band is required')
  const result = bandIds.map((id) => String(id))
  if (result.some((id) => !id)) throw new Error('Spectral band ids cannot be empty')
  if (new Set(result).size !== result.length) throw new Error('Spectral band ids must be unique')
  return result
}

function validateNonNegativeArray(values: ArrayLike<number>, label: string) {
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index]) || values[index] < 0) {
      throw new Error(`${label} value ${index} must be finite and non-negative`)
    }
  }
}

function assertSameNumbers(left: readonly number[], right: readonly number[], label: string) {
  if (left.length !== right.length || left.some((value, index) => value !== right[index])) {
    throw new Error(`${label} do not match`)
  }
}

function assertSameStrings(left: readonly string[], right: readonly string[], label: string) {
  if (left.length !== right.length || left.some((value, index) => value !== right[index])) {
    throw new Error(`${label} do not match`)
  }
}

function normalizeAzimuth(value: number) {
  if (!Number.isFinite(value)) return 0
  return ((value % 360) + 360) % 360
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

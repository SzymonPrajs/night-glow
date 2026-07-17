import { nonNegativeFinite } from './atmosphere'
import { linearConvolutionFftSize, transformRadix2 } from './fft'
import { sampleAtmosphericKernel } from './kernel'
import type {
  AtmosphericKernel,
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
 * Samples every non-negative angular kernel onto the output bearing grid and
 * precomputes its real FFT. Zero-padded linear convolution is folded back onto
 * the circle at solve time, so no truncated Fourier series or negative Gibbs
 * lobes are introduced.
 */
export function createRingConvolutionPlan(
  kernel: AtmosphericKernel,
  ringDistancesKm: readonly number[],
  sectorCount: number,
  elevationsDeg: readonly number[] = kernel.grid.elevationsDeg,
): RingConvolutionPlan {
  const configuration = normalizePlanConfiguration(
    kernel,
    ringDistancesKm,
    sectorCount,
    elevationsDeg,
  )
  const {
    rings,
    sectors,
    elevations,
    bandIds,
  } = configuration
  const bandCount = bandIds.length
  const fftSize = linearConvolutionFftSize(sectors)
  const frequencyBinCount = fftSize / 2 + 1
  const kernelFrequencySpectrum = new Float32Array(
    elevations.length * rings.length * bandCount * frequencyBinCount * 2,
  )
  const kernelMeanTransfer = new Float32Array(
    elevations.length * rings.length * bandCount,
  )
  const real = new Float64Array(fftSize)
  const imaginary = new Float64Array(fftSize)
  const spectrum = new Float64Array(bandCount)
  const spatialKernel = new Float64Array(bandCount * sectors)

  for (let elevationIndex = 0; elevationIndex < elevations.length; elevationIndex += 1) {
    for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
      for (let sector = 0; sector < sectors; sector += 1) {
        sampleAtmosphericKernel(
          kernel,
          rings[ringIndex],
          360 * sector / sectors,
          elevations[elevationIndex],
          spectrum,
        )
        for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
          spatialKernel[bandIndex * sectors + sector] = spectrum[bandIndex]
        }
      }

      for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
        real.fill(0)
        imaginary.fill(0)
        const spatialBase = bandIndex * sectors
        for (let sector = 0; sector < sectors; sector += 1) {
          real[sector] = spatialKernel[spatialBase + sector]
        }
        transformRadix2(real, imaginary)
        const meanIndex = kernelMeanIndex(
          elevationIndex,
          ringIndex,
          bandIndex,
          rings.length,
          bandCount,
        )
        kernelMeanTransfer[meanIndex] = real[0] / sectors
        const frequencyBase = meanIndex * frequencyBinCount * 2
        for (let frequency = 0; frequency < frequencyBinCount; frequency += 1) {
          kernelFrequencySpectrum[frequencyBase + frequency * 2] = real[frequency]
          kernelFrequencySpectrum[frequencyBase + frequency * 2 + 1] = imaginary[frequency]
        }
      }
    }
  }

  return {
    version: 2,
    key: planKey(configuration, kernel.key),
    kernelKey: kernel.key,
    ringDistancesKm: rings,
    elevationsDeg: elevations,
    sectorCount: sectors,
    bandIds,
    fftSize,
    frequencyBinCount,
    kernelFrequencySpectrum,
    kernelMeanTransfer,
  }
}

/** Returns the key before doing the comparatively expensive FFT precomputation. */
export function ringConvolutionPlanCacheKey(
  kernel: AtmosphericKernel,
  ringDistancesKm: readonly number[],
  sectorCount: number,
  elevationsDeg: readonly number[] = kernel.grid.elevationsDeg,
) {
  const configuration = normalizePlanConfiguration(
    kernel,
    ringDistancesKm,
    sectorCount,
    elevationsDeg,
  )
  return planKey(configuration, kernel.key)
}

/** Fast positive circular convolution using cached kernel FFTs. */
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
  const frequencyBinCount = plan.frequencyBinCount
  const sourceFrequencySpectrum = new Float64Array(
    ringCount * bandCount * frequencyBinCount * 2,
  )
  const real = new Float64Array(plan.fftSize)
  const imaginary = new Float64Array(plan.fftSize)

  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
      real.fill(0)
      imaginary.fill(0)
      for (let sector = 0; sector < sectorCount; sector += 1) {
        real[sector] = field.spectralPower[
          (ringIndex * sectorCount + sector) * bandCount + bandIndex
        ]
      }
      transformRadix2(real, imaginary)
      const destinationBase = sourceFrequencyIndex(
        ringIndex,
        bandIndex,
        0,
        bandCount,
        frequencyBinCount,
      )
      for (let frequency = 0; frequency < frequencyBinCount; frequency += 1) {
        sourceFrequencySpectrum[destinationBase + frequency * 2] = real[frequency]
        sourceFrequencySpectrum[destinationBase + frequency * 2 + 1] = imaginary[frequency]
      }
    }
  }

  const radiance = new Float32Array(elevationCount * sectorCount * bandCount)
  for (let elevationIndex = 0; elevationIndex < elevationCount; elevationIndex += 1) {
    for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
      real.fill(0)
      imaginary.fill(0)
      for (let frequency = 0; frequency < frequencyBinCount; frequency += 1) {
        let accumulatedReal = 0
        let accumulatedImaginary = 0
        for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
          const kernelIndex = kernelFrequencyIndex(
            elevationIndex,
            ringIndex,
            bandIndex,
            frequency,
            ringCount,
            bandCount,
            frequencyBinCount,
          )
          const sourceIndex = sourceFrequencyIndex(
            ringIndex,
            bandIndex,
            frequency,
            bandCount,
            frequencyBinCount,
          )
          const kernelReal = plan.kernelFrequencySpectrum[kernelIndex]
          const kernelImaginary = plan.kernelFrequencySpectrum[kernelIndex + 1]
          const sourceReal = sourceFrequencySpectrum[sourceIndex]
          const sourceImaginary = sourceFrequencySpectrum[sourceIndex + 1]
          accumulatedReal += kernelReal * sourceReal - kernelImaginary * sourceImaginary
          accumulatedImaginary += kernelReal * sourceImaginary + kernelImaginary * sourceReal
        }
        real[frequency] = accumulatedReal
        imaginary[frequency] = frequency === 0 || frequency === plan.fftSize / 2
          ? 0
          : accumulatedImaginary
        const mirror = plan.fftSize - frequency
        if (frequency > 0 && mirror !== frequency) {
          real[mirror] = accumulatedReal
          imaginary[mirror] = -accumulatedImaginary
        }
      }
      transformRadix2(real, imaginary, true)
      for (let sector = 0; sector < sectorCount; sector += 1) {
        const wrappedTail = sector + sectorCount < sectorCount * 2 - 1
          ? real[sector + sectorCount]
          : 0
        radiance[(elevationIndex * sectorCount + sector) * bandCount + bandIndex] =
          nonNegativeFinite(real[sector] + wrappedTail)
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

function kernelFrequencyIndex(
  elevationIndex: number,
  ringIndex: number,
  bandIndex: number,
  frequency: number,
  ringCount: number,
  bandCount: number,
  frequencyBinCount: number,
) {
  return ((((elevationIndex * ringCount + ringIndex) * bandCount + bandIndex) *
    frequencyBinCount + frequency) * 2)
}

function sourceFrequencyIndex(
  ringIndex: number,
  bandIndex: number,
  frequency: number,
  bandCount: number,
  frequencyBinCount: number,
) {
  return (((ringIndex * bandCount + bandIndex) * frequencyBinCount + frequency) * 2)
}

function kernelMeanIndex(
  elevationIndex: number,
  ringIndex: number,
  bandIndex: number,
  ringCount: number,
  bandCount: number,
) {
  return ((elevationIndex * ringCount + ringIndex) * bandCount + bandIndex)
}

function normalizePlanConfiguration(
  kernel: AtmosphericKernel,
  ringDistancesKm: readonly number[],
  sectorCount: number,
  elevationsDeg: readonly number[],
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
  return { rings, sectors, elevations, bandIds, convolution: 'positive-real-fft-v2' as const }
}

function planKey(
  configuration: ReturnType<typeof normalizePlanConfiguration>,
  kernelKey: string,
) {
  const description = JSON.stringify({ version: 2, kernelKey, ...configuration })
  return `ring-convolution-v2-${fnv1a(description)}`
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
  if (plan.version !== 2 || plan.kernelKey !== kernel.key) {
    throw new Error('Convolution plan was built for a different atmospheric kernel')
  }
  if (plan.sectorCount !== field.sectorCount) {
    throw new Error('Convolution plan sector count does not match the emission field')
  }
  assertSameNumbers(plan.ringDistancesKm, field.ringDistancesKm, 'convolution plan and emission rings')
  assertSameNumbers(plan.elevationsDeg, elevationsDeg, 'convolution plan and requested elevations')
  assertSameStrings(plan.bandIds, field.bandIds, 'convolution plan and emission bands')
  const expectedMeans = plan.elevationsDeg.length * plan.ringDistancesKm.length * plan.bandIds.length
  const expectedSpectrum = expectedMeans * plan.frequencyBinCount * 2
  if (plan.fftSize !== linearConvolutionFftSize(plan.sectorCount) ||
      plan.frequencyBinCount !== plan.fftSize / 2 + 1 ||
      plan.kernelMeanTransfer.length !== expectedMeans ||
      plan.kernelFrequencySpectrum.length !== expectedSpectrum) {
    throw new Error('Invalid convolution plan frequency spectrum')
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

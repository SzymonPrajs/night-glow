import assert from 'node:assert/strict'
import {
  buildEmissionGrid,
  createRegionalSettlementSources,
  POLAR_RINGS,
} from '../src/lib/emission'
import {
  buildAtmosphericKernel,
  convolveRingEmissionField,
  createRingConvolutionPlan,
  createRingEmissionField,
} from '../src/lib/physics'
import { NATURAL_SKY_LUMINANCE } from '../src/lib/appearance'
import {
  PRECOMPUTED_WEATHER_KERNEL_BANDS,
  PRECOMPUTED_WEATHER_KERNEL_GRID,
  precomputedWeatherAtmosphereInput,
  precomputedWeatherTransferOptions,
} from '../src/lib/precomputedWeatherKernels'
import { cloudAdjustedLimitingMagnitude, directCloudTransmission } from '../src/lib/starAppearance'
import { WEATHER_PRESETS, type WeatherPreset } from '../src/lib/weatherPresets'

const WARSAW = { name: 'Warsaw centre', lat: 52.2297, lon: 21.0122 }
const WARSAW_TYPICAL_CLEAR_SQM = 17.551
const MAXIMUM_CALIBRATION_ERROR_MAG = 0.25
const DARK_SKY_LIMITING_MAGNITUDE = 7.15
const LIMITING_MAGNITUDE_SLOPE = 1.18

const started = performance.now()
const emissionStarted = performance.now()
const emission = buildEmissionGrid({
  observer: WARSAW,
  sources: createRegionalSettlementSources(),
  sampleSpacingKm: 0.5,
  maxSamplesPerSource: 4096,
})
const emissionMs = performance.now() - emissionStarted
assert(emission.values.every(isFiniteNonNegative), 'Warsaw emission grid must be finite and non-negative')

// Use the exact shipped worker grid, bands, and transfer options.
const bands = PRECOMPUTED_WEATHER_KERNEL_BANDS
const kernelGrid = PRECOMPUTED_WEATHER_KERNEL_GRID
const field = createRingEmissionField(
  POLAR_RINGS.map((ring) => ring.midpointKm),
  emission.sectorCount,
  bands.map((band) => band.id),
  emission.values,
  180 / emission.sectorCount,
)

const results: PresetAudit[] = []
for (const preset of WEATHER_PRESETS) {
  results.push(solvePreset(preset))
  // Each plan is about 111 MiB. The solve function lets it become unreachable
  // before the next preset; exposed GC makes that memory release deterministic.
  ;(globalThis as { gc?: () => void }).gc?.()
}

const typical = requiredResult('typical')
assert(
  Math.abs(typical.zenithSqm - WARSAW_TYPICAL_CLEAR_SQM) <= MAXIMUM_CALIBRATION_ERROR_MAG,
  `Typical-clear Warsaw SQM ${typical.zenithSqm.toFixed(3)} left its ` +
    `${WARSAW_TYPICAL_CLEAR_SQM.toFixed(3)} ± ${MAXIMUM_CALIBRATION_ERROR_MAG} calibration`,
)

const lowOvercast = requiredResult('low-overcast')
const snowOvercast = requiredResult('snow-overcast')
const lowOvercastAmplification = totalBrightnessRatio(typical.zenithSqm, lowOvercast.zenithSqm)
const snowOvercastAmplification = totalBrightnessRatio(typical.zenithSqm, snowOvercast.zenithSqm)
assert.equal(lowOvercast.limitingMagnitude, 0, 'Opaque low overcast must eliminate the direct naked-eye limit')
assert(
  lowOvercast.zenithSqm < typical.zenithSqm,
  'Urban low overcast must brighten the modeled background relative to typical clear air',
)
assert(lowOvercastAmplification >= 6 && lowOvercastAmplification <= 10,
  `Low-overcast amplification ${lowOvercastAmplification.toFixed(2)}x left the measured 6-10x range`)
assert(Math.abs(lowOvercastAmplification - 7) <= 0.5,
  `Low-overcast amplification ${lowOvercastAmplification.toFixed(2)}x must remain near 7x`)
assert(snowOvercastAmplification >= 6 && snowOvercastAmplification <= 10,
  `Snow-overcast amplification ${snowOvercastAmplification.toFixed(2)}x left the measured 6-10x range`)

console.table(results.map((result) => ({
  preset: result.name,
  'SQM mag/arcsec²': result.zenithSqm.toFixed(3),
  'art/natural': result.artificialToNatural.toFixed(2),
  'direct Tz': result.directZenithTransmission.toExponential(2),
  'NELM': result.limitingMagnitude.toFixed(2),
  'vs typical': `${totalBrightnessRatio(typical.zenithSqm, result.zenithSqm).toFixed(2)}x`,
  'kernel ms': result.kernelMs.toFixed(0),
  'plan+sky ms': result.propagationMs.toFixed(0),
})))
console.log(
  `Audited ${results.length} shipped ${kernelGrid.distancesKm.length}×` +
  `${kernelGrid.elevationsDeg.length}×${kernelGrid.relativeAzimuthsDeg.length} kernels; ` +
  `Warsaw emission ${emissionMs.toFixed(0)} ms; total ${(performance.now() - started).toFixed(0)} ms.`,
)

function solvePreset(preset: WeatherPreset): PresetAudit {
  const kernelStarted = performance.now()
  const kernel = buildAtmosphericKernel(
    precomputedWeatherAtmosphereInput(preset.values),
    kernelGrid,
    {
      ...precomputedWeatherTransferOptions(preset),
      bands,
    },
  )
  const kernelMs = performance.now() - kernelStarted
  assert(kernel.values.every(isFiniteNonNegative), `${preset.id} kernel must be finite and non-negative`)

  const propagationStarted = performance.now()
  const plan = createRingConvolutionPlan(
    kernel,
    field.ringDistancesKm,
    field.sectorCount,
    kernelGrid.elevationsDeg,
  )
  const sky = convolveRingEmissionField(
    kernel,
    field,
    kernelGrid.elevationsDeg,
    plan,
  )
  assert(sky.radiance.every(isFiniteNonNegative), `${preset.id} sky field must be finite and non-negative`)

  const zenith = zenithMetrics(sky.radiance, sky.elevationsDeg.length - 1, field.sectorCount)
  const artificialToNatural = zenith.artificialLuminance / NATURAL_SKY_LUMINANCE
  const zenithSqm = 21.92 - 2.5 * Math.log10(1 + artificialToNatural)
  const adjustedLimit = cloudAdjustedLimitingMagnitude(
    zenith.backgroundLimitingMagnitude,
    90,
    preset.values,
  )
  const limitingMagnitude = clamp(adjustedLimit, 0, DARK_SKY_LIMITING_MAGNITUDE)
  const directZenithTransmission = directCloudTransmission(90, preset.values)
  const propagationMs = performance.now() - propagationStarted

  for (const [label, value] of Object.entries({
    artificialToNatural,
    zenithSqm,
    limitingMagnitude,
    directZenithTransmission,
  })) {
    assert(Number.isFinite(value) && value >= 0, `${preset.id} ${label} must be finite and non-negative`)
  }

  return {
    id: preset.id,
    name: preset.name,
    zenithSqm,
    artificialToNatural,
    directZenithTransmission,
    limitingMagnitude,
    kernelMs,
    propagationMs,
  }
}

function zenithMetrics(radiance: Float32Array, elevationIndex: number, azimuthCount: number) {
  let artificialLuminance = 0
  let backgroundLimitingMagnitude = 0
  for (let azimuth = 0; azimuth < azimuthCount; azimuth += 1) {
    const base = (elevationIndex * azimuthCount + azimuth) * bands.length
    let red = 0
    let green = 0
    let blue = 0
    for (let band = 0; band < bands.length; band += 1) {
      const value = radiance[base + band]
      const [bandRed, bandGreen, bandBlue] = wavelengthToLinearRgb(bands[band].wavelengthNm)
      red += value * bandRed
      green += value * bandGreen
      blue += value * bandBlue
    }
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    assert(isFiniteNonNegative(luminance), 'Zenith RGB luminance must be finite and non-negative')
    artificialLuminance += luminance / azimuthCount
    backgroundLimitingMagnitude += clamp(
      DARK_SKY_LIMITING_MAGNITUDE - LIMITING_MAGNITUDE_SLOPE * Math.log10(
        1 + luminance / NATURAL_SKY_LUMINANCE,
      ),
      0,
      DARK_SKY_LIMITING_MAGNITUDE,
    ) / azimuthCount
  }
  return { artificialLuminance, backgroundLimitingMagnitude }
}

function requiredResult(id: string) {
  const result = results.find((candidate) => candidate.id === id)
  assert(result, `Missing weather preset ${id}`)
  return result
}

function wavelengthToLinearRgb(wavelengthNm: number) {
  const red = gaussian(wavelengthNm, 610, 43) + 0.28 * gaussian(wavelengthNm, 430, 22)
  const green = gaussian(wavelengthNm, 545, 38)
  const blue = gaussian(wavelengthNm, 450, 31)
  const peak = Math.max(red, green, blue, 1e-9)
  return [red / peak, green / peak, blue / peak] as const
}

function gaussian(value: number, center: number, width: number) {
  return Math.exp(-0.5 * ((value - center) / width) ** 2)
}

function totalBrightnessRatio(referenceSqm: number, comparisonSqm: number) {
  return 10 ** (0.4 * (referenceSqm - comparisonSqm))
}

function isFiniteNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

type PresetAudit = {
  id: string
  name: string
  zenithSqm: number
  artificialToNatural: number
  directZenithTransmission: number
  limitingMagnitude: number
  kernelMs: number
  propagationMs: number
}

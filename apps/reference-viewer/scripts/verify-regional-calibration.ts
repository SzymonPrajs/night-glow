import assert from 'node:assert/strict'
import {
  buildEmissionGrid,
  createRegionalSettlementSources,
  DEFAULT_SETTLEMENT_PROXY_CALIBRATION,
  POLAR_RINGS,
  SECTOR_COUNT,
} from '../src/lib/emission'
import {
  buildAtmosphericKernel,
  convolveRingEmissionField,
  createRingConvolutionPlan,
  createRingEmissionField,
} from '../src/lib/physics'
import { NATURAL_SKY_LUMINANCE } from '../src/lib/photometry'
import {
  PRECOMPUTED_WEATHER_KERNEL_BANDS,
  PRECOMPUTED_WEATHER_KERNEL_GRID,
  precomputedWeatherAtmosphereInput,
  precomputedWeatherTransferOptions,
} from '../src/lib/precomputedWeatherKernels'
import { WEATHER_PRESETS } from '../src/lib/weatherPresets'

const MAXIMUM_ANCHOR_ERROR_MAG = 0.25
const MAXIMUM_RMS_ERROR_MAG = 0.2

// Representative central-Poland zenith SQM anchors under the fixed clear-air
// calibration atmosphere. They constrain relative city size as well as scale.
const ANCHORS = [
  { name: 'Zapolice', lat: 51.5329, lon: 18.9390, targetSqm: 21.279 },
  { name: 'Łowicz', lat: 52.1000, lon: 19.9700, targetSqm: 20.477 },
  { name: 'Łódź centre', lat: 51.7592, lon: 19.4560, targetSqm: 18.096 },
  { name: 'Warsaw centre', lat: 52.2297, lon: 21.0122, targetSqm: 17.551 },
] as const
const typicalPreset = WEATHER_PRESETS.find((preset) => preset.id === 'typical')
assert(typicalPreset, 'The shipped weather scenarios must include Typical clear')
const bands = PRECOMPUTED_WEATHER_KERNEL_BANDS

const sources = createRegionalSettlementSources()
const fields = ANCHORS.map((observer) => {
  const emission = buildEmissionGrid({ observer, sources })
  assert(emission.diagnostics.conservation.maxRelativeError < 1e-9,
    `${observer.name} emission rasterization must conserve calibrated source flux`)
  return createRingEmissionField(
    POLAR_RINGS.map((ring) => ring.midpointKm),
    SECTOR_COUNT,
    bands.map((band) => band.id),
    emission.values,
    180 / SECTOR_COUNT,
  )
})

const kernel = buildAtmosphericKernel(
  precomputedWeatherAtmosphereInput(typicalPreset.values),
  PRECOMPUTED_WEATHER_KERNEL_GRID,
  {
    ...precomputedWeatherTransferOptions(typicalPreset),
    bands,
  },
)
const plan = createRingConvolutionPlan(kernel, fields[0].ringDistancesKm, fields[0].sectorCount)
const skies = fields.map((field) => convolveRingEmissionField(kernel, field, undefined, plan))
const results = skies.map((sky, index) => {
  const artificialLuminance = zenithLuminance(
    sky.radiance,
    sky.elevationsDeg.length - 1,
    fields[index].sectorCount,
  )
  const predictedSqm = 21.92 - 2.5 * Math.log10(
    1 + artificialLuminance / NATURAL_SKY_LUMINANCE,
  )
  const errorMag = predictedSqm - ANCHORS[index].targetSqm
  assert(Math.abs(errorMag) <= MAXIMUM_ANCHOR_ERROR_MAG,
    `${ANCHORS[index].name} SQM error ${errorMag.toFixed(3)} exceeded ${MAXIMUM_ANCHOR_ERROR_MAG}`)
  return {
    name: ANCHORS[index].name,
    targetSqm: ANCHORS[index].targetSqm,
    predictedSqm,
    errorMag,
  }
})

const zapoliceSky = skies[0]
const zapoliceLodzHorizonSqm = sqmFromArtificialLuminance(
  directionalLuminance(zapoliceSky, 0, 55),
)
const zapoliceOppositeHorizonSqm = sqmFromArtificialLuminance(
  directionalLuminance(zapoliceSky, 0, 235),
)
assert(zapoliceLodzHorizonSqm < zapoliceOppositeHorizonSqm - 2,
  'The calibrated Zapolice horizon must be materially brighter toward Łódź than opposite it')

const rmsErrorMag = Math.sqrt(
  results.reduce((sum, result) => sum + result.errorMag ** 2, 0) / results.length,
)
assert(rmsErrorMag <= MAXIMUM_RMS_ERROR_MAG,
  `Regional calibration RMS ${rmsErrorMag.toFixed(3)} exceeded ${MAXIMUM_RMS_ERROR_MAG}`)

console.log(JSON.stringify({
  calibration: DEFAULT_SETTLEMENT_PROXY_CALIBRATION,
  atmosphere: 'shipped-typical-clear',
  maximumAnchorErrorMag: Math.max(...results.map((result) => Math.abs(result.errorMag))),
  rmsErrorMag,
  zapoliceDirectionality: {
    lodzBearingDeg: 55,
    lodzHorizonSqm: zapoliceLodzHorizonSqm,
    oppositeBearingDeg: 235,
    oppositeHorizonSqm: zapoliceOppositeHorizonSqm,
    contrastMag: zapoliceOppositeHorizonSqm - zapoliceLodzHorizonSqm,
  },
  anchors: results,
}, null, 2))

function zenithLuminance(
  radiance: Float32Array,
  elevationIndex: number,
  azimuthCount: number,
) {
  let luminance = 0
  for (let azimuth = 0; azimuth < azimuthCount; azimuth += 1) {
    const base = (elevationIndex * azimuthCount + azimuth) * bands.length
    for (let band = 0; band < bands.length; band += 1) {
      const [red, green, blue] = wavelengthToLinearRgb(bands[band].wavelengthNm)
      luminance += radiance[base + band] *
        (0.2126 * red + 0.7152 * green + 0.0722 * blue) / azimuthCount
    }
  }
  return luminance
}

function directionalLuminance(
  sky: ReturnType<typeof convolveRingEmissionField>,
  elevationIndex: number,
  bearingDeg: number,
) {
  const sector = Math.round(
    ((bearingDeg - sky.azimuthsDeg[0] + 360) % 360) /
    (360 / sky.azimuthsDeg.length),
  ) % sky.azimuthsDeg.length
  const base = (elevationIndex * sky.azimuthsDeg.length + sector) * bands.length
  let luminance = 0
  for (let band = 0; band < bands.length; band += 1) {
    const [red, green, blue] = wavelengthToLinearRgb(bands[band].wavelengthNm)
    luminance += sky.radiance[base + band] *
      (0.2126 * red + 0.7152 * green + 0.0722 * blue)
  }
  return luminance
}

function sqmFromArtificialLuminance(artificialLuminance: number) {
  return 21.92 - 2.5 * Math.log10(1 + artificialLuminance / NATURAL_SKY_LUMINANCE)
}

// Keep this transform identical to the worker's spectral display matrix because
// the app derives SQM from the resulting linear-RGB zenith luminance.
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

import assert from 'node:assert/strict'
import {
  buildEmissionGrid,
  createRegionalSettlementSources,
  DEFAULT_SETTLEMENT_PROXY_CALIBRATION,
  POLAR_RINGS,
  SECTOR_COUNT,
  SPECTRAL_BANDS,
} from '../src/lib/emission'
import {
  buildAtmosphericKernel,
  convolveRingEmissionField,
  createRingConvolutionPlan,
  createRingEmissionField,
} from '../src/lib/physics'
import { NATURAL_SKY_LUMINANCE } from '../src/lib/appearance'

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

const sources = createRegionalSettlementSources()
const fields = ANCHORS.map((observer) => {
  const emission = buildEmissionGrid({ observer, sources })
  assert(emission.diagnostics.conservation.maxRelativeError < 1e-9,
    `${observer.name} emission rasterization must conserve calibrated source flux`)
  return createRingEmissionField(
    POLAR_RINGS.map((ring) => ring.midpointKm),
    SECTOR_COUNT,
    SPECTRAL_BANDS.map((band) => band.id),
    emission.values,
    180 / SECTOR_COUNT,
  )
})

const kernel = buildAtmosphericKernel({
  aerosolOpticalDepth550: 0.14,
  angstromExponent: 1.3,
  aerosolScaleHeightKm: 1.4,
  aerosolSingleScatteringAlbedo: 0.92,
  aerosolAsymmetry: 0.68,
  relativeHumidity: 0.5,
  groundAlbedo: 0.14,
  cloud: { coverage: 0, baseAltitudeKm: 6.5, thicknessKm: 1.8, opticalDepth: 0 },
}, undefined, {
  bands: SPECTRAL_BANDS,
  atmosphereTopKm: 60,
  multipleScattering: {
    maxOrders: 3,
    tolerance: 0.01,
    maxContinuationRatio: 0.92,
    closeTruncatedTail: true,
  },
})
const plan = createRingConvolutionPlan(kernel, fields[0].ringDistancesKm, fields[0].sectorCount)
const results = fields.map((field, index) => {
  const sky = convolveRingEmissionField(kernel, field, undefined, plan)
  const artificialLuminance = zenithLuminance(
    sky.radiance,
    sky.elevationsDeg.length - 1,
    field.sectorCount,
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

const rmsErrorMag = Math.sqrt(
  results.reduce((sum, result) => sum + result.errorMag ** 2, 0) / results.length,
)
assert(rmsErrorMag <= MAXIMUM_RMS_ERROR_MAG,
  `Regional calibration RMS ${rmsErrorMag.toFixed(3)} exceeded ${MAXIMUM_RMS_ERROR_MAG}`)

console.log(JSON.stringify({
  calibration: DEFAULT_SETTLEMENT_PROXY_CALIBRATION,
  atmosphere: 'typical-clear-aod-0.14-rh-0.50-cloud-0',
  maximumAnchorErrorMag: Math.max(...results.map((result) => Math.abs(result.errorMag))),
  rmsErrorMag,
  anchors: results,
}, null, 2))

function zenithLuminance(
  radiance: Float32Array,
  elevationIndex: number,
  azimuthCount: number,
) {
  let luminance = 0
  for (let azimuth = 0; azimuth < azimuthCount; azimuth += 1) {
    const base = (elevationIndex * azimuthCount + azimuth) * SPECTRAL_BANDS.length
    for (let band = 0; band < SPECTRAL_BANDS.length; band += 1) {
      const [red, green, blue] = wavelengthToLinearRgb(SPECTRAL_BANDS[band].wavelengthNm)
      luminance += radiance[base + band] *
        (0.2126 * red + 0.7152 * green + 0.0722 * blue) / azimuthCount
    }
  }
  return luminance
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

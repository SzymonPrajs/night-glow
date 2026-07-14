import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { buildAtmosphericKernel, prepareAtmosphere } from '../src/lib/physics'
import {
  PRECOMPUTED_WEATHER_KERNEL_BANDS,
  PRECOMPUTED_WEATHER_KERNEL_BYTE_LENGTH,
  PRECOMPUTED_WEATHER_KERNEL_GRID,
  PRECOMPUTED_WEATHER_KERNEL_VALUE_COUNT,
  precomputedWeatherAtmosphereInput,
  precomputedWeatherKernelAssetUrl,
  precomputedWeatherKernelCacheKey,
  precomputedWeatherTransferOptions,
} from '../src/lib/precomputedWeatherKernels'
import {
  DEFAULT_WEATHER_PRESET_ID,
  WEATHER_PRESETS,
  atmosphereMatchesPreset,
} from '../src/lib/weatherPresets'
import {
  cloudAdjustedLimitingMagnitude,
  directCloudExtinction,
  directCloudTransmission,
  relativeAirMass,
} from '../src/lib/starAppearance'
import type { Atmosphere } from '../src/types'

const ATMOSPHERE_BOUNDS: Readonly<Record<keyof Atmosphere, readonly [minimum: number, maximum: number]>> = {
  aerosol: [0.02, 0.8],
  humidity: [0, 1],
  cloud: [0, 1],
  cloudBase: [0.3, 10],
  angstromExponent: [0, 2.5],
  aerosolScaleHeightKm: [0.3, 4],
  aerosolSingleScatteringAlbedo: [0.7, 1],
  aerosolAsymmetry: [0.45, 0.9],
  cloudThicknessKm: [0.2, 8],
  cloudOpticalDepth: [0, 80],
  groundAlbedo: [0.04, 0.85],
  maxScatteringOrder: [1, 6],
}
const ATMOSPHERE_FIELDS = Object.keys(ATMOSPHERE_BOUNDS) as Array<keyof Atmosphere>

assert(WEATHER_PRESETS.length >= 6, 'The preset gallery should cover more than the original three weather states')
assert.equal(new Set(WEATHER_PRESETS.map(({ id }) => id)).size, WEATHER_PRESETS.length, 'Preset ids must be unique')
assert(WEATHER_PRESETS.some(({ id }) => id === DEFAULT_WEATHER_PRESET_ID), 'The default preset id must exist')

const signatures = new Set<string>()
const scatteringOrders = new Set<number>()
const precomputedKeys = new Set<string>()
const precomputedHashes = new Set<string>()
const precomputedAssets = new Map<string, Buffer>()
for (const preset of WEATHER_PRESETS) {
  assert.match(preset.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Preset id ${preset.id} must be stable and URL-safe`)
  assert(preset.name.trim().length > 0, `${preset.id} needs a visible name`)
  assert(preset.summary.trim().length > 0, `${preset.id} needs an explanatory summary`)
  assert.deepEqual(
    Object.keys(preset.values).sort(),
    [...ATMOSPHERE_FIELDS].sort(),
    `${preset.id} must specify all 12 atmosphere fields`,
  )

  const signature = ATMOSPHERE_FIELDS.map((field) => `${field}:${preset.values[field]}`).join('|')
  assert(!signatures.has(signature), `${preset.id} duplicates another preset's full atmosphere`)
  signatures.add(signature)
  scatteringOrders.add(preset.values.maxScatteringOrder)

  const precomputedKey = precomputedWeatherKernelCacheKey(preset)
  assert.match(precomputedKey, /^atmosphere-v2-[0-9a-f]{8}$/,
    `${preset.id} must include the current numerical-model revision in its kernel key`)
  assert(!precomputedKeys.has(precomputedKey), `${preset.id} duplicates a precomputed kernel key`)
  precomputedKeys.add(precomputedKey)
  assert(precomputedWeatherKernelAssetUrl(preset, precomputedKey).endsWith(
    `weather-${preset.id}.f32?kernel=${encodeURIComponent(precomputedKey)}`,
  ), `${preset.id} asset URL must be cache-busted by its full kernel key`)
  const asset = readFileSync(new URL(`../public/kernels/weather-${preset.id}.f32`, import.meta.url))
  precomputedAssets.set(preset.id, asset)
  assert.equal(asset.byteLength, PRECOMPUTED_WEATHER_KERNEL_BYTE_LENGTH,
    `${preset.id} precomputed kernel byte length must match its exact grid`)
  const view = new DataView(asset.buffer, asset.byteOffset, asset.byteLength)
  for (let index = 0; index < PRECOMPUTED_WEATHER_KERNEL_VALUE_COUNT; index += 1) {
    const value = view.getFloat32(index * Float32Array.BYTES_PER_ELEMENT, true)
    assert(Number.isFinite(value) && value >= 0,
      `${preset.id} precomputed kernel sample ${index} must be finite and non-negative`)
  }
  const assetHash = createHash('sha256').update(asset).digest('hex')
  assert(!precomputedHashes.has(assetHash), `${preset.id} duplicates another precomputed kernel asset`)
  precomputedHashes.add(assetHash)

  for (const field of ATMOSPHERE_FIELDS) {
    const value = preset.values[field]
    const [minimum, maximum] = ATMOSPHERE_BOUNDS[field]
    assert(Number.isFinite(value), `${preset.id}.${field} must be finite`)
    assert(value >= minimum && value <= maximum,
      `${preset.id}.${field}=${value} is outside the UI range ${minimum}..${maximum}`)
  }

  assert(atmosphereMatchesPreset({ ...preset.values }, preset), `${preset.id} must match an exact full-field copy`)
  for (const field of ATMOSPHERE_FIELDS) {
    const altered = { ...preset.values }
    altered[field] = distinctInRange(altered[field], ATMOSPHERE_BOUNDS[field], field === 'maxScatteringOrder')
    assert(!atmosphereMatchesPreset(altered, preset), `${preset.id} must stop matching when ${field} changes`)
  }

  const prepared = prepareAtmosphere(toPhysicalAtmosphere(preset.values))
  for (const opticalBand of prepared.opticalBands) {
    assert.equal(
      opticalBand.cloudOpticalDepth,
      preset.values.cloud * preset.values.cloudOpticalDepth,
      `${preset.id} must preserve coverage-weighted cloud optical depth`,
    )
  }
}

// Full-grid parity catches a same-sized stale binary, not only malformed asset
// dimensions. Every shipped weather scenario must remain bit-for-bit identical
// to a fresh build from the current numerical model.
for (const preset of WEATHER_PRESETS) {
  const id = preset.id
  const generated = buildAtmosphericKernel(
    precomputedWeatherAtmosphereInput(preset.values),
    PRECOMPUTED_WEATHER_KERNEL_GRID,
    {
      ...precomputedWeatherTransferOptions(preset),
      bands: PRECOMPUTED_WEATHER_KERNEL_BANDS,
    },
  )
  assert.equal(generated.key, precomputedWeatherKernelCacheKey(preset),
    `${id} generated full kernel key must match the shipped asset key`)
  const asset = precomputedAssets.get(id)!
  const view = new DataView(asset.buffer, asset.byteOffset, asset.byteLength)
  for (let index = 0; index < generated.values.length; index += 1) {
    assert.equal(
      view.getFloat32(index * Float32Array.BYTES_PER_ELEMENT, true),
      generated.values[index],
      `${id} shipped kernel differs from the current solver at sample ${index}`,
    )
  }
}

assert.equal(scatteringOrders.size, 1,
  'Weather labels must not silently change numerical scattering accuracy or solver cost')

const lowOvercast = WEATHER_PRESETS.find(({ id }) => id === 'low-overcast')
const thinCirrus = WEATHER_PRESETS.find(({ id }) => id === 'thin-cirrus')
assert(lowOvercast && lowOvercast.values.cloud === 1 && lowOvercast.values.cloudOpticalDepth >= 10,
  'Low overcast must describe an optically thick, fully covered column')
assert(thinCirrus && thinCirrus.values.cloud > 0 && thinCirrus.values.cloudOpticalDepth > 0 &&
  thinCirrus.values.cloudOpticalDepth < 1,
  'Thin cirrus must use a non-zero but optically thin cloud column')

const reducedGrid = {
  distancesKm: [2, 40, 180],
  relativeAzimuthsDeg: [0, 60, 180],
  elevationsDeg: [0, 8, 35],
} as const
const kernels = WEATHER_PRESETS.map((preset) => ({
  preset,
  kernel: buildAtmosphericKernel(
    toPhysicalAtmosphere(preset.values),
    reducedGrid,
    { multipleScattering: { maxOrders: preset.values.maxScatteringOrder } },
  ),
}))

for (const { preset, kernel } of kernels) {
  assert(kernel.values.some((value) => value > 0), `${preset.id} reduced kernel must contain radiance`)
  assert(kernel.values.every((value) => Number.isFinite(value) && value >= 0),
    `${preset.id} reduced kernel must be finite and non-negative`)
}
assert.equal(new Set(kernels.map(({ kernel }) => kernel.key)).size, kernels.length,
  'Every preset must have a distinct atmosphere kernel cache key')
for (let left = 0; left < kernels.length; left += 1) {
  for (let right = left + 1; right < kernels.length; right += 1) {
    assert(arraysDiffer(kernels[left].kernel.values, kernels[right].kernel.values),
      `${kernels[left].preset.id} and ${kernels[right].preset.id} must not produce identical reduced kernels`)
  }
}

assert(relativeAirMass(5) > relativeAirMass(30) && relativeAirMass(30) > relativeAirMass(90),
  'Direct cloud paths must lengthen toward the horizon')
assert.equal(directCloudTransmission(20, { cloud: 0, cloudOpticalDepth: 50 }), 1)
assert(Math.abs(directCloudExtinction(20, { cloud: 0, cloudOpticalDepth: 50 })) === 0)

const thinTransmission = directCloudTransmission(45, { cloud: 1, cloudOpticalDepth: 0.25 })
const thickTransmission = directCloudTransmission(45, { cloud: 1, cloudOpticalDepth: 6 })
const brokenTransmission = directCloudTransmission(45, { cloud: 0.55, cloudOpticalDepth: 6 })
assert(thickTransmission < thinTransmission, 'More optical depth must reduce direct stellar transmission')
assert(thickTransmission < brokenTransmission && brokenTransmission < 1,
  'Partial cloud cover must retain its unresolved clear-sky fraction')
assert(directCloudTransmission(5, { cloud: 1, cloudOpticalDepth: 1 }) <
  directCloudTransmission(60, { cloud: 1, cloudOpticalDepth: 1 }),
  'A low-altitude star must traverse more cloud than a high-altitude star')
assert(directCloudExtinction(45, { cloud: 1, cloudOpticalDepth: 6 }) >
  directCloudExtinction(45, { cloud: 1, cloudOpticalDepth: 0.25 }),
  'Direct extinction in magnitudes must increase with optical depth')
assert.equal(
  cloudAdjustedLimitingMagnitude(6, 45, { cloud: 1, cloudOpticalDepth: 0.25 }),
  6 - directCloudExtinction(45, { cloud: 1, cloudOpticalDepth: 0.25 }),
  'The direct cloud helper must apply the same extinction to the limiting magnitude',
)

console.log(JSON.stringify({
  presets: WEATHER_PRESETS.map(({ id, values }) => ({
    id,
    cloudFraction: values.cloud,
    cloudOpticalDepth: values.cloudOpticalDepth,
    kernelSum: kernels.find(({ preset }) => preset.id === id)!.kernel.values.reduce((sum, value) => sum + value, 0),
  })),
  defaultPreset: DEFAULT_WEATHER_PRESET_ID,
  fieldsChecked: ATMOSPHERE_FIELDS.length,
  numericalScatteringOrders: [...scatteringOrders],
  precomputedKernels: {
    count: precomputedKeys.size,
    bytesEach: PRECOMPUTED_WEATHER_KERNEL_BYTE_LENGTH,
    finiteSamplesEach: PRECOMPUTED_WEATHER_KERNEL_VALUE_COUNT,
  },
  directCloud: { thinTransmission, brokenTransmission, thickTransmission },
}, null, 2))

function distinctInRange(
  value: number,
  [minimum, maximum]: readonly [number, number],
  integer: boolean,
) {
  const step = integer ? 1 : Math.max((maximum - minimum) / 100, 1e-4)
  return value + step <= maximum ? value + step : value - step
}

function toPhysicalAtmosphere(atmosphere: Atmosphere) {
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
      opticalDepth: atmosphere.cloudOpticalDepth,
      baseAltitudeKm: atmosphere.cloudBase,
      thicknessKm: atmosphere.cloudThicknessKm,
    },
  }
}

function arraysDiffer(left: Float32Array, right: Float32Array) {
  return left.some((value, index) => Math.abs(value - right[index]) > 1e-20)
}

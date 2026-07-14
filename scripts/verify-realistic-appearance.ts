import assert from 'node:assert/strict'
import type { CatalogStar } from '../src/data/starCatalog'
import {
  APPEARANCE_PROFILES,
  NATURAL_SKY_LUMINANCE,
  linearToSrgb,
  realisticBaseSkyLuminance,
  realisticStarDisplaySignal,
  realisticSkyDisplayLuminance,
} from '../src/lib/appearance'
import {
  realisticDispersionPixels,
  realisticDispersionArcsec,
  realisticStarPeak,
  apparentStarMagnitude,
  starAppearance,
  starVisibility,
  type StarAppearance,
} from '../src/lib/starAppearance'
import type { Atmosphere } from '../src/types'

const atmosphere: Atmosphere = {
  aerosol: 0.12,
  humidity: 0.45,
  cloud: 0.08,
  cloudBase: 6.5,
  angstromExponent: 1.3,
  aerosolScaleHeightKm: 1.4,
  aerosolSingleScatteringAlbedo: 0.92,
  aerosolAsymmetry: 0.68,
  cloudThicknessKm: 1.8,
  cloudOpticalDepth: 8,
  groundAlbedo: 0.14,
  maxScatteringOrder: 3,
}

assert.deepEqual(APPEARANCE_PROFILES.atlas, {
  rendererExposure: 1.1,
  milkyWayOpacity: 0.24,
  deepSkyOpacity: 1,
  planetOpacity: 1,
  starDisplayGain: 1,
})
assert.deepEqual(APPEARANCE_PROFILES.realistic, {
  rendererExposure: 1,
  milkyWayOpacity: 0.045,
  deepSkyOpacity: 0.16,
  planetOpacity: 0.62,
  starDisplayGain: 1.6,
})
assert(APPEARANCE_PROFILES.realistic.rendererExposure < APPEARANCE_PROFILES.atlas.rendererExposure)
assert(APPEARANCE_PROFILES.realistic.milkyWayOpacity < APPEARANCE_PROFILES.atlas.milkyWayOpacity)
assert(APPEARANCE_PROFILES.realistic.deepSkyOpacity < APPEARANCE_PROFILES.atlas.deepSkyOpacity)

const skyRatios = [0, 0.1, 1, 10, 100, 1_000_000]
const skyDisplayLuminance = skyRatios.map((ratio) =>
  realisticSkyDisplayLuminance(NATURAL_SKY_LUMINANCE * ratio),
)
assertAlmostEqual(realisticSkyDisplayLuminance(NATURAL_SKY_LUMINANCE), 0.0015, 1e-12)
assertAlmostEqual(
  realisticSkyDisplayLuminance(NATURAL_SKY_LUMINANCE * 10),
  0.0015 * 10 ** 0.42,
  1e-12,
)
assertAlmostEqual(skyDisplayLuminance.at(-1)!, 0.03, 1e-12)
assert(skyDisplayLuminance[0] < skyDisplayLuminance[1])
assert(skyDisplayLuminance[1] < skyDisplayLuminance[2])
assert(skyDisplayLuminance[2] < skyDisplayLuminance[3])
assertNonDecreasing(skyDisplayLuminance, 'Realistic sky response')
const darkBase = realisticBaseSkyLuminance(-25)
const moonlitBase = realisticBaseSkyLuminance(-25, 1)
const screenshotTwilightBase = realisticBaseSkyLuminance(-15.335)
const twilightHorizon = realisticBaseSkyLuminance(-15.335, 0, 1)
assert(moonlitBase > darkBase, 'Moonlight must brighten the realistic base even with a physical field')
assert(screenshotTwilightBase > darkBase, 'Astronomical twilight must begin below -14 degrees')
assert(twilightHorizon > screenshotTwilightBase, 'Twilight must brighten toward the horizon')
assert(realisticSkyDisplayLuminance(moonlitBase) > realisticSkyDisplayLuminance(darkBase))

const linearStarSignals = [-1, 0, 0.0001, 0.001, 0.01, 0.1, 0.5, 1]
const displayStarSignals = linearStarSignals.map(realisticStarDisplaySignal)
const srgbStarSignals = displayStarSignals.map(linearToSrgb)
assertAlmostEqual(realisticStarDisplaySignal(-1), 0, 1e-12)
assertAlmostEqual(realisticStarDisplaySignal(0), 0, 1e-12)
assertAlmostEqual(realisticStarDisplaySignal(0.001), 0.0016 / 1.0006, 1e-12)
assert(realisticStarDisplaySignal(0.01) > realisticStarDisplaySignal(0.001))
assertAlmostEqual(realisticStarDisplaySignal(1), 1, 1e-12)
assertNonDecreasing(displayStarSignals, 'Bounded Realistic stellar display response')
assertNonDecreasing(srgbStarSignals, 'Realistic stellar sRGB display response')
assert(displayStarSignals.every((value) => value >= 0 && value <= 1))
assert(srgbStarSignals.every((value) => value >= 0 && value <= 1))
assert(srgbStarSignals[4] > 0.1, 'A faint 0.01 linear stellar signal must remain legible on an sRGB display')
for (const signal of linearStarSignals.filter((value) => value > 0 && value <= 1)) {
  const gain = realisticStarDisplaySignal(signal) / signal
  assert(gain >= 1 && gain <= APPEARANCE_PROFILES.realistic.starDisplayGain)
}

const visibilityLimits = [3.5, 4.8, 6.2]
const visibilityMagnitudes = Array.from({ length: 31 }, (_, index) => -1 + index * 0.25)
const visibilitySupport = visibilityLimits.map((limit) => {
  const values = visibilityMagnitudes.map((magnitude) => starVisibility(magnitude, limit))
  assertNonIncreasing(values, `Stellar visibility at limiting magnitude ${limit}`)
  assert(values[0] > values.at(-1)!)
  assert(values.every((value) => value >= 0 && value <= 1))

  for (const magnitude of visibilityMagnitudes) {
    const star = makeStar(`Magnitude ${magnitude}`, magnitude, 0.65, 'G2V')
    const apparentMagnitude = apparentStarMagnitude(star, 60, atmosphere)
    const expectedSupport = starVisibility(apparentMagnitude, limit) > 0
    const realistic = starAppearance(star, 60, limit, atmosphere, 'realistic')
    const atlas = starAppearance(star, 60, limit, atmosphere, 'atlas')
    assert.equal(realistic.opacity > 0, expectedSupport,
      `Realistic visibility support diverged at m=${magnitude}, limit=${limit}`)
    assert.equal(atlas.opacity > 0, expectedSupport,
      `Atlas visibility support diverged at m=${magnitude}, limit=${limit}`)
  }

  return values
})

const peakMagnitudes = [-1, 0, 1, 2, 3, 4, 5, 6]
const starPeaks = peakMagnitudes.map(realisticStarPeak)
assertStrictlyDecreasing(starPeaks, 'Realistic stellar peak')
assertAlmostEqual(realisticStarPeak(0), 0.35, 1e-12)
assert(realisticStarPeak(-1) < 0.95)
assert(realisticStarPeak(0) < 0.5)
assert(realisticStarPeak(4) < 0.02)
assert(realisticStarPeak(5) < 0.004)
assert(realisticStarPeak(0) / realisticStarPeak(2) > 4)
assert(realisticStarPeak(0) / realisticStarPeak(5) > 60)

const representativeStars = [
  makeStar('B2 V', 2, -0.2, 'B2V'),
  makeStar('Sun-like', 2, 0.65, 'G2V'),
  makeStar('M giant', 2, 1.55, 'M3III'),
]
const comparisons = representativeStars.map((star) => ({
  name: star.name,
  realistic: starAppearance(star, 20, 7.15, atmosphere, 'realistic'),
  atlas: starAppearance(star, 20, 7.15, atmosphere, 'atlas'),
}))

for (const comparison of comparisons) {
  const { realistic, atlas } = comparison
  assert(realistic.size < atlas.size * 0.5, `${comparison.name} realistic sprite must be materially smaller`)
  assert(realistic.opacity < atlas.opacity * 0.15, `${comparison.name} realistic peak must preserve magnitude contrast`)
  assert(coreFwhm(realistic) >= 0.9 && coreFwhm(realistic) <= 1.32)
  assert(coreFwhm(atlas) > coreFwhm(realistic) * 1.8)
  assert(colorChroma(realistic) < colorChroma(atlas) * 0.4, `${comparison.name} colour must be subdued`)
  assert(colorChroma(realistic) < 0.1)
  assert(
    renderedDispersionPixels(realistic, 'realistic') < renderedDispersionPixels(atlas, 'atlas') * 0.5,
    `${comparison.name} dispersion must remain subpixel`,
  )
  assertFiniteAppearance(realistic, `${comparison.name} realistic appearance`)
  assertFiniteAppearance(atlas, `${comparison.name} Atlas appearance`)
}

const blue = comparisons[0].realistic.color
const red = comparisons[2].realistic.color
assert(blue.b > blue.r, 'A realistic B star must retain a subtle blue ordering')
assert(red.r > red.b, 'A realistic M star must retain a subtle red ordering')

const bright = makeStar('Bright G star', 0, 0.65, 'G2V')
const faint = makeStar('Faint G star', 5, 0.65, 'G2V')
const brightRealistic = starAppearance(bright, 60, 7.15, atmosphere, 'realistic')
const faintRealistic = starAppearance(faint, 60, 7.15, atmosphere, 'realistic')
const brightAtlas = starAppearance(bright, 60, 7.15, atmosphere, 'atlas')
const faintAtlas = starAppearance(faint, 60, 7.15, atmosphere, 'atlas')
assert(brightRealistic.opacity / faintRealistic.opacity > 60)
assert(brightAtlas.opacity / faintAtlas.opacity < 1.2)
assert(brightRealistic.size < brightAtlas.size * 0.4)
assert(faintRealistic.size < faintAtlas.size * 0.65)
assertAlmostEqual(
  integratedPsfSignal(brightRealistic) / integratedPsfSignal(faintRealistic),
  100,
  1e-9,
)
assertAlmostEqual(
  integratedPsfSignal(brightRealistic),
  realisticStarPeak(apparentStarMagnitude(bright, 60, atmosphere)),
  1e-12,
)
assertAlmostEqual(
  integratedPsfSignal(faintRealistic),
  realisticStarPeak(apparentStarMagnitude(faint, 60, atmosphere)),
  1e-12,
)

const implicitAtlas = starAppearance(bright, 60, 7.15, atmosphere)
assertAlmostEqual(implicitAtlas.size, brightAtlas.size, 1e-12)
assertAlmostEqual(implicitAtlas.opacity, brightAtlas.opacity, 1e-12)
assertAlmostEqual(implicitAtlas.dispersion, brightAtlas.dispersion, 1e-12)

const dispersionByAltitude = [90, 60, 20, 5, 0.5].map(realisticDispersionPixels)
assertNonDecreasing(dispersionByAltitude, 'Atmospheric dispersion toward the horizon')
assert(realisticDispersionPixels(20) < 0.012)
assert(realisticDispersionPixels(5) < 0.05)
assertAlmostEqual(realisticDispersionPixels(0.5), 0.35, 1e-12)
assert(realisticDispersionArcsec(5) > realisticDispersionArcsec(20))

console.log(JSON.stringify({
  profiles: APPEARANCE_PROFILES,
  sky: {
    ratios: skyRatios,
    displayLuminance: skyDisplayLuminance,
  },
  starDisplay: {
    linearSignals: linearStarSignals,
    liftedLinearSignals: displayStarSignals,
    srgbSignals: srgbStarSignals,
  },
  visibility: {
    limits: visibilityLimits,
    magnitudes: visibilityMagnitudes,
    support: visibilitySupport,
  },
  stars: {
    magnitudes: peakMagnitudes,
    peakIntensity: starPeaks,
    magnitude0To5Ratio: realisticStarPeak(0) / realisticStarPeak(5),
    representative: comparisons.map(({ name, realistic, atlas }) => ({
      name,
      realistic: appearanceSummary(realistic, 'realistic'),
      atlas: appearanceSummary(atlas, 'atlas'),
    })),
  },
}, null, 2))

function makeStar(name: string, mag: number, bv: number, spectralType: string): CatalogStar {
  return { hr: 1, ra: 0, dec: 0, mag, bv, spectralType, name }
}

function appearanceSummary(appearance: StarAppearance, mode: 'realistic' | 'atlas') {
  return {
    size: appearance.size,
    opacity: appearance.opacity,
    coreFwhm: coreFwhm(appearance),
    chroma: colorChroma(appearance),
    dispersionPixels: renderedDispersionPixels(appearance, mode),
  }
}

function integratedPsfSignal(appearance: StarAppearance) {
  const sigmaCore = appearance.coreWidth * appearance.size / 2
  const sigmaHalo = appearance.haloWidth * appearance.size / 2
  return appearance.opacity * 2 * Math.PI * (
    sigmaCore ** 2 + appearance.haloStrength * sigmaHalo ** 2
  )
}

function renderedDispersionPixels(appearance: StarAppearance, mode: 'realistic' | 'atlas') {
  const scale = mode === 'realistic' ? 0.0036 : 1
  return Math.min(0.35, appearance.dispersion * scale * appearance.size / 2)
}

function coreFwhm(appearance: StarAppearance) {
  return appearance.coreWidth * appearance.size * 1.1775
}

function colorChroma(appearance: StarAppearance) {
  const channels = [appearance.color.r, appearance.color.g, appearance.color.b]
  const maximum = Math.max(...channels)
  const minimum = Math.min(...channels)
  return maximum > 0 ? (maximum - minimum) / maximum : 0
}

function assertFiniteAppearance(appearance: StarAppearance, label: string) {
  const values = [
    appearance.color.r,
    appearance.color.g,
    appearance.color.b,
    appearance.size,
    appearance.opacity,
    appearance.coreWidth,
    appearance.haloWidth,
    appearance.haloStrength,
    appearance.dispersion,
  ]
  assert(values.every((value) => Number.isFinite(value) && value >= 0), `${label} must be finite and non-negative`)
}

function assertAlmostEqual(actual: number, expected: number, tolerance: number) {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`)
}

function assertNonDecreasing(values: readonly number[], label: string) {
  values.forEach((value, index) => {
    if (index > 0) assert(value >= values[index - 1], `${label} decreased at index ${index}`)
  })
}

function assertStrictlyDecreasing(values: readonly number[], label: string) {
  values.forEach((value, index) => {
    if (index > 0) assert(value < values[index - 1], `${label} did not decrease at index ${index}`)
  })
}

function assertNonIncreasing(values: readonly number[], label: string) {
  values.forEach((value, index) => {
    if (index > 0) assert(value <= values[index - 1], `${label} increased at index ${index}`)
  })
}

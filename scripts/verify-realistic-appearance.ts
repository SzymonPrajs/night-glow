import assert from 'node:assert/strict'
import type { CatalogStar } from '../src/data/starCatalog'
import {
  APPEARANCE_PROFILES,
  NATURAL_SKY_LUMINANCE,
  realisticBaseSkyLuminance,
  realisticSkyDisplayLuminance,
  realisticVisualLimit,
} from '../src/lib/appearance'
import {
  realisticDispersionPixels,
  realisticDispersionArcsec,
  realisticStarPeak,
  apparentStarMagnitude,
  starAppearance,
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
})
assert.deepEqual(APPEARANCE_PROFILES.realistic, {
  rendererExposure: 1,
  milkyWayOpacity: 0.045,
  deepSkyOpacity: 0.16,
  planetOpacity: 0.62,
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

const visualLimits = [14, 18.7, 20.3, 21.8, 21.92, 24].map(realisticVisualLimit)
assertAlmostEqual(realisticVisualLimit(21.92), 7.15, 1e-12)
assertAlmostEqual(realisticVisualLimit(18.7), 4.574, 1e-12)
assert(realisticVisualLimit(18.7) >= 4.3 && realisticVisualLimit(18.7) <= 5)
assert(realisticVisualLimit(21.8) >= 6.9)
assertAlmostEqual(realisticVisualLimit(14), 0.814, 1e-12)
assert.equal(realisticVisualLimit(0), 0)
assert.equal(realisticVisualLimit(24), 7.15)
assertNonDecreasing(visualLimits, 'Visual limiting magnitude')

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
  realistic: starAppearance(star, 20, 7.15, atmosphere, 'realistic', 21.92),
  atlas: starAppearance(star, 20, 7.15, atmosphere, 'atlas', 21.92),
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
const brightRealistic = starAppearance(bright, 60, 7.15, atmosphere, 'realistic', 21.92)
const faintRealistic = starAppearance(faint, 60, 7.15, atmosphere, 'realistic', 21.92)
const brightAtlas = starAppearance(bright, 60, 7.15, atmosphere, 'atlas', 21.92)
const faintAtlas = starAppearance(faint, 60, 7.15, atmosphere, 'atlas', 21.92)
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
  visualLimit: {
    sqm18_7: realisticVisualLimit(18.7),
    sqm21_8: realisticVisualLimit(21.8),
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

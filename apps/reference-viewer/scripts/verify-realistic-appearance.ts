import assert from 'node:assert/strict'
import type { CatalogStar } from '../src/data/starCatalog'
import {
  APPEARANCE_ENDPOINTS,
  ENHANCED_APPEARANCE_PROFILE,
  REALISTIC_APPEARANCE_PROFILE,
  clampEnhancement,
  interpolateAppearanceProfile,
  interpolateAppearanceValue,
  linearToSrgb,
  normalizeEnhancement,
  realisticBaseSkyLuminance,
  realisticSkyDisplayLuminance,
  realisticStarDisplaySignal,
} from '../src/lib/appearance'
import {
  NATURAL_SKY_LUMINANCE,
  NATURAL_SKY_RGB,
  rgbLuminance,
} from '../src/lib/photometry'
import {
  apparentStarMagnitude,
  cloudAdjustedLimitingMagnitude,
  directCloudExtinction,
  directCloudTransmission,
  dispersionArcsecondsToCssPixels,
  enhancedStarSignal,
  interpolateStarAppearance,
  realisticDispersionArcsec,
  realisticDispersionPixels,
  realisticStarPeak,
  relativeAirMass,
  starAppearance,
  starAppearanceCssEndpoints,
  starVisibility,
  type StarAppearance,
  type StarVisualCssPixels,
  type StarVisualEndpoint,
} from '../src/lib/starAppearance'
import type { Atmosphere } from '../src/types'

const ENHANCEMENT_SAMPLES = [0, 0.25, 0.5, 0.75, 1] as const

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

// Continuous presentation values are normalized once and all interpolation is finite.
assert.equal(normalizeEnhancement(Number.NaN), 0)
assert.equal(normalizeEnhancement(Number.NEGATIVE_INFINITY), 0)
assert.equal(normalizeEnhancement(Number.POSITIVE_INFINITY), 0)
assert.equal(normalizeEnhancement(-1), 0)
assert.equal(normalizeEnhancement(0.25), 0.25)
assert.equal(normalizeEnhancement(2), 1)
assert.equal(clampEnhancement(-0.1), 0)
assert.equal(clampEnhancement(1.1), 1)
assertAlmostEqual(interpolateAppearanceValue(2, 6, 0.25), 3, 1e-12)
assertAlmostEqual(interpolateAppearanceValue(2, 6, -1), 2, 1e-12)
assertAlmostEqual(interpolateAppearanceValue(2, 6, 2), 6, 1e-12)
assertAlmostEqual(interpolateAppearanceValue(Number.NaN, 6, 0.5), 3, 1e-12)
assertAlmostEqual(interpolateAppearanceValue(2, Number.POSITIVE_INFINITY, 0.5), 2, 1e-12)

assert.deepEqual(REALISTIC_APPEARANCE_PROFILE, {
  starDisplayGain: 1.6,
  milkyWayOpacity: 0.045,
  deepSkyOpacity: 0.16,
  planetOpacity: 0.62,
})
assert.deepEqual(ENHANCED_APPEARANCE_PROFILE, {
  starDisplayGain: 1,
  milkyWayOpacity: 0.24,
  deepSkyOpacity: 1,
  planetOpacity: 1,
})
assert.equal(APPEARANCE_ENDPOINTS.realistic, REALISTIC_APPEARANCE_PROFILE)
assert.equal(APPEARANCE_ENDPOINTS.enhanced, ENHANCED_APPEARANCE_PROFILE)
assert(Object.isFrozen(APPEARANCE_ENDPOINTS))
assert(Object.isFrozen(REALISTIC_APPEARANCE_PROFILE))
assert(Object.isFrozen(ENHANCED_APPEARANCE_PROFILE))

const interpolatedProfiles = ENHANCEMENT_SAMPLES.map((enhancement) => {
  const profile = interpolateAppearanceProfile(enhancement)
  assertFiniteNumbers(Object.values(profile), `Appearance profile at ${enhancement}`)
  for (const key of Object.keys(profile) as Array<keyof typeof profile>) {
    assertAlmostEqual(
      profile[key],
      interpolateAppearanceValue(
        REALISTIC_APPEARANCE_PROFILE[key],
        ENHANCED_APPEARANCE_PROFILE[key],
        enhancement,
      ),
      1e-12,
    )
  }
  return profile
})
assertNonIncreasing(
  interpolatedProfiles.map((profile) => profile.starDisplayGain),
  'Realistic display gain toward Enhanced',
)
for (const key of ['milkyWayOpacity', 'deepSkyOpacity', 'planetOpacity'] as const) {
  assertNonDecreasing(
    interpolatedProfiles.map((profile) => profile[key]),
    `${key} toward Enhanced`,
  )
}
assert.deepEqual(interpolateAppearanceProfile(-1), REALISTIC_APPEARANCE_PROFILE)
assert.deepEqual(interpolateAppearanceProfile(2), ENHANCED_APPEARANCE_PROFILE)
assert.deepEqual(interpolateAppearanceProfile(Number.NaN), REALISTIC_APPEARANCE_PROFILE)

// Preserve the calibrated Realistic sky, moonlight, and twilight response checks.
assertAlmostEqual(rgbLuminance(NATURAL_SKY_RGB), NATURAL_SKY_LUMINANCE, 1e-15)
const skyRatios = [0, 0.1, 1, 10, 100, 1_000_000_000_000]
const skyDisplayLuminance = skyRatios.map((ratio) =>
  realisticSkyDisplayLuminance(NATURAL_SKY_LUMINANCE * ratio),
)
assertAlmostEqual(realisticSkyDisplayLuminance(NATURAL_SKY_LUMINANCE), 0.006, 1e-12)
assertAlmostEqual(
  realisticSkyDisplayLuminance(NATURAL_SKY_LUMINANCE * 10),
  0.006 * 10 ** 0.22,
  1e-12,
)
assertAlmostEqual(skyDisplayLuminance.at(-1)!, 0.55, 1e-12)
assertNonDecreasing(skyDisplayLuminance, 'Realistic sky response')
const darkBase = realisticBaseSkyLuminance(-25)
const moonlitBase = realisticBaseSkyLuminance(-25, 1)
const screenshotTwilightBase = realisticBaseSkyLuminance(-15.335)
const twilightHorizon = realisticBaseSkyLuminance(-15.335, 0, 1)
assert(moonlitBase > darkBase, 'Moonlight must brighten the Realistic base sky')
assert(screenshotTwilightBase > darkBase, 'Astronomical twilight must begin below -14 degrees')
assert(twilightHorizon > screenshotTwilightBase, 'Twilight must brighten toward the horizon')
assert(realisticSkyDisplayLuminance(moonlitBase) > realisticSkyDisplayLuminance(darkBase))

const linearStarSignals = [-1, 0, 0.0001, 0.001, 0.01, 0.1, 0.5, 1]
const displayStarSignals = linearStarSignals.map(realisticStarDisplaySignal)
const srgbStarSignals = displayStarSignals.map(linearToSrgb)
assertAlmostEqual(realisticStarDisplaySignal(-1), 0, 1e-12)
assertAlmostEqual(realisticStarDisplaySignal(Number.NaN), 0, 1e-12)
assertAlmostEqual(realisticStarDisplaySignal(0), 0, 1e-12)
assertAlmostEqual(realisticStarDisplaySignal(0.001), 0.0016 / 1.0006, 1e-12)
assert(realisticStarDisplaySignal(0.01) > realisticStarDisplaySignal(0.001))
assertAlmostEqual(realisticStarDisplaySignal(1), 1, 1e-12)
assertNonDecreasing(displayStarSignals, 'Bounded Realistic stellar display response')
assertNonDecreasing(srgbStarSignals, 'Realistic stellar sRGB display response')
assert(displayStarSignals.every((value) => value >= 0 && value <= 1))
assert(srgbStarSignals.every((value) => value >= 0 && value <= 1))
assert(srgbStarSignals[4] > 0.1, 'A faint 0.01 linear stellar signal must remain legible')
for (const signal of linearStarSignals.filter((value) => value > 0 && value <= 1)) {
  const gain = realisticStarDisplaySignal(signal) / signal
  assert(gain >= 1 && gain <= REALISTIC_APPEARANCE_PROFILE.starDisplayGain)
}

// Preserve the direct-cloud law and require one shared physical stellar support.
const clearAtmosphere = { ...atmosphere, cloud: 0 }
const brokenCloudAtmosphere = { ...atmosphere, cloud: 0.5, cloudOpticalDepth: 1 }
const zenithCloudTransmission = 0.5 + 0.5 * Math.exp(-relativeAirMass(90))
assertAlmostEqual(directCloudTransmission(90, brokenCloudAtmosphere), zenithCloudTransmission, 1e-12)
assertAlmostEqual(
  directCloudExtinction(90, brokenCloudAtmosphere),
  -2.5 * Math.log10(zenithCloudTransmission),
  1e-12,
)
assertAlmostEqual(directCloudTransmission(20, clearAtmosphere), 1, 1e-12)
assertAlmostEqual(directCloudExtinction(20, clearAtmosphere), 0, 1e-12)
assertAlmostEqual(directCloudTransmission(20, { cloud: 0.7, cloudOpticalDepth: 0 }), 1, 1e-12)
assert(directCloudTransmission(10, brokenCloudAtmosphere) < directCloudTransmission(90, brokenCloudAtmosphere))
assert(directCloudExtinction(10, brokenCloudAtmosphere) > directCloudExtinction(90, brokenCloudAtmosphere))
assertAlmostEqual(directCloudTransmission(90, { cloud: 0.25, cloudOpticalDepth: 100 }), 0.75, 1e-12)
assertAlmostEqual(directCloudExtinction(90, { cloud: 1, cloudOpticalDepth: 100 }), 30, 1e-12)
assertAlmostEqual(directCloudTransmission(Number.NaN, { cloud: Number.NaN, cloudOpticalDepth: Infinity }), 1, 1e-12)
assertAlmostEqual(directCloudTransmission(90, { cloud: 2, cloudOpticalDepth: -1 }), 1, 1e-12)
assertAlmostEqual(
  cloudAdjustedLimitingMagnitude(6.5, 90, brokenCloudAtmosphere),
  6.5 - directCloudExtinction(90, brokenCloudAtmosphere),
  1e-12,
)
assertAlmostEqual(cloudAdjustedLimitingMagnitude(Number.NaN, 90, clearAtmosphere), 0, 1e-12)

const cloudTestStar = makeStar('Cloud extinction test', 3, 0.65, 'G2V')
const cloudMagnitudeShift = apparentStarMagnitude(cloudTestStar, 20, brokenCloudAtmosphere)
  - apparentStarMagnitude(cloudTestStar, 20, clearAtmosphere)
assertAlmostEqual(cloudMagnitudeShift, directCloudExtinction(20, brokenCloudAtmosphere), 1e-12)
const cloudAppearance = starAppearance(cloudTestStar, 20, 7.15, brokenCloudAtmosphere)
const cloudExpectedVisibility = starVisibility(
  apparentStarMagnitude(cloudTestStar, 20, brokenCloudAtmosphere),
  7.15,
)
assertAlmostEqual(cloudAppearance.visibility, cloudExpectedVisibility, 1e-12)
for (const enhancement of ENHANCEMENT_SAMPLES) {
  const visual = interpolateStarAppearance(cloudAppearance, enhancement, 0.01)
  assertAlmostEqual(visual.visibility, cloudExpectedVisibility, 1e-12)
  assert.equal(
    visual.visibility * visual.signal > 0,
    cloudExpectedVisibility > 0,
    `Enhancement ${enhancement} must use the same cloud-extinguished stellar support`,
  )
}

const visibilityLimits = [3.5, 4.8, 6.2]
const visibilityMagnitudes = Array.from({ length: 31 }, (_, index) => -1 + index * 0.25)
const visibilitySupport = visibilityLimits.map((limit) => {
  const values = visibilityMagnitudes.map((magnitude) => starVisibility(magnitude, limit))
  assertNonIncreasing(values, `Stellar visibility at limiting magnitude ${limit}`)
  assert(values[0] > values.at(-1)!)
  assert(values.every((value) => value >= 0 && value <= 1))

  const eligibilityByEnhancement = ENHANCEMENT_SAMPLES.map(() => 0)
  for (const magnitude of visibilityMagnitudes) {
    const star = makeStar(`Magnitude ${magnitude}`, magnitude, 0.65, 'G2V')
    const appearance = starAppearance(star, 60, limit, atmosphere)
    const expectedVisibility = starVisibility(appearance.apparentMagnitude, limit)
    assertAlmostEqual(appearance.visibility, expectedVisibility, 1e-12)
    assert.equal('visibility' in appearance.realistic, false)
    assert.equal('visibility' in appearance.enhanced, false)

    ENHANCEMENT_SAMPLES.forEach((enhancement, index) => {
      const visual = interpolateStarAppearance(appearance, enhancement, 0.01)
      assertAlmostEqual(visual.apparentMagnitude, appearance.apparentMagnitude, 1e-12)
      assertAlmostEqual(visual.visibility, expectedVisibility, 1e-12)
      const eligible = visual.visibility * visual.signal > 0
      assert.equal(
        eligible,
        expectedVisibility > 0,
        `Presentation-dependent eligibility at m=${magnitude}, limit=${limit}, enhancement=${enhancement}`,
      )
      eligibilityByEnhancement[index] += Number(eligible)
    })
  }
  assert(eligibilityByEnhancement.every((count) => count === eligibilityByEnhancement[0]))
  return values
})

// Preserve the Realistic magnitude law and integral-normalized PSF checks.
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
const representativeAppearances = representativeStars.map((star) => ({
  name: star.name,
  appearance: starAppearance(star, 20, 7.15, atmosphere),
}))

for (const { name, appearance } of representativeAppearances) {
  const endpoints = starAppearanceCssEndpoints(appearance, 0.01)
  const realistic = endpoints.realistic
  const enhanced = endpoints.enhanced
  assert(realistic.spriteSizeCssPixels < enhanced.spriteSizeCssPixels * 0.5,
    `${name} Realistic sprite must be materially smaller`)
  assert(realistic.signal < enhanced.signal * 0.15,
    `${name} Realistic signal must preserve magnitude contrast`)
  assert(coreFwhm(realistic) >= 0.9 && coreFwhm(realistic) <= 1.32)
  assert(coreFwhm(enhanced) > coreFwhm(realistic) * 1.8)
  assert(colorChroma(realistic) < colorChroma(enhanced) * 0.4,
    `${name} Realistic colour must remain subdued`)
  assert(colorChroma(realistic) < 0.1)
  assertFiniteStarAppearance(appearance, `${name} endpoint appearance`)
  assertFiniteVisual(realistic, `${name} Realistic CSS endpoint`)
  assertFiniteVisual(enhanced, `${name} Enhanced CSS endpoint`)
}

const blue = representativeAppearances[0].appearance.realistic.color
const red = representativeAppearances[2].appearance.realistic.color
assert(blue.b > blue.r, 'A Realistic B star must retain a subtle blue ordering')
assert(red.r > red.b, 'A Realistic M star must retain a subtle red ordering')

const bright = makeStar('Bright G star', 0, 0.65, 'G2V')
const faint = makeStar('Faint G star', 5, 0.65, 'G2V')
const brightAppearance = starAppearance(bright, 60, 7.15, atmosphere)
const faintAppearance = starAppearance(faint, 60, 7.15, atmosphere)
const brightEndpoints = starAppearanceCssEndpoints(brightAppearance, 0.01)
const faintEndpoints = starAppearanceCssEndpoints(faintAppearance, 0.01)
const realisticBrightFaintRatio = brightEndpoints.realistic.signal / faintEndpoints.realistic.signal
const enhancedBrightFaintRatio = brightEndpoints.enhanced.signal / faintEndpoints.enhanced.signal
assertAlmostEqual(
  brightEndpoints.enhanced.signal,
  enhancedStarSignal(brightAppearance.apparentMagnitude),
  1e-12,
)
assertAlmostEqual(
  faintEndpoints.enhanced.signal,
  enhancedStarSignal(faintAppearance.apparentMagnitude),
  1e-12,
)
assertAlmostEqual(realisticBrightFaintRatio, 100, 1e-9)
assert(enhancedBrightFaintRatio > 1, 'Enhanced must keep the brighter star brighter')
assert(enhancedBrightFaintRatio < realisticBrightFaintRatio,
  'Enhanced must compress, not reverse, stellar dynamic range')
assert(faintEndpoints.enhanced.signal > faintEndpoints.realistic.signal,
  'Enhanced must lift a physically visible faint star')
assert(
  faintEndpoints.enhanced.signal / faintEndpoints.realistic.signal
    > brightEndpoints.enhanced.signal / brightEndpoints.realistic.signal,
  'Enhanced must lift faint stars more strongly than bright stars',
)
assertAlmostEqual(
  integratedPsfSignal(brightAppearance.realistic) / integratedPsfSignal(faintAppearance.realistic),
  100,
  1e-9,
)
assertAlmostEqual(
  integratedPsfSignal(brightAppearance.realistic),
  realisticStarPeak(apparentStarMagnitude(bright, 60, atmosphere)),
  1e-12,
)
assertAlmostEqual(
  integratedPsfSignal(faintAppearance.realistic),
  realisticStarPeak(apparentStarMagnitude(faint, 60, atmosphere)),
  1e-12,
)

const enhancedSignals = peakMagnitudes.map(enhancedStarSignal)
assertStrictlyDecreasing(enhancedSignals, 'Enhanced stellar signal')
const brightFaintRatios = ENHANCEMENT_SAMPLES.map((enhancement) => {
  const brightVisual = interpolateStarAppearance(brightAppearance, enhancement, 0.01)
  const faintVisual = interpolateStarAppearance(faintAppearance, enhancement, 0.01)
  assert(brightVisual.signal > faintVisual.signal,
    `Brighter stars must remain brighter at enhancement ${enhancement}`)
  return brightVisual.signal / faintVisual.signal
})
assertNonIncreasing(brightFaintRatios, 'Bright/faint ratio toward Enhanced')
assert(brightFaintRatios.at(-1)! > 1)

// Every sampled presentation value is finite, monotonic, and between its endpoints.
const interpolationAppearance = representativeAppearances[1].appearance
const interpolationEndpoints = starAppearanceCssEndpoints(interpolationAppearance, 0.01)
const interpolationSamples = ENHANCEMENT_SAMPLES.map((enhancement) => {
  const visual = interpolateStarAppearance(interpolationAppearance, enhancement, 0.01)
  assertFiniteVisual(visual, `Interpolated star at enhancement ${enhancement}`)
  assertAlmostEqual(visual.apparentMagnitude, interpolationAppearance.apparentMagnitude, 1e-12)
  assertAlmostEqual(visual.visibility, interpolationAppearance.visibility, 1e-12)
  assertLinearVisualInterpolation(
    visual,
    interpolationEndpoints.realistic,
    interpolationEndpoints.enhanced,
    enhancement,
  )
  return visual
})
assertVisualAlmostEqual(interpolationSamples[0], interpolationEndpoints.realistic, 1e-12)
assertVisualAlmostEqual(interpolationSamples.at(-1)!, interpolationEndpoints.enhanced, 1e-12)
assertVisualAlmostEqual(
  interpolateStarAppearance(interpolationAppearance, -1, 0.01),
  interpolationEndpoints.realistic,
  1e-12,
)
assertVisualAlmostEqual(
  interpolateStarAppearance(interpolationAppearance, Number.NaN, 0.01),
  interpolationEndpoints.realistic,
  1e-12,
)
assertVisualAlmostEqual(
  interpolateStarAppearance(interpolationAppearance, 2, 0.01),
  interpolationEndpoints.enhanced,
  1e-12,
)

const monotonicVisualProperties = {
  signal: interpolationSamples.map((visual) => visual.signal),
  size: interpolationSamples.map((visual) => visual.spriteSizeCssPixels),
  core: interpolationSamples.map((visual) => visual.coreSigmaCssPixels),
  haloWidth: interpolationSamples.map((visual) => visual.haloSigmaCssPixels),
  haloStrength: interpolationSamples.map((visual) => visual.haloStrength),
  chroma: interpolationSamples.map(colorChroma),
}
for (const [label, values] of Object.entries(monotonicVisualProperties)) {
  assertNonDecreasing(values, `${label} toward Enhanced`)
  assertIntermediateSamples(values, `${label} interpolation`)
}

// Realistic angular dispersion and Enhanced CSS-pixel dispersion must be converted
// into one unit before interpolation; camera scale may affect only the former.
const dispersionAppearance = starAppearance(makeStar('Dispersion star', 2, 0.65, 'G2V'), 20, 7.15, atmosphere)
const cssPixelsPerArcsecond = 0.02
const dispersionEndpoints = starAppearanceCssEndpoints(dispersionAppearance, cssPixelsPerArcsecond)
const expectedRealisticDispersion = dispersionArcsecondsToCssPixels(
  dispersionAppearance.realistic.dispersionArcseconds,
  cssPixelsPerArcsecond,
)
assertAlmostEqual(dispersionEndpoints.realistic.dispersionCssPixels, expectedRealisticDispersion, 1e-12)
assertAlmostEqual(
  dispersionEndpoints.enhanced.dispersionCssPixels,
  dispersionAppearance.enhanced.dispersionCssPixels,
  1e-12,
)
const midpointDispersion = interpolateStarAppearance(dispersionAppearance, 0.5, cssPixelsPerArcsecond)
assertAlmostEqual(
  midpointDispersion.dispersionCssPixels,
  (expectedRealisticDispersion + dispersionAppearance.enhanced.dispersionCssPixels) / 2,
  1e-12,
)
const alternateScaleEndpoints = starAppearanceCssEndpoints(dispersionAppearance, 0.005)
assert.notEqual(
  alternateScaleEndpoints.realistic.dispersionCssPixels,
  dispersionEndpoints.realistic.dispersionCssPixels,
)
assertAlmostEqual(
  alternateScaleEndpoints.enhanced.dispersionCssPixels,
  dispersionEndpoints.enhanced.dispersionCssPixels,
  1e-12,
)
assertAlmostEqual(
  starAppearanceCssEndpoints(dispersionAppearance, 100).realistic.dispersionCssPixels,
  0.35,
  1e-12,
)

const dispersionByAltitude = [90, 60, 20, 5, 0.5].map(realisticDispersionPixels)
assertNonDecreasing(dispersionByAltitude, 'Atmospheric dispersion toward the horizon')
assert(realisticDispersionPixels(20) < 0.012)
assert(realisticDispersionPixels(5) < 0.05)
assertAlmostEqual(realisticDispersionPixels(0.5), 0.35, 1e-12)
assert(realisticDispersionArcsec(5) > realisticDispersionArcsec(20))

console.log(JSON.stringify({
  profiles: {
    endpoints: APPEARANCE_ENDPOINTS,
    samples: ENHANCEMENT_SAMPLES.map((enhancement, index) => ({
      enhancement,
      ...interpolatedProfiles[index],
    })),
  },
  cloudExtinction: {
    zenithAirMass: relativeAirMass(90),
    zenithTransmission: directCloudTransmission(90, brokenCloudAtmosphere),
    zenithMagnitudeLoss: directCloudExtinction(90, brokenCloudAtmosphere),
    tenDegreeTransmission: directCloudTransmission(10, brokenCloudAtmosphere),
    tenDegreeMagnitudeLoss: directCloudExtinction(10, brokenCloudAtmosphere),
  },
  sky: {
    naturalRgb: NATURAL_SKY_RGB,
    naturalLuminance: NATURAL_SKY_LUMINANCE,
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
    realisticPeakIntensity: starPeaks,
    enhancedSignal: enhancedSignals,
    brightFaintRatios,
    representative: representativeAppearances.map(({ name, appearance }) => ({
      name,
      apparentMagnitude: appearance.apparentMagnitude,
      visibility: appearance.visibility,
      realistic: visualSummary(starAppearanceCssEndpoints(appearance, 0.01).realistic),
      enhanced: visualSummary(starAppearanceCssEndpoints(appearance, 0.01).enhanced),
    })),
  },
  dispersion: {
    realisticArcseconds: dispersionAppearance.realistic.dispersionArcseconds,
    realisticCssPixels: dispersionEndpoints.realistic.dispersionCssPixels,
    enhancedCssPixels: dispersionEndpoints.enhanced.dispersionCssPixels,
    midpointCssPixels: midpointDispersion.dispersionCssPixels,
  },
}, null, 2))

function makeStar(name: string, mag: number, bv: number, spectralType: string): CatalogStar {
  return { hr: 1, ra: 0, dec: 0, mag, bv, spectralType, name }
}

function visualSummary(visual: StarVisualCssPixels) {
  return {
    spriteSizeCssPixels: visual.spriteSizeCssPixels,
    signal: visual.signal,
    coreFwhmCssPixels: coreFwhm(visual),
    haloSigmaCssPixels: visual.haloSigmaCssPixels,
    haloStrength: visual.haloStrength,
    chroma: colorChroma(visual),
    dispersionCssPixels: visual.dispersionCssPixels,
  }
}

function integratedPsfSignal(visual: StarVisualEndpoint) {
  return visual.signal * 2 * Math.PI * (
    visual.coreSigmaCssPixels ** 2
      + visual.haloStrength * visual.haloSigmaCssPixels ** 2
  )
}

function coreFwhm(visual: StarVisualEndpoint) {
  return visual.coreSigmaCssPixels * 2.355
}

function colorChroma(visual: StarVisualEndpoint) {
  const channels = [visual.color.r, visual.color.g, visual.color.b]
  const maximum = Math.max(...channels)
  const minimum = Math.min(...channels)
  return maximum > 0 ? (maximum - minimum) / maximum : 0
}

function assertFiniteStarAppearance(appearance: StarAppearance, label: string) {
  assertFiniteNumbers(
    [appearance.apparentMagnitude, appearance.visibility],
    `${label} physical fields`,
  )
  assert(appearance.visibility >= 0 && appearance.visibility <= 1)
  assertFiniteNumbers(
    [
      appearance.realistic.color.r,
      appearance.realistic.color.g,
      appearance.realistic.color.b,
      appearance.realistic.spriteSizeCssPixels,
      appearance.realistic.signal,
      appearance.realistic.coreSigmaCssPixels,
      appearance.realistic.haloSigmaCssPixels,
      appearance.realistic.haloStrength,
      appearance.realistic.dispersionArcseconds,
      appearance.enhanced.color.r,
      appearance.enhanced.color.g,
      appearance.enhanced.color.b,
      appearance.enhanced.spriteSizeCssPixels,
      appearance.enhanced.signal,
      appearance.enhanced.coreSigmaCssPixels,
      appearance.enhanced.haloSigmaCssPixels,
      appearance.enhanced.haloStrength,
      appearance.enhanced.dispersionCssPixels,
    ],
    label,
  )
}

function assertFiniteVisual(visual: StarVisualCssPixels, label: string) {
  assertFiniteNumbers(
    [
      visual.color.r,
      visual.color.g,
      visual.color.b,
      visual.spriteSizeCssPixels,
      visual.signal,
      visual.coreSigmaCssPixels,
      visual.haloSigmaCssPixels,
      visual.haloStrength,
      visual.dispersionCssPixels,
    ],
    label,
  )
}

function assertLinearVisualInterpolation(
  actual: StarVisualCssPixels,
  realistic: StarVisualCssPixels,
  enhanced: StarVisualCssPixels,
  enhancement: number,
) {
  const actualValues = [
    actual.color.r,
    actual.color.g,
    actual.color.b,
    actual.spriteSizeCssPixels,
    actual.signal,
    actual.coreSigmaCssPixels,
    actual.haloSigmaCssPixels,
    actual.haloStrength,
    actual.dispersionCssPixels,
  ]
  const realisticValues = [
    realistic.color.r,
    realistic.color.g,
    realistic.color.b,
    realistic.spriteSizeCssPixels,
    realistic.signal,
    realistic.coreSigmaCssPixels,
    realistic.haloSigmaCssPixels,
    realistic.haloStrength,
    realistic.dispersionCssPixels,
  ]
  const enhancedValues = [
    enhanced.color.r,
    enhanced.color.g,
    enhanced.color.b,
    enhanced.spriteSizeCssPixels,
    enhanced.signal,
    enhanced.coreSigmaCssPixels,
    enhanced.haloSigmaCssPixels,
    enhanced.haloStrength,
    enhanced.dispersionCssPixels,
  ]
  actualValues.forEach((value, index) => assertAlmostEqual(
    value,
    interpolateAppearanceValue(realisticValues[index], enhancedValues[index], enhancement),
    1e-12,
  ))
}

function assertVisualAlmostEqual(
  actual: StarVisualCssPixels,
  expected: StarVisualCssPixels,
  tolerance: number,
) {
  const actualValues = [
    actual.color.r,
    actual.color.g,
    actual.color.b,
    actual.spriteSizeCssPixels,
    actual.signal,
    actual.coreSigmaCssPixels,
    actual.haloSigmaCssPixels,
    actual.haloStrength,
    actual.dispersionCssPixels,
  ]
  const expectedValues = [
    expected.color.r,
    expected.color.g,
    expected.color.b,
    expected.spriteSizeCssPixels,
    expected.signal,
    expected.coreSigmaCssPixels,
    expected.haloSigmaCssPixels,
    expected.haloStrength,
    expected.dispersionCssPixels,
  ]
  actualValues.forEach((value, index) => assertAlmostEqual(value, expectedValues[index], tolerance))
}

function assertFiniteNumbers(values: readonly number[], label: string) {
  assert(
    values.every((value) => Number.isFinite(value) && value >= 0),
    `${label} must be finite and non-negative`,
  )
}

function assertAlmostEqual(actual: number, expected: number, tolerance: number) {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`)
}

function assertIntermediateSamples(values: readonly number[], label: string) {
  const minimum = Math.min(values[0], values.at(-1)!)
  const maximum = Math.max(values[0], values.at(-1)!)
  values.slice(1, -1).forEach((value, index) => {
    assert(value > minimum && value < maximum, `${label} sample ${index + 1} is not intermediate`)
  })
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

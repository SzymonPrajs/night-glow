import assert from 'node:assert/strict'
import {
  angularDiameterDegrees,
  angularSpriteScale,
  clearAirTransmissionRgb,
  moonSkyStrength,
  moonZenithLuminanceRatio,
  relativeMoonIlluminance,
  solarZenithLuminanceRatio,
} from '../src/lib/celestialLight'
import type { Atmosphere } from '../src/types'

const KM_PER_AU = 149_597_870.7

const atmosphere: Atmosphere = {
  aerosol: 0.14,
  humidity: 0.5,
  cloud: 0,
  cloudBase: 6.5,
  angstromExponent: 1.3,
  aerosolScaleHeightKm: 1.4,
  aerosolSingleScatteringAlbedo: 0.92,
  aerosolAsymmetry: 0.68,
  cloudThicknessKm: 1.8,
  cloudOpticalDepth: 0,
  groundAlbedo: 0.15,
  maxScatteringOrder: 4,
}

const meanSolarDiameter = angularDiameterDegrees(695_700, 1)
const meanLunarDiameter = angularDiameterDegrees(1_737.4, 384_400 / KM_PER_AU)
assert(meanSolarDiameter > 0.53 && meanSolarDiameter < 0.534)
assert(meanLunarDiameter > 0.517 && meanLunarDiameter < 0.519)
assert.equal(angularDiameterDegrees(0, 1), 0)
assert.equal(angularDiameterDegrees(1, 0), 0)
assertAlmostEqual(angularSpriteScale(meanSolarDiameter, 92), 2 * 92 * Math.tan(meanSolarDiameter * Math.PI / 360), 1e-12)

const solarAltitudes = [-25, -18, -15, -12, -9, -6, -3, 0, 6, 15, 45, 90]
const solarRatios = solarAltitudes.map(solarZenithLuminanceRatio)
assert.equal(solarRatios[0], 0)
assert.equal(solarRatios[1], 0)
assertAlmostEqual(solarZenithLuminanceRatio(0), 40_000, 1e-8)
assertAlmostEqual(solarZenithLuminanceRatio(45), 8_000_000, 1e-6)
assertStrictlyIncreasing(solarRatios.slice(1), 'Solar zenith luminance')

assertAlmostEqual(relativeMoonIlluminance(-12.74), 1, 1e-12)
assert(relativeMoonIlluminance(-10) < 0.1, 'Lunar brightness must use magnitude, not illuminated area alone')
assertAlmostEqual(moonZenithLuminanceRatio(1), 30, 1e-12)
const highMoon = moonSkyStrength({ magnitude: -12.74, altitude: 70 }, atmosphere)
const lowMoon = moonSkyStrength({ magnitude: -12.74, altitude: 5 }, atmosphere)
assert(highMoon > lowMoon)
assert(lowMoon > 0)
assert.equal(moonSkyStrength({ magnitude: -12.74, altitude: -1 }, atmosphere), 0)

const zenithTransmission = clearAirTransmissionRgb(90, atmosphere)
const horizonTransmission = clearAirTransmissionRgb(2, atmosphere)
assert(horizonTransmission[0] < zenithTransmission[0])
assert(horizonTransmission[1] < zenithTransmission[1])
assert(horizonTransmission[2] < zenithTransmission[2])
assert(horizonTransmission[2] < horizonTransmission[0], 'Low celestial discs must redden through the long air column')

console.log(JSON.stringify({
  angularDiameterDeg: { sunAtOneAu: meanSolarDiameter, moonAtMeanDistance: meanLunarDiameter },
  solar: { altitudesDeg: solarAltitudes, zenithLuminanceRatio: solarRatios },
  moon: { highStrength: highMoon, lowStrength: lowMoon, fullMoonZenithRatio: moonZenithLuminanceRatio(1) },
  transmission: { zenith: zenithTransmission, twoDegrees: horizonTransmission },
}, null, 2))

function assertAlmostEqual(actual: number, expected: number, tolerance: number) {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`)
}

function assertStrictlyIncreasing(values: readonly number[], label: string) {
  values.forEach((value, index) => {
    if (index > 0) assert(value > values[index - 1], `${label} did not increase at index ${index}`)
  })
}

import assert from 'node:assert/strict'
import { DEFAULT_SEEING_CONDITIONS, gaussianPsf, seeingPsf } from '../src/lib/seeing'

const zenith = seeingPsf(DEFAULT_SEEING_CONDITIONS, 90)
const low = seeingPsf(DEFAULT_SEEING_CONDITIONS, 20)
const slowWind = seeingPsf({ ...DEFAULT_SEEING_CONDITIONS, effectiveWindMps: 9 }, 90)

assert(Math.abs(zenith.referenceFwhmArcsec - 1.4) < 0.002)
assert(low.referenceFwhmArcsec > zenith.referenceFwhmArcsec)
assert(zenith.fwhmArcsec[0] < zenith.fwhmArcsec[1])
assert(zenith.fwhmArcsec[1] < zenith.fwhmArcsec[2])
assert(Math.abs(slowWind.coherenceTimeMs / zenith.coherenceTimeMs - 2) < 1e-12)

const sigma = zenith.sigmaArcsec[1]
const step = sigma / 80
let integral = 0
for (let y = -6 * sigma; y <= 6 * sigma; y += step) {
  for (let x = -6 * sigma; x <= 6 * sigma; x += step) {
    integral += gaussianPsf(Math.hypot(x, y), sigma) * step * step
  }
}
assert(Math.abs(integral - 1) < 0.002, `Gaussian integral was ${integral}`)

console.log(JSON.stringify({
  zenith,
  twentyDegrees: low,
  gaussianIntegral: integral,
  slowWindCoherenceTimeMs: slowWind.coherenceTimeMs,
}, null, 2))

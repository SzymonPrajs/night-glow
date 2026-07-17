import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const { Body, GeoVector } = createRequire(import.meta.url)('astronomy-engine') as typeof import('astronomy-engine')

type Fixture = {
  query: { time_utc: string }
  acceptance: {
    angular_error_arcsec_max: number
    distance_relative_error_max: number
  }
  vectors_au: Array<{
    body: 'Sun' | 'Moon' | 'Mars'
    position: [number, number, number]
  }>
}

const fixtureUrl = new URL('../../../packages/physics/fixtures/jpl-horizons-v1.json', import.meta.url)
const fixture = JSON.parse(readFileSync(fixtureUrl, 'utf8')) as Fixture
const bodyIds = { Sun: Body.Sun, Moon: Body.Moon, Mars: Body.Mars }
const date = new Date(fixture.query.time_utc)
let maximumAngularError = 0
let maximumDistanceRelativeError = 0

for (const reference of fixture.vectors_au) {
  const actual = GeoVector(bodyIds[reference.body], date, true)
  const actualVector = [actual.x, actual.y, actual.z]
  const actualLength = Math.hypot(...actualVector)
  const referenceLength = Math.hypot(...reference.position)
  const dot = actualVector.reduce((sum, value, index) => sum + value * reference.position[index], 0)
  const cosine = Math.max(-1, Math.min(1, dot / (actualLength * referenceLength)))
  const angularErrorArcsec = Math.acos(cosine) * (180 / Math.PI) * 3_600
  const distanceRelativeError = Math.abs(actualLength - referenceLength) / referenceLength
  maximumAngularError = Math.max(maximumAngularError, angularErrorArcsec)
  maximumDistanceRelativeError = Math.max(maximumDistanceRelativeError, distanceRelativeError)
  if (angularErrorArcsec > fixture.acceptance.angular_error_arcsec_max) {
    throw new Error(`${reference.body} angular error ${angularErrorArcsec} arcsec exceeds the fixture limit`)
  }
  if (distanceRelativeError > fixture.acceptance.distance_relative_error_max) {
    throw new Error(`${reference.body} distance error ${distanceRelativeError} exceeds the fixture limit`)
  }
}

console.log(JSON.stringify({
  reference: 'NASA/JPL Horizons geocentric ICRF LT+S vectors',
  bodies: fixture.vectors_au.length,
  maximum_angular_error_arcsec: maximumAngularError,
  maximum_distance_relative_error: maximumDistanceRelativeError,
}, null, 2))

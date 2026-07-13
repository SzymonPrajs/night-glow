import assert from 'node:assert/strict'
import {
  bearingDegrees,
  buildEmissionGrid,
  createRegionalSettlementSources,
  destinationPoint,
  normalizedSpectralFlux,
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
import type { EllipseEmissionSource, EmissionGrid } from '../src/lib/emission'

const observer = { lat: 51.5329, lon: 18.9390 }
const regionalSources = createRegionalSettlementSources()
const lodz = regionalSources.find((source) => source.id === 'regional-pl-lodz')
assert(lodz, 'The regional model must contain the extended Lodz footprint')

const emissionStarted = performance.now()
const regionalGrid = buildEmissionGrid({ observer, sources: regionalSources })
const lodzGrid = buildEmissionGrid({ observer, sources: [lodz] })
const emissionMs = performance.now() - emissionStarted

assert.equal(regionalGrid.rings.length, 81)
assert.equal(regionalGrid.sectorCount, 720)
assert.equal(regionalGrid.bands.length, 8)
assert(regionalGrid.diagnostics.conservation.maxRelativeError < 1e-9)
assert(lodzGrid.diagnostics.conservation.maxRelativeError < 1e-9)

const footprint = occupiedCells(lodzGrid)
const expectedBearing = bearingDegrees(observer, lodz.center)
assert(footprint.sectors.size >= 40, 'Lodz must span at least 20 degrees, not collapse to a point')
assert(footprint.rings.size >= 8, 'Lodz must be integrated across its radial depth')
assert.equal(lodzGrid.diagnostics.sources[0].depositedFraction, 1)

const kernelStarted = performance.now()
const kernel = buildAtmosphericKernel()
const kernelMs = performance.now() - kernelStarted
assert(kernel.maxOrdersUsed > 1 && kernel.maxOrdersUsed <= 10)

const field = createRingEmissionField(
  POLAR_RINGS.map((ring) => ring.midpointKm),
  SECTOR_COUNT,
  SPECTRAL_BANDS.map((band) => band.id),
  lodzGrid.values,
)
const planStarted = performance.now()
const plan = createRingConvolutionPlan(kernel, field.ringDistancesKm, field.sectorCount)
const planMs = performance.now() - planStarted
const solveStarted = performance.now()
const sky = convolveRingEmissionField(kernel, field, undefined, plan)
const solveMs = performance.now() - solveStarted

assertFiniteNonNegative(sky.radiance, 'Lodz sky radiance')
const peakBearing = broadbandPeakBearing(sky.radiance, 0, sky.azimuthsDeg)
assert(angularDistance(peakBearing, expectedBearing) < 2,
  `Glow peak ${peakBearing.toFixed(1)} degrees must follow Lodz at ${expectedBearing.toFixed(1)} degrees`)

const doubledField = createRingEmissionField(
  field.ringDistancesKm,
  field.sectorCount,
  field.bandIds,
  Float64Array.from(field.spectralPower, (value) => value * 2),
)
const doubledSky = convolveRingEmissionField(kernel, doubledField, undefined, plan)
const linearityError = maximumScaledError(sky.radiance, doubledSky.radiance, 2)
assert(linearityError < 2e-6, `Radiative transfer must remain linear; error was ${linearityError}`)

const sectorShift = 73
const shiftedField = createRingEmissionField(
  field.ringDistancesKm,
  field.sectorCount,
  field.bandIds,
  rotateSectors(field.spectralPower, field.ringDistancesKm.length, field.sectorCount, field.bandIds.length, sectorShift),
)
const shiftedSky = convolveRingEmissionField(kernel, shiftedField, undefined, plan)
const rotationError = maximumRotationError(sky.radiance, shiftedSky.radiance, sky.elevationsDeg.length,
  field.sectorCount, field.bandIds.length, sectorShift)
assert(rotationError < 2e-5, `A rotated source field must rotate the sky; error was ${rotationError}`)

const farBearing = 70
const farSource: EllipseEmissionSource = {
  id: 'test-far-city',
  name: 'Synthetic distant city',
  component: 'settlement-proxy',
  coverageId: 'test:far-city',
  evidence: 'built-population-proxy',
  spectralFlux: normalizedSpectralFlux(1000, [0.055, 0.09, 0.115, 0.145, 0.17, 0.21, 0.13, 0.085]),
  geometry: 'ellipse',
  center: destinationPoint(observer, farBearing, 600),
  semiMajorKm: 20,
  semiMinorKm: 15,
  rotationDeg: 0,
}
const farGrid = buildEmissionGrid({ observer, sources: [farSource] })
assert(farGrid.diagnostics.conservation.maxRelativeError < 1e-9)
const farField = createRingEmissionField(
  field.ringDistancesKm,
  field.sectorCount,
  field.bandIds,
  farGrid.values,
)
const farSky = convolveRingEmissionField(kernel, farField, undefined, plan)
const farHighAtmosphereRadiance = broadbandAt(farSky.radiance, farSky.elevationsDeg.indexOf(20),
  Math.round(farBearing / (360 / SECTOR_COUNT)), SPECTRAL_BANDS.length, SECTOR_COUNT)
assert(farHighAtmosphereRadiance > 0,
  'A bright city at 600 km must retain a finite high-atmosphere scattered contribution')

const result = {
  observer,
  grid: {
    rings: regionalGrid.rings.length,
    detailedRings: regionalGrid.rings.filter((ring) => ring.resolution === 'detailed').length,
    tailRings: regionalGrid.rings.filter((ring) => ring.resolution === 'tail').length,
    sectors: regionalGrid.sectorCount,
    bands: regionalGrid.bands.length,
    regionalConservationError: regionalGrid.diagnostics.conservation.maxRelativeError,
  },
  lodz: {
    expectedBearingDeg: expectedBearing,
    glowPeakBearingDeg: peakBearing,
    occupiedSectors: footprint.sectors.size,
    angularWidthDeg: footprint.sectors.size * (360 / SECTOR_COUNT),
    occupiedRings: footprint.rings.size,
    quadratureSamples: lodzGrid.diagnostics.sources[0].sampleCount,
    conservationError: lodzGrid.diagnostics.conservation.maxRelativeError,
  },
  invariants: {
    linearityError,
    rotationError,
    farCityDistanceKm: 600,
    farCityRadianceAt20Deg: farHighAtmosphereRadiance,
    finiteNonNegative: true,
  },
  performanceMs: {
    emission: emissionMs,
    kernel: kernelMs,
    harmonicPlan: planMs,
    fullSkyConvolution: solveMs,
  },
}

console.log(JSON.stringify(result, null, 2))

function occupiedCells(grid: EmissionGrid) {
  const sectors = new Set<number>()
  const rings = new Set<number>()
  for (let ring = 0; ring < grid.rings.length; ring += 1) {
    for (let sector = 0; sector < grid.sectorCount; sector += 1) {
      const base = (ring * grid.sectorCount + sector) * grid.bands.length
      let total = 0
      for (let band = 0; band < grid.bands.length; band += 1) total += grid.values[base + band]
      if (total > 0) {
        rings.add(ring)
        sectors.add(sector)
      }
    }
  }
  return { rings, sectors }
}

function broadbandPeakBearing(radiance: Float32Array, elevationIndex: number, azimuths: readonly number[]) {
  let peakIndex = 0
  let peakValue = -Infinity
  for (let sector = 0; sector < azimuths.length; sector += 1) {
    const value = broadbandAt(radiance, elevationIndex, sector, SPECTRAL_BANDS.length, azimuths.length)
    if (value > peakValue) {
      peakValue = value
      peakIndex = sector
    }
  }
  return azimuths[peakIndex]
}

function broadbandAt(values: Float32Array, elevation: number, sector: number, bands: number, sectors: number) {
  let total = 0
  const base = (elevation * sectors + sector) * bands
  for (let band = 0; band < bands; band += 1) total += values[base + band]
  return total
}

function rotateSectors(values: Float64Array, rings: number, sectors: number, bands: number, shift: number) {
  const rotated = new Float64Array(values.length)
  for (let ring = 0; ring < rings; ring += 1) {
    for (let sector = 0; sector < sectors; sector += 1) {
      const destinationSector = (sector + shift) % sectors
      for (let band = 0; band < bands; band += 1) {
        rotated[(ring * sectors + destinationSector) * bands + band] =
          values[(ring * sectors + sector) * bands + band]
      }
    }
  }
  return rotated
}

function maximumScaledError(reference: Float32Array, scaled: Float32Array, scale: number) {
  let maximum = 0
  for (let index = 0; index < reference.length; index += 1) {
    const expected = reference[index] * scale
    maximum = Math.max(maximum, Math.abs(scaled[index] - expected) / Math.max(1e-12, Math.abs(expected)))
  }
  return maximum
}

function maximumRotationError(
  reference: Float32Array,
  rotated: Float32Array,
  elevations: number,
  sectors: number,
  bands: number,
  shift: number,
) {
  let maximum = 0
  for (let elevation = 0; elevation < elevations; elevation += 1) {
    for (let sector = 0; sector < sectors; sector += 1) {
      const shiftedSector = (sector + shift) % sectors
      for (let band = 0; band < bands; band += 1) {
        const expected = reference[(elevation * sectors + sector) * bands + band]
        const actual = rotated[(elevation * sectors + shiftedSector) * bands + band]
        maximum = Math.max(maximum, Math.abs(actual - expected) / Math.max(1e-12, Math.abs(expected)))
      }
    }
  }
  return maximum
}

function assertFiniteNonNegative(values: Float32Array, label: string) {
  for (let index = 0; index < values.length; index += 1) {
    assert(Number.isFinite(values[index]) && values[index] >= 0, `${label} contains an invalid value at ${index}`)
  }
}

function angularDistance(left: number, right: number) {
  return Math.abs(((left - right + 540) % 360) - 180)
}

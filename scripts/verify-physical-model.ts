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
  buildAtmosphericKernelAsync,
  computeUnitSourceSpectrum,
  convolveRingEmissionField,
  createRingConvolutionPlan,
  createRingEmissionField,
  DEFAULT_RELATIVE_AZIMUTHS_DEG,
  DEFAULT_SKY_ELEVATIONS_DEG,
  sampleAtmosphericKernel,
  solidAngleElevationWeights,
} from '../src/lib/physics'
import type { EllipseEmissionSource, EmissionGrid } from '../src/lib/emission'
import { buildPhysicalGlowRenderGrid } from '../src/lib/physicalGlowRender'

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

const solvedElevations = Float32Array.from(DEFAULT_SKY_ELEVATIONS_DEG)
assert.equal(solvedElevations[0], 0)
assert.equal(solvedElevations.at(-1), 90)
assert(solvedElevations.every((value, index) =>
  Number.isFinite(value) && (index === 0 || value > solvedElevations[index - 1])))
assert(maximumElevationStep(solvedElevations, 0, 0.25) <= 0.12501)
assert(maximumElevationStep(solvedElevations, 0.25, 3) <= 0.50001)
assert(maximumElevationStep(solvedElevations, 3, 8) <= 1.00001)
assert(maximumElevationStep(solvedElevations, 8, 20) <= 5.00001)
assert(solvedElevations.filter((value) => value <= 10).length >= 15)
assert(solvedElevations.length <= 24, 'Adaptive physical elevation grid must stay bounded')

const solidAngleWeights = solidAngleElevationWeights(solvedElevations)
assert(Math.abs(sum(solidAngleWeights) - 1) < 1e-12)
assert(solidAngleWeights.every((weight) => Number.isFinite(weight) && weight >= 0))
const sineHemisphereMean = Array.from(solvedElevations).reduce(
  (mean, elevation, index) => mean + Math.sin(elevation * Math.PI / 180) * solidAngleWeights[index],
  0,
)
assert(Math.abs(sineHemisphereMean - 0.5) < 1e-12)
const denseQuadratureElevations = Float64Array.from({ length: 721 }, (_, index) => index * 0.125)
const denseWeights = solidAngleElevationWeights(denseQuadratureElevations)
const glowProfile = (elevation: number) => 1 + 3 * Math.exp(-elevation / 2)
const adaptiveProfileMean = Array.from(solvedElevations).reduce(
  (mean, elevation, index) => mean + glowProfile(elevation) * solidAngleWeights[index],
  0,
)
const denseProfileMean = Array.from(denseQuadratureElevations).reduce(
  (mean, elevation, index) => mean + glowProfile(elevation) * denseWeights[index],
  0,
)
assert(Math.abs(adaptiveProfileMean - denseProfileMean) / denseProfileMean < 0.01)

const horizonInterpolation = elevationInterpolationErrors(DEFAULT_SKY_ELEVATIONS_DEG)
assert(horizonInterpolation.rms < 0.01,
  `Adaptive horizon interpolation RMS was ${(horizonInterpolation.rms * 100).toFixed(2)}%`)
assert(horizonInterpolation.p95 < 0.015,
  `Adaptive horizon interpolation p95 was ${(horizonInterpolation.p95 * 100).toFixed(2)}%`)
assert(horizonInterpolation.maximum < 0.12,
  `Adaptive horizon interpolation maximum was ${(horizonInterpolation.maximum * 100).toFixed(2)}%`)

const renderFixture = buildPhysicalGlowRenderGrid({
  azimuthCount: 2,
  elevationDeg: new Float32Array([0, 2, 5, 10, 20, 45, 90]),
  rgbRadiance: new Float32Array([
    1, 0.8, 0.6, 0.5, 0.4, 0.3,
    0.7, 0.56, 0.42, 0.35, 0.28, 0.21,
    0.4, 0.32, 0.24, 0.2, 0.16, 0.12,
    0.2, 0.16, 0.12, 0.1, 0.08, 0.06,
    0.08, 0.064, 0.048, 0.04, 0.032, 0.024,
    0.02, 0.016, 0.012, 0.01, 0.008, 0.006,
    0.005, 0.004, 0.003, 0.0025, 0.002, 0.0015,
  ]),
})
assert(maximumElevationStep(renderFixture.elevationDeg, 0, 10) <= 0.25001)
assert(maximumElevationStep(renderFixture.elevationDeg, 10, 30) <= 0.50001)
assert(maximumElevationStep(renderFixture.elevationDeg, 30, 60) <= 1.00001)
assert(maximumElevationStep(renderFixture.elevationDeg, 60, 90) <= 2.00001)
assert.deepEqual(
  Array.from(renderFixture.elevationDeg).filter((value) => [0, 2, 5, 10, 20, 45, 90].includes(value)),
  [0, 2, 5, 10, 20, 45, 90],
)
assertFiniteNonNegative(renderFixture.rgbRadiance, 'Densified render radiance')
const adaptiveRenderFixture = buildPhysicalGlowRenderGrid({
  azimuthCount: 1,
  elevationDeg: solvedElevations,
  rgbRadiance: new Float32Array(solvedElevations.length * 3),
})
assert.equal(adaptiveRenderFixture.elevationDeg.length, 128)
assert.deepEqual(
  Array.from(adaptiveRenderFixture.elevationDeg).filter((value) => DEFAULT_SKY_ELEVATIONS_DEG.includes(value)),
  DEFAULT_SKY_ELEVATIONS_DEG,
)

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
  180 / SECTOR_COUNT,
)
const planStarted = performance.now()
const plan = createRingConvolutionPlan(kernel, field.ringDistancesKm, field.sectorCount)
const planMs = performance.now() - planStarted
const planBytes = plan.kernelFrequencySpectrum.byteLength + plan.kernelMeanTransfer.byteLength
assert(planBytes <= 120 * 2 ** 20,
  `FFT plan ${(planBytes / 2 ** 20).toFixed(1)} MiB exceeds the 120 MiB budget`)
assert.equal(plan.version, 2)
assert.equal(plan.fftSize, 2048)
assert.equal(DEFAULT_RELATIVE_AZIMUTHS_DEG[1], 0.5)
const fftDirectError = verifyFftAgainstDirectConvolution(kernel)
assert(fftDirectError < 2e-5, `FFT convolution must match direct circular summation; error was ${fftDirectError}`)
const solveStarted = performance.now()
const sky = convolveRingEmissionField(kernel, field, undefined, plan)
const solveMs = performance.now() - solveStarted
assert(solveMs < 1000, `Cached full-sky convolution took ${solveMs.toFixed(0)} ms`)
assert.equal(sky.elevationsDeg.length, DEFAULT_SKY_ELEVATIONS_DEG.length)
assert.equal(sky.radiance.length, DEFAULT_SKY_ELEVATIONS_DEG.length * SECTOR_COUNT * SPECTRAL_BANDS.length)

assertFiniteNonNegative(sky.radiance, 'Lodz sky radiance')
const peakBearing = broadbandPeakBearing(sky.radiance, 0, sky.azimuthsDeg)
assert(angularDistance(peakBearing, expectedBearing) < 2,
  `Glow peak ${peakBearing.toFixed(1)} degrees must follow Lodz at ${expectedBearing.toFixed(1)} degrees`)
const detachedHorizonLobes = countDetachedBroadbandPeaks(
  sky.radiance,
  0,
  sky.azimuthsDeg.length,
  SPECTRAL_BANDS.length,
  0.001,
  15,
)
assert.equal(detachedHorizonLobes, 0, 'Positive convolution must not introduce detached Lodz side lobes')
const dcError = angularMeanConservationError(sky.radiance, field, plan, 0)
assert(dcError < 2e-6, `Circular convolution must preserve angular mean; error was ${dcError}`)

const regionalField = createRingEmissionField(
  field.ringDistancesKm,
  field.sectorCount,
  field.bandIds,
  regionalGrid.values,
  field.azimuthOffsetDeg,
)
const regionalSky = convolveRingEmissionField(kernel, regionalField, undefined, plan)
const lodzLobe = meanBroadbandBetween(regionalSky.radiance, regionalSky.azimuthsDeg, 40, 70)
const oppositeLobe = meanBroadbandBetween(regionalSky.radiance, regionalSky.azimuthsDeg, 220, 250)
assert(lodzLobe > oppositeLobe * 20,
  'The full regional field must retain a dominant northeast Lodz lobe')

const doubledField = createRingEmissionField(
  field.ringDistancesKm,
  field.sectorCount,
  field.bandIds,
  Float64Array.from(field.spectralPower, (value) => value * 2),
  field.azimuthOffsetDeg,
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
  field.azimuthOffsetDeg,
)
const shiftedSky = convolveRingEmissionField(kernel, shiftedField, undefined, plan)
const rotationError = normalizedRotationL1Error(sky.radiance, shiftedSky.radiance, sky.elevationsDeg.length,
  field.sectorCount, field.bandIds.length, sectorShift)
assert(rotationError < 2e-7, `A rotated source field must rotate the sky; error was ${rotationError}`)

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
  field.azimuthOffsetDeg,
)
const farSky = convolveRingEmissionField(kernel, farField, undefined, plan)
const farHighAtmosphereRadiance = broadbandAt(farSky.radiance, farSky.elevationsDeg.indexOf(20),
  Math.round(farBearing / (360 / SECTOR_COUNT)), SPECTRAL_BANDS.length, SECTOR_COUNT)
assert(farHighAtmosphereRadiance > 0,
  'A bright city at 600 km must retain a finite high-atmosphere scattered contribution')

const cardinalPeakErrors = cardinalFixtures().map((fixture) => {
  const grid = buildEmissionGrid({ observer, sources: [fixture.source] })
  const cardinalField = createRingEmissionField(
    field.ringDistancesKm,
    field.sectorCount,
    field.bandIds,
    grid.values,
    field.azimuthOffsetDeg,
  )
  const cardinalSky = convolveRingEmissionField(kernel, cardinalField, undefined, plan)
  const peak = broadbandPeakBearing(cardinalSky.radiance, 0, cardinalSky.azimuthsDeg)
  const error = angularDistance(peak, fixture.expectedBearing)
  assert(error < 3, `${fixture.name} fixture peaked at ${peak.toFixed(1)} degrees`)
  return { name: fixture.name, peakBearingDeg: peak, errorDeg: error }
})

let cancellationChecks = 0
await assert.rejects(
  buildAtmosphericKernelAsync({}, {
    distancesKm: [1, 10],
    relativeAzimuthsDeg: [0, 30, 60, 90, 120, 150, 180],
    elevationsDeg: [0, 10, 30],
  }, {
    yieldEvery: 16,
    shouldCancel: () => ++cancellationChecks > 1,
  }),
  /cancelled/,
)

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
    angularMeanConservationError: dcError,
    fftDirectConvolutionError: fftDirectError,
    detachedLodzHorizonLobes: detachedHorizonLobes,
    farCityDistanceKm: 600,
    farCityRadianceAt20Deg: farHighAtmosphereRadiance,
    fullRegionalLodzToOppositeRatio: lodzLobe / oppositeLobe,
    cardinalPeakErrors,
    asyncKernelCancellationChecks: cancellationChecks,
    finiteNonNegative: true,
    physicalElevationRows: solvedElevations.length,
    horizonInterpolation,
    adaptiveSolidAngleProfileError: Math.abs(adaptiveProfileMean - denseProfileMean) / denseProfileMean,
    renderElevationRows: renderFixture.elevationDeg.length,
    renderHorizonStepDeg: maximumElevationStep(renderFixture.elevationDeg, 0, 10),
  },
  performanceMs: {
    emission: emissionMs,
    kernel: kernelMs,
    fftPlan: planMs,
    fftPlanMiB: planBytes / 2 ** 20,
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

function meanBroadbandBetween(
  radiance: Float32Array,
  azimuths: readonly number[],
  minimumBearing: number,
  maximumBearing: number,
) {
  let total = 0
  let samples = 0
  for (let sector = 0; sector < azimuths.length; sector += 1) {
    if (azimuths[sector] < minimumBearing || azimuths[sector] > maximumBearing) continue
    total += broadbandAt(radiance, 0, sector, SPECTRAL_BANDS.length, azimuths.length)
    samples += 1
  }
  return total / Math.max(1, samples)
}

function cardinalFixtures() {
  const spectrum = normalizedSpectralFlux(100, [0.055, 0.09, 0.115, 0.145, 0.17, 0.21, 0.13, 0.085])
  const fixture = (name: string, expectedBearing: number, center: { lat: number; lon: number }) => ({
    name,
    expectedBearing,
    source: {
      id: `cardinal-${name}`,
      name,
      component: 'test',
      coverageId: `test:${name}`,
      evidence: 'built-population-proxy' as const,
      spectralFlux: spectrum,
      geometry: 'ellipse' as const,
      center,
      semiMajorKm: 1,
      semiMinorKm: 1,
      rotationDeg: 0,
    },
  })
  return [
    fixture('north', 0, { lat: observer.lat + 0.25, lon: observer.lon }),
    fixture('east', 90, { lat: observer.lat, lon: observer.lon + 0.4 }),
    fixture('south', 180, { lat: observer.lat - 0.25, lon: observer.lon }),
    fixture('west', 270, { lat: observer.lat, lon: observer.lon - 0.4 }),
  ]
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

function normalizedRotationL1Error(
  reference: Float32Array,
  rotated: Float32Array,
  elevations: number,
  sectors: number,
  bands: number,
  shift: number,
) {
  let difference = 0
  let total = 0
  for (let elevation = 0; elevation < elevations; elevation += 1) {
    for (let sector = 0; sector < sectors; sector += 1) {
      const shiftedSector = (sector + shift) % sectors
      for (let band = 0; band < bands; band += 1) {
        const expected = reference[(elevation * sectors + sector) * bands + band]
        const actual = rotated[(elevation * sectors + shiftedSector) * bands + band]
        difference += Math.abs(actual - expected)
        total += Math.abs(expected)
      }
    }
  }
  return difference / Math.max(1e-20, total)
}

function countDetachedBroadbandPeaks(
  values: Float32Array,
  elevation: number,
  sectors: number,
  bands: number,
  relativeThreshold: number,
  exclusionRadiusDeg: number,
) {
  const samples = Array.from(
    { length: sectors },
    (_, sector) => broadbandAt(values, elevation, sector, bands, sectors),
  )
  const peak = Math.max(...samples)
  const peakSector = samples.indexOf(peak)
  const threshold = peak * relativeThreshold
  let peaks = 0
  for (let sector = 0; sector < sectors; sector += 1) {
    const sectorDistance = Math.min(
      Math.abs(sector - peakSector),
      sectors - Math.abs(sector - peakSector),
    ) * 360 / sectors
    if (sectorDistance <= exclusionRadiusDeg) continue
    const previous = samples[(sector + sectors - 1) % sectors]
    const current = samples[sector]
    const next = samples[(sector + 1) % sectors]
    if (current >= threshold && current > previous && current >= next) peaks += 1
  }
  return peaks
}

function angularMeanConservationError(
  skyRadiance: Float32Array,
  source: ReturnType<typeof createRingEmissionField>,
  convolutionPlan: ReturnType<typeof createRingConvolutionPlan>,
  elevation: number,
) {
  const sectors = source.sectorCount
  const bands = source.bandIds.length
  const rings = source.ringDistancesKm.length
  let expected = 0
  for (let ring = 0; ring < rings; ring += 1) {
    for (let band = 0; band < bands; band += 1) {
      let sourceFlux = 0
      for (let sector = 0; sector < sectors; sector += 1) {
        sourceFlux += source.spectralPower[(ring * sectors + sector) * bands + band]
      }
      const meanIndex = ((elevation * rings + ring) * bands + band)
      expected += sourceFlux * convolutionPlan.kernelMeanTransfer[meanIndex]
    }
  }
  let actual = 0
  for (let sector = 0; sector < sectors; sector += 1) {
    actual += broadbandAt(skyRadiance, elevation, sector, bands, sectors)
  }
  actual /= sectors
  return Math.abs(actual - expected) / Math.max(1e-20, Math.abs(expected))
}

function verifyFftAgainstDirectConvolution(kernel: ReturnType<typeof buildAtmosphericKernel>) {
  const sectors = 8
  const sourceSector = sectors - 1
  const bands = kernel.bands.length
  const sourceSpectrum = Float64Array.from({ length: bands }, (_, band) => 1 + band * 0.125)
  const power = new Float64Array(sectors * bands)
  power.set(sourceSpectrum, sourceSector * bands)
  const fixture = createRingEmissionField(
    [48],
    sectors,
    kernel.bands.map((band) => band.id),
    power,
    360 / sectors / 2,
  )
  const fixturePlan = createRingConvolutionPlan(kernel, [48], sectors, [0])
  const fixtureSky = convolveRingEmissionField(kernel, fixture, [0], fixturePlan)
  const sampledKernel = new Float64Array(bands)
  let difference = 0
  let total = 0
  for (let sector = 0; sector < sectors; sector += 1) {
    sampleAtmosphericKernel(
      kernel,
      48,
      (sector - sourceSector) * 360 / sectors,
      0,
      sampledKernel,
    )
    for (let band = 0; band < bands; band += 1) {
      const expected = sourceSpectrum[band] * sampledKernel[band]
      const actual = fixtureSky.radiance[sector * bands + band]
      difference += Math.abs(actual - expected)
      total += Math.abs(expected)
    }
  }
  return difference / Math.max(1e-20, total)
}

function assertFiniteNonNegative(values: Float32Array, label: string) {
  for (let index = 0; index < values.length; index += 1) {
    assert(Number.isFinite(values[index]) && values[index] >= 0, `${label} contains an invalid value at ${index}`)
  }
}

function elevationInterpolationErrors(nodes: readonly number[]) {
  const fixtures = [
    [1, 0], [10, 0], [30, 0], [75, 0], [150, 0], [400, 0], [800, 0],
    [10, 30], [75, 30], [150, 30], [400, 30],
    [75, 90], [400, 90], [75, 180], [400, 180],
  ] as const
  const truthElevations = Array.from({ length: 81 }, (_, index) => index * 0.125)
  const horizonNodes = nodes.filter((elevation) => elevation <= 10)
  const errors: number[] = []

  for (const [distanceKm, relativeAzimuthDeg] of fixtures) {
    const truth = truthElevations.map((elevation) =>
      computeUnitSourceSpectrum(distanceKm, relativeAzimuthDeg, elevation).radiance)
    const peak = Math.max(...truth.flatMap((row) => Array.from(row)))
    let lower = 0
    for (let truthIndex = 0; truthIndex < truthElevations.length; truthIndex += 1) {
      const elevation = truthElevations[truthIndex]
      while (lower + 1 < horizonNodes.length - 1 && horizonNodes[lower + 1] < elevation) lower += 1
      const upper = Math.min(lower + 1, horizonNodes.length - 1)
      const lowerElevation = horizonNodes[lower]
      const upperElevation = horizonNodes[upper]
      const lowerValues = truth[Math.round(lowerElevation / 0.125)]
      const upperValues = truth[Math.round(upperElevation / 0.125)]
      const mix = upperElevation > lowerElevation
        ? (elevation - lowerElevation) / (upperElevation - lowerElevation)
        : 0
      for (let band = 0; band < truth[truthIndex].length; band += 1) {
        const interpolated = lowerValues[band] + (upperValues[band] - lowerValues[band]) * mix
        errors.push(Math.abs(interpolated - truth[truthIndex][band]) / Math.max(peak, 1e-30))
      }
    }
  }

  errors.sort((left, right) => left - right)
  return {
    rms: Math.sqrt(errors.reduce((total, error) => total + error * error, 0) / errors.length),
    p95: errors[Math.floor(errors.length * 0.95)],
    maximum: errors.at(-1) ?? 0,
  }
}

function sum(values: ArrayLike<number>) {
  let total = 0
  for (let index = 0; index < values.length; index += 1) total += values[index]
  return total
}

function maximumElevationStep(elevations: Float32Array, minimum: number, maximum: number) {
  let largest = 0
  for (let index = 1; index < elevations.length; index += 1) {
    if (elevations[index] <= minimum || elevations[index - 1] >= maximum) continue
    largest = Math.max(largest, elevations[index] - elevations[index - 1])
  }
  return largest
}

function angularDistance(left: number, right: number) {
  return Math.abs(((left - right + 540) % 360) - 180)
}

import {
  aerosolPhase,
  clamp,
  cloudPhase,
  nonNegativeFinite,
  normalizeRadiativeTransferOptions,
  prepareAtmosphere,
  rayleighPhase,
  upwardEmission,
  type PreparedAtmosphere,
} from './atmosphere'
import {
  EARTH_RADIUS_KM,
  GAUSS_4_NODES,
  GAUSS_4_WEIGHTS,
  GAUSS_10_NODES,
  GAUSS_10_WEIGHTS,
} from './constants'
import {
  altitudeKm,
  dot,
  magnitude,
  makeCurvedEarthGeometry,
  normalize,
  outwardSegmentLengthInAltitudeLayer,
  pointAlongRay,
  subtract,
} from './geometry'
import type {
  AtmosphereInput,
  CloudLayer,
  RadiativeTransferInput,
  RadiativeTransferOptions,
  SpectralBand,
  UnitSourceSpectrum,
  Vector3,
} from './types'

type ProfileColumns = {
  molecular: number
  aerosol: number
  cloud: number
}

export type MultipleScatteringResult = {
  total: number
  ordersUsed: number
  converged: boolean
  closedTail: number
}

/**
 * Computes the spectral response to one unit of upward spectral power.
 *
 * First order is the two-leg integral
 * L = integral U(zeta) / r^2 * exp[-tau(source,x)-tau(x,observer)]
 *     * [beta_R p_R + beta_a p_a + beta_c p_c] ds.
 * Geometry and optical-depth columns are evaluated on spherical altitude shells.
 */
export function computeUnitSourceSpectrum(
  sourceDistanceKm: number,
  relativeAzimuthDeg: number,
  viewElevationDeg: number,
  atmosphereInput: AtmosphereInput = {},
  bands?: readonly SpectralBand[],
  optionsInput: RadiativeTransferInput = {},
): UnitSourceSpectrum {
  const prepared = prepareAtmosphere(atmosphereInput, bands)
  const options = normalizeRadiativeTransferOptions(optionsInput)
  return computePreparedUnitSourceSpectrum(
    sourceDistanceKm,
    relativeAzimuthDeg,
    viewElevationDeg,
    prepared,
    options,
  )
}

export function computePreparedUnitSourceSpectrum(
  sourceDistanceKm: number,
  relativeAzimuthDeg: number,
  viewElevationDeg: number,
  atmosphere: PreparedAtmosphere,
  options: RadiativeTransferOptions,
): UnitSourceSpectrum {
  const topKm = Math.max(
    options.atmosphereTopKm,
    atmosphere.state.cloud.baseAltitudeKm + atmosphere.state.cloud.thicknessKm + 1,
  )
  const geometry = makeCurvedEarthGeometry(
    Math.max(0, sourceDistanceKm),
    relativeAzimuthDeg,
    viewElevationDeg,
    options.observerAltitudeKm,
    options.sourceAltitudeKm,
    topKm,
  )
  const bandCount = atmosphere.bands.length
  const singleScattering = new Float64Array(bandCount)
  const weightedTransportDepth = new Float64Array(bandCount)
  const aerosolPhaseValue = aerosolPhase(0, atmosphere)
  const cloudPhaseValue = cloudPhase(0, atmosphere)
  const intervals = makeViewIntervals(geometry, atmosphere, options)
  const reverseView: Vector3 = [
    -geometry.viewDirection[0],
    -geometry.viewDirection[1],
    -geometry.viewDirection[2],
  ]

  for (let intervalIndex = 0; intervalIndex < intervals.length - 1; intervalIndex += 1) {
    const start = intervals[intervalIndex]
    const end = intervals[intervalIndex + 1]
    if (end <= start) continue
    const halfWidth = (end - start) * 0.5
    const midpoint = (start + end) * 0.5

    for (let nodeIndex = 0; nodeIndex < GAUSS_4_NODES.length; nodeIndex += 1) {
      const distanceAlongView = midpoint + halfWidth * GAUSS_4_NODES[nodeIndex]
      const integrationWeight = halfWidth * GAUSS_4_WEIGHTS[nodeIndex]
      const scatterPoint = pointAlongRay(geometry.observer, geometry.viewDirection, distanceAlongView)
      const sourceToScatter = subtract(scatterPoint, geometry.source)
      const sourceRange = magnitude(sourceToScatter)
      if (sourceRange <= 0) continue
      const incomingDirection = normalize(sourceToScatter)
      const emissionCosine = dot(incomingDirection, geometry.sourceUp)
      if (emissionCosine <= 0) continue // Earth-curvature screening at the source.

      const scatterCosine = clamp(dot(incomingDirection, reverseView), -1, 1)
      const sourceIntensity = upwardEmission(emissionCosine, options.emissionProfile) /
        (sourceRange * sourceRange + options.sourceRadiusKm * options.sourceRadiusKm)
      if (sourceIntensity <= 0) continue

      const heightKm = Math.max(0, altitudeKm(scatterPoint))
      const observerColumns = integrateProfileColumns(geometry.observer, scatterPoint, atmosphere)
      const sourceColumns = integrateProfileColumns(geometry.source, scatterPoint, atmosphere)
      const molecularColumn = observerColumns.molecular + sourceColumns.molecular
      const aerosolColumn = observerColumns.aerosol + sourceColumns.aerosol
      const cloudColumn = observerColumns.cloud + sourceColumns.cloud
      const rayleighPhaseValue = rayleighPhase(scatterCosine)
      const localAerosolPhase = scatterCosine === 0 ? aerosolPhaseValue : aerosolPhase(scatterCosine, atmosphere)
      const localCloudPhase = scatterCosine === 0 ? cloudPhaseValue : cloudPhase(scatterCosine, atmosphere)
      const molecularDensity = Math.exp(-heightKm / atmosphere.state.molecularScaleHeightKm) /
        atmosphere.state.molecularScaleHeightKm
      const aerosolDensity = Math.exp(-heightKm / atmosphere.state.aerosolScaleHeightKm) /
        atmosphere.state.aerosolScaleHeightKm
      const cloudDensity = isInsideCloud(heightKm, atmosphere)
        ? atmosphere.state.cloud.coverage / atmosphere.state.cloud.thicknessKm
        : 0

      for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
        const optical = atmosphere.opticalBands[bandIndex]
        const extinctionDepth =
          optical.rayleighOpticalDepth * molecularColumn +
          optical.aerosolOpticalDepth * aerosolColumn +
          atmosphere.state.cloud.opticalDepth * cloudColumn
        const transmission = Math.exp(-Math.min(80, Math.max(0, extinctionDepth)))
        const rayleighScatter = optical.rayleighOpticalDepth * molecularDensity * rayleighPhaseValue
        const aerosolScatter =
          optical.aerosolOpticalDepth *
          aerosolDensity *
          atmosphere.state.aerosolSingleScatteringAlbedo *
          localAerosolPhase
        const cloudScatter =
          atmosphere.state.cloud.opticalDepth *
          cloudDensity *
          atmosphere.state.cloud.singleScatteringAlbedo *
          localCloudPhase
        const localScatter = rayleighScatter + aerosolScatter + cloudScatter
        const contribution = nonNegativeFinite(
          integrationWeight * sourceIntensity * transmission * localScatter,
        )
        singleScattering[bandIndex] += contribution

        const transportDepth =
          optical.rayleighOpticalDepth * molecularColumn +
          optical.aerosolOpticalDepth *
            aerosolColumn *
            atmosphere.state.aerosolSingleScatteringAlbedo *
            Math.max(0, 1 - atmosphere.aerosolEffectiveAsymmetry) +
          atmosphere.state.cloud.opticalDepth *
            cloudColumn *
            atmosphere.state.cloud.singleScatteringAlbedo *
            Math.max(0, 1 - atmosphere.cloudEffectiveAsymmetry)
        weightedTransportDepth[bandIndex] += contribution * Math.max(0, transportDepth)
      }
    }
  }

  const radiance = new Float64Array(bandCount)
  const continuationRatios = new Float64Array(bandCount)
  const ordersUsed = new Uint8Array(bandCount)
  const cloudReflectiveLoop =
    atmosphere.state.groundAlbedo *
    atmosphere.state.cloud.coverage *
    (1 - Math.exp(-atmosphere.state.cloud.opticalDepth)) * 0.35
  const lowCloudReturn = lowCloudUrbanReturnEnhancement(atmosphere.state.cloud)

  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    const firstOrder = nonNegativeFinite(singleScattering[bandIndex])
    const effectiveTransportDepth = firstOrder > 0
      ? weightedTransportDepth[bandIndex] / firstOrder
      : 0
    const atmosphericContinuation = 1 - Math.exp(-Math.max(0, effectiveTransportDepth))
    const continuation = clamp(
      1 - (1 - atmosphericContinuation) * (1 - cloudReflectiveLoop),
      0,
      options.multipleScattering.maxContinuationRatio,
    )
    continuationRatios[bandIndex] = continuation
    const multiple = sumConvergentScatteringSeries(firstOrder, continuation, options.multipleScattering)
    radiance[bandIndex] = nonNegativeFinite(multiple.total * lowCloudReturn)
    ordersUsed[bandIndex] = multiple.ordersUsed
  }

  return { radiance, singleScattering, continuationRatios, ordersUsed }
}

/**
 * Bounded unresolved return of artificial urban light from a low cloud deck.
 *
 * The resolved path integral already includes cloud scattering, but its unit
 * source geometry omits part of the broad city-to-deck-to-ground return seen
 * over polluted cities. This empirical closure multiplies only the final
 * artificial-light radiance: it does not alter direct celestial transmission,
 * natural sky radiance, first-order diagnostics, or clear-air calibration.
 * Coverage and optical depth increase the return monotonically; cloud height
 * suppresses it exponentially. Normalized inputs guarantee 1 <= factor <= 1.8.
 */
export function lowCloudUrbanReturnEnhancement(
  cloud: Pick<CloudLayer, 'coverage' | 'opticalDepth' | 'baseAltitudeKm'>,
) {
  const coverage = clamp(Number.isFinite(cloud.coverage) ? cloud.coverage : 0, 0, 1)
  const opticalDepth = Math.max(0, Number.isFinite(cloud.opticalDepth) ? cloud.opticalDepth : 0)
  const baseAltitudeKm = Number.isFinite(cloud.baseAltitudeKm)
    ? Math.max(0, cloud.baseAltitudeKm)
    : Number.POSITIVE_INFINITY
  return clamp(
    1 + 0.8 * coverage * (1 - Math.exp(-opticalDepth / 3)) * Math.exp(-baseAltitudeKm / 2),
    1,
    1.8,
  )
}

/**
 * Reduced successive-orders approximation L_n = rho L_(n-1). rho is clamped
 * below one by the caller, so the Neumann series is convergent. If maxOrders is
 * reached first, its exact geometric tail is optionally closed analytically.
 */
export function sumConvergentScatteringSeries(
  firstOrder: number,
  continuationRatio: number,
  options: RadiativeTransferOptions['multipleScattering'],
): MultipleScatteringResult {
  const first = nonNegativeFinite(firstOrder)
  const ratio = clamp(
    nonNegativeFinite(continuationRatio),
    0,
    Math.min(0.999999, options.maxContinuationRatio),
  )
  if (first === 0) return { total: 0, ordersUsed: 0, converged: true, closedTail: 0 }
  let total = first
  let term = first
  let ordersUsed = 1
  let converged = ratio === 0
  for (let order = 2; order <= options.maxOrders && !converged; order += 1) {
    term *= ratio
    total += term
    ordersUsed = order
    converged = term <= options.tolerance * total
  }
  let closedTail = 0
  if (!converged && options.closeTruncatedTail && ratio < 1) {
    closedTail = term * ratio / (1 - ratio)
    total += closedTail
    converged = true
  }
  return {
    total: nonNegativeFinite(total),
    ordersUsed,
    converged,
    closedTail: nonNegativeFinite(closedTail),
  }
}

/** Dimensionless slant columns multiplying each constituent's vertical optical depth. */
function integrateProfileColumns(start: Vector3, end: Vector3, atmosphere: PreparedAtmosphere): ProfileColumns {
  const delta = subtract(end, start)
  const lengthKm = magnitude(delta)
  if (lengthKm <= 1e-10) return { molecular: 0, aerosol: 0, cloud: 0 }
  let molecular = 0
  let aerosol = 0

  // t = u^2 clusters quadrature nodes near the ground endpoint, resolving a
  // 1-km aerosol layer even on a shallow, hundreds-of-kilometres chord.
  for (let nodeIndex = 0; nodeIndex < GAUSS_10_NODES.length; nodeIndex += 1) {
    const u = (GAUSS_10_NODES[nodeIndex] + 1) * 0.5
    const t = u * u
    const point: Vector3 = [
      start[0] + delta[0] * t,
      start[1] + delta[1] * t,
      start[2] + delta[2] * t,
    ]
    const heightKm = Math.max(0, altitudeKm(point))
    const transformedWeight = lengthKm * GAUSS_10_WEIGHTS[nodeIndex] * u
    molecular += transformedWeight *
      Math.exp(-heightKm / atmosphere.state.molecularScaleHeightKm) /
      atmosphere.state.molecularScaleHeightKm
    aerosol += transformedWeight *
      Math.exp(-heightKm / atmosphere.state.aerosolScaleHeightKm) /
      atmosphere.state.aerosolScaleHeightKm
  }

  const cloud = outwardSegmentLengthInAltitudeLayer(
    start,
    end,
    atmosphere.state.cloud.baseAltitudeKm,
    atmosphere.state.cloud.baseAltitudeKm + atmosphere.state.cloud.thicknessKm,
  ) * atmosphere.state.cloud.coverage / atmosphere.state.cloud.thicknessKm
  return {
    molecular: nonNegativeFinite(molecular),
    aerosol: nonNegativeFinite(aerosol),
    cloud: nonNegativeFinite(cloud),
  }
}

function makeViewIntervals(
  geometry: ReturnType<typeof makeCurvedEarthGeometry>,
  atmosphere: PreparedAtmosphere,
  options: RadiativeTransferOptions,
) {
  const topAltitude = Math.max(
    options.atmosphereTopKm,
    atmosphere.state.cloud.baseAltitudeKm + atmosphere.state.cloud.thicknessKm + 1,
  )
  const altitudeBreaks = [
    options.observerAltitudeKm,
    0.05,
    0.1,
    0.2,
    0.35,
    0.5,
    0.75,
    1,
    1.5,
    2,
    3,
    4,
    6,
    8,
    12,
    18,
    26,
    38,
    atmosphere.state.cloud.baseAltitudeKm,
    atmosphere.state.cloud.baseAltitudeKm + atmosphere.state.cloud.thicknessKm,
    topAltitude,
  ]
  const distances = altitudeBreaks
    .filter((height) => height >= options.observerAltitudeKm && height <= topAltitude)
    .map((height) => distanceToRadiusAlongRay(geometry.observer, geometry.viewDirection, EARTH_RADIUS_KM + height))
    .filter((distance) => Number.isFinite(distance) && distance >= 0 && distance <= geometry.atmosphereExitKm)

  const projectedSourceDistance = dot(subtract(geometry.source, geometry.observer), geometry.viewDirection)
  if (projectedSourceDistance > 0 && projectedSourceDistance < geometry.atmosphereExitKm) {
    const scale = Math.max(options.sourceRadiusKm, 0.1)
    for (const offset of [-4 * scale, -scale, 0, scale, 4 * scale]) {
      distances.push(clamp(projectedSourceDistance + offset, 0, geometry.atmosphereExitKm))
    }
  }
  distances.push(0, geometry.atmosphereExitKm)
  distances.sort((a, b) => a - b)
  const unique = distances.filter((distance, index) => index === 0 || distance - distances[index - 1] > 1e-7)
  const subdivided: number[] = [unique[0]]
  for (let index = 1; index < unique.length; index += 1) {
    const start = unique[index - 1]
    const end = unique[index]
    const midpointPoint = pointAlongRay(geometry.observer, geometry.viewDirection, (start + end) * 0.5)
    const midpointAltitude = altitudeKm(midpointPoint)
    const maxStep = midpointAltitude < 3 ? 20 : midpointAltitude < 10 ? 40 : 80
    const count = Math.max(1, Math.ceil((end - start) / maxStep))
    for (let part = 1; part <= count; part += 1) {
      subdivided.push(start + (end - start) * part / count)
    }
  }
  return subdivided
}

function distanceToRadiusAlongRay(origin: Vector3, direction: Vector3, radiusKm: number) {
  const projection = dot(origin, direction)
  const discriminant = projection * projection - dot(origin, origin) + radiusKm * radiusKm
  return -projection + Math.sqrt(Math.max(0, discriminant))
}

function isInsideCloud(heightKm: number, atmosphere: PreparedAtmosphere) {
  const cloud = atmosphere.state.cloud
  return cloud.coverage > 0 && cloud.opticalDepth > 0 &&
    heightKm >= cloud.baseAltitudeKm && heightKm <= cloud.baseAltitudeKm + cloud.thicknessKm
}

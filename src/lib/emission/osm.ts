import type { LightSource } from '../../types'
import { distanceKm, projectToLocalKm } from './geo'
import {
  CENTRAL_EUROPE_MIXED_LIGHT_PROFILE,
  createRegionalSettlementSources,
} from './regional'
import {
  addScaledSpectrum,
  copySpectralFlux,
  normalizedSpectralFlux,
  spectralTotal,
  spectrumToArray,
} from './spectrum'
import {
  SPECTRAL_BAND_COUNT,
  type EllipseEmissionSource,
  type EmissionEvidence,
  type EmissionSource,
  type GeoPoint,
  type SpectralFluxInput,
} from './types'

export type OsmRegionalFusionOptions = {
  regionalSources?: readonly EllipseEmissionSource[]
  spectralProfile?: SpectralFluxInput
  /** Maximum fraction of a settlement total that local geometry may replace. */
  maxRefinedFraction?: number
  roadWeightStrength?: number
  maxRoadWeightBoost?: number
  roadInfluenceDistanceKm?: number
  orphanRoadWidthKm?: number
}

export type OsmAllocationDiagnostic = {
  osmSourceId: string
  allocationWeight: number
  fractionOfRefinedFlux: number
  roadWeightBoost: number
}

export type OsmFootprintFusionDiagnostic = {
  footprintId: string
  footprintName: string
  origin: 'bundled-regional' | 'osm-place'
  coverageId: string
  totalFlux: number
  refinedFraction: number
  refinedFlux: number
  residualFlux: number
  builtSourceIds: string[]
  roadWeightSourceIds: string[]
  suppressedPlaceSourceIds: string[]
  allocations: OsmAllocationDiagnostic[]
}

export type OsmRegionalFusionDiagnostics = {
  spectralBandCount: number
  rawOsmSpectralFlux: number[]
  conservedInputSpectralFlux: number[]
  outputSpectralFlux: number[]
  residualSpectralFlux: number[]
  maxRelativeConservationError: number
  footprints: OsmFootprintFusionDiagnostic[]
  weightOnlyRoadSourceIds: string[]
  orphanProxySourceIds: string[]
  suppressedCoveredSourceIds: string[]
}

export type OsmRegionalFusionResult = {
  sources: EmissionSource[]
  diagnostics: OsmRegionalFusionDiagnostics
}

type MutableFootprint = {
  source: EllipseEmissionSource
  origin: OsmFootprintFusionDiagnostic['origin']
  built: LightSource[]
  roads: LightSource[]
  suppressedPlaces: LightSource[]
}

const DEFAULT_MAX_REFINED_FRACTION = 0.7
const DEFAULT_ROAD_WEIGHT_STRENGTH = 0.22
const DEFAULT_MAX_ROAD_WEIGHT_BOOST = 0.65
const DEFAULT_ROAD_INFLUENCE_DISTANCE_KM = 3
const DEFAULT_ORPHAN_ROAD_WIDTH_KM = 0.04

/**
 * Fuses OSM detail with conserved settlement totals.
 *
 * Covered OSM polygons redistribute a capped portion of a settlement total;
 * covered roads only alter those allocation weights. They never add another
 * copy of the settlement's light. Uncovered OSM features remain proxy sources.
 */
export function fuseOsmWithRegionalEmission(
  osmSources: readonly LightSource[],
  options: OsmRegionalFusionOptions = {},
): OsmRegionalFusionResult {
  const profile = copySpectralFlux(
    options.spectralProfile ?? CENTRAL_EUROPE_MIXED_LIGHT_PROFILE,
    'OSM fusion spectral profile',
  )
  const maxRefinedFraction = boundedOption(
    options.maxRefinedFraction,
    DEFAULT_MAX_REFINED_FRACTION,
    0,
    1,
    'maxRefinedFraction',
  )
  const roadWeightStrength = boundedOption(
    options.roadWeightStrength,
    DEFAULT_ROAD_WEIGHT_STRENGTH,
    0,
    Number.POSITIVE_INFINITY,
    'roadWeightStrength',
  )
  const maxRoadWeightBoost = boundedOption(
    options.maxRoadWeightBoost,
    DEFAULT_MAX_ROAD_WEIGHT_BOOST,
    0,
    Number.POSITIVE_INFINITY,
    'maxRoadWeightBoost',
  )
  const roadInfluenceDistanceKm = boundedOption(
    options.roadInfluenceDistanceKm,
    DEFAULT_ROAD_INFLUENCE_DISTANCE_KM,
    Number.EPSILON,
    Number.POSITIVE_INFINITY,
    'roadInfluenceDistanceKm',
  )
  const orphanRoadWidthKm = boundedOption(
    options.orphanRoadWidthKm,
    DEFAULT_ORPHAN_ROAD_WIDTH_KM,
    0,
    Number.POSITIVE_INFINITY,
    'orphanRoadWidthKm',
  )

  const regionalSources = options.regionalSources ?? createRegionalSettlementSources()
  const footprints: MutableFootprint[] = regionalSources.map((source) => ({
    source: cloneEllipse(source),
    origin: 'bundled-regional',
    built: [],
    roads: [],
    suppressedPlaces: [],
  }))
  const rawOsmSpectralFlux = new Float64Array(SPECTRAL_BAND_COUNT)
  for (const source of osmSources) {
    addScaledSpectrum(rawOsmSpectralFlux, normalizedSpectralFlux(Math.max(0, source.flux), profile))
  }

  // A place outside every bundled footprint becomes its own conserved ellipse.
  for (const place of osmSources.filter((source) => source.category === 'place')) {
    const containing = bestContainingFootprint(place, footprints)
    if (containing) {
      containing.suppressedPlaces.push(place)
      continue
    }
    footprints.push({
      source: placeAsFootprint(place, profile),
      origin: 'osm-place',
      built: [],
      roads: [],
      suppressedPlaces: [],
    })
  }

  const uncoveredBuilt: LightSource[] = []
  const uncoveredRoads: LightSource[] = []
  for (const source of osmSources) {
    if (source.category === 'place') continue
    const containing = bestContainingFootprint(source, footprints)
    if (containing) {
      if (source.category === 'built') containing.built.push(source)
      else containing.roads.push(source)
    } else if (source.category === 'built') {
      uncoveredBuilt.push(source)
    } else {
      uncoveredRoads.push(source)
    }
  }

  const output: EmissionSource[] = []
  const footprintDiagnostics: OsmFootprintFusionDiagnostic[] = []
  const conservedInputSpectralFlux = new Float64Array(SPECTRAL_BAND_COUNT)
  const weightOnlyRoadIds = new Set<string>()
  const suppressedCoveredIds = new Set<string>()

  for (const footprint of footprints) {
    const footprintSpectrum = copySpectralFlux(
      footprint.source.spectralFlux,
      `${footprint.source.id} spectral flux`,
    )
    addScaledSpectrum(conservedInputSpectralFlux, footprintSpectrum)
    const footprintTotal = spectralTotal(footprintSpectrum)
    const footprintAreaKm2 = Math.PI * footprint.source.semiMajorKm * footprint.source.semiMinorKm
    const detailedAreaKm2 = footprint.built.reduce((sum, source) => sum + sourceAreaKm2(source), 0)
    const refinedFraction = footprint.built.length
      ? Math.min(maxRefinedFraction, Math.max(0, detailedAreaKm2 / Math.max(1e-9, footprintAreaKm2)))
      : 0
    const weights = footprint.built.map((built) => allocationWeight(
      built,
      footprint.roads,
      roadWeightStrength,
      maxRoadWeightBoost,
      roadInfluenceDistanceKm,
    ))
    const weightTotal = weights.reduce((sum, weight) => sum + weight.total, 0)
    const allocations: OsmAllocationDiagnostic[] = []

    footprint.suppressedPlaces.forEach((source) => suppressedCoveredIds.add(source.id))
    footprint.built.forEach((source) => suppressedCoveredIds.add(source.id))
    footprint.roads.forEach((source) => {
      suppressedCoveredIds.add(source.id)
      weightOnlyRoadIds.add(source.id)
    })

    if (refinedFraction > 0 && weightTotal > 0) {
      footprint.built.forEach((built, index) => {
        const allocationFraction = weights[index].total / weightTotal
        const allocatedSpectrum = scaledSpectrum(
          footprintSpectrum,
          refinedFraction * allocationFraction,
        )
        output.push(convertLightSourceGeometry(built, {
          id: `refined-${footprint.source.id}-${built.id}`,
          component: 'settlement-refined',
          coverageId: footprint.source.coverageId,
          evidence: footprint.source.evidence,
          precedence: footprint.source.precedence,
          spectralFlux: allocatedSpectrum,
          provenance: combinedProvenance(footprint.source.provenance, built.provenance),
          roadWidthKm: orphanRoadWidthKm,
        }))
        allocations.push({
          osmSourceId: built.id,
          allocationWeight: weights[index].total,
          fractionOfRefinedFlux: allocationFraction,
          roadWeightBoost: weights[index].roadBoost,
        })
      })
    }

    const residualFraction = 1 - refinedFraction
    if (residualFraction > 0) {
      output.push({
        ...cloneEllipse(footprint.source),
        id: refinedFraction > 0 ? `${footprint.source.id}-residual` : footprint.source.id,
        component: refinedFraction > 0 ? 'settlement-residual' : footprint.source.component,
        spectralFlux: scaledSpectrum(footprintSpectrum, residualFraction),
      })
    }
    footprintDiagnostics.push({
      footprintId: footprint.source.id,
      footprintName: footprint.source.name,
      origin: footprint.origin,
      coverageId: footprint.source.coverageId,
      totalFlux: footprintTotal,
      refinedFraction,
      refinedFlux: footprintTotal * refinedFraction,
      residualFlux: footprintTotal * residualFraction,
      builtSourceIds: footprint.built.map((source) => source.id),
      roadWeightSourceIds: footprint.roads.map((source) => source.id),
      suppressedPlaceSourceIds: footprint.suppressedPlaces.map((source) => source.id),
      allocations,
    })
  }

  // Uncovered built features retain the sum of their linear proxy flux. Nearby
  // roads change only the relative allocation across those geometries.
  const nearbyUncoveredRoads = uncoveredRoads.filter((road) =>
    uncoveredBuilt.some((built) => featureDistanceKm(road, built) <= roadInfluenceDistanceKm))
  nearbyUncoveredRoads.forEach((source) => weightOnlyRoadIds.add(source.id))
  const uncoveredBuiltFlux = uncoveredBuilt.reduce((sum, source) => sum + Math.max(0, source.flux), 0)
  const uncoveredWeights = uncoveredBuilt.map((built) => allocationWeight(
    built,
    nearbyUncoveredRoads,
    roadWeightStrength,
    maxRoadWeightBoost,
    roadInfluenceDistanceKm,
  ))
  const uncoveredWeightTotal = uncoveredWeights.reduce((sum, weight) => sum + weight.total, 0)
  const uncoveredBuiltSpectrum = normalizedSpectralFlux(uncoveredBuiltFlux, profile)
  addScaledSpectrum(conservedInputSpectralFlux, uncoveredBuiltSpectrum)
  if (uncoveredBuiltFlux > 0 && uncoveredWeightTotal > 0) {
    uncoveredBuilt.forEach((source, index) => {
      output.push(convertLightSourceGeometry(source, {
        id: `uncovered-${source.id}`,
        component: 'osm-built-proxy',
        coverageId: `osm:${source.id}`,
        evidence: 'built-population-proxy',
        spectralFlux: scaledSpectrum(uncoveredBuiltSpectrum, uncoveredWeights[index].total / uncoveredWeightTotal),
        provenance: source.provenance,
        roadWidthKm: orphanRoadWidthKm,
      }))
    })
  }

  const orphanRoads = uncoveredRoads.filter((source) => !weightOnlyRoadIds.has(source.id))
  for (const road of orphanRoads) {
    const spectrum = normalizedSpectralFlux(Math.max(0, road.flux), profile)
    addScaledSpectrum(conservedInputSpectralFlux, spectrum)
    output.push(convertLightSourceGeometry(road, {
      id: `uncovered-${road.id}`,
      component: 'osm-road-proxy',
      coverageId: `osm:${road.id}`,
      evidence: 'road-proxy',
      spectralFlux: spectrum,
      provenance: road.provenance,
      roadWidthKm: orphanRoadWidthKm,
    }))
  }

  const outputSpectralFlux = new Float64Array(SPECTRAL_BAND_COUNT)
  output.forEach((source) => addScaledSpectrum(outputSpectralFlux, source.spectralFlux))
  const residual = Float64Array.from(conservedInputSpectralFlux, (value, band) =>
    value - outputSpectralFlux[band])
  let maxRelativeConservationError = 0
  for (let band = 0; band < SPECTRAL_BAND_COUNT; band += 1) {
    maxRelativeConservationError = Math.max(
      maxRelativeConservationError,
      Math.abs(residual[band]) / Math.max(1e-12, conservedInputSpectralFlux[band]),
    )
  }

  return {
    sources: output,
    diagnostics: {
      spectralBandCount: SPECTRAL_BAND_COUNT,
      rawOsmSpectralFlux: spectrumToArray(rawOsmSpectralFlux),
      conservedInputSpectralFlux: spectrumToArray(conservedInputSpectralFlux),
      outputSpectralFlux: spectrumToArray(outputSpectralFlux),
      residualSpectralFlux: spectrumToArray(residual),
      maxRelativeConservationError,
      footprints: footprintDiagnostics,
      weightOnlyRoadSourceIds: [...weightOnlyRoadIds],
      orphanProxySourceIds: [
        ...uncoveredBuilt.map((source) => source.id),
        ...orphanRoads.map((source) => source.id),
      ],
      suppressedCoveredSourceIds: [...suppressedCoveredIds],
    },
  }
}

type ConversionOptions = {
  id: string
  component: string
  coverageId: string
  evidence: EmissionEvidence
  precedence?: number
  spectralFlux: SpectralFluxInput
  provenance?: string
  roadWidthKm: number
}

function convertLightSourceGeometry(source: LightSource, options: ConversionOptions): EmissionSource {
  const base = {
    id: options.id,
    name: source.name,
    component: options.component,
    coverageId: options.coverageId,
    evidence: options.evidence,
    precedence: options.precedence,
    spectralFlux: copySpectralFlux(options.spectralFlux),
    provenance: options.provenance,
  }
  if (source.geometry?.type === 'polygon' && source.geometry.points.length >= 3) {
    return { ...base, geometry: 'polygon', vertices: source.geometry.points.map(copyPoint) }
  }
  if (source.geometry?.type === 'line' && source.geometry.points.length >= 2) {
    return {
      ...base,
      geometry: 'road',
      points: source.geometry.points.map(copyPoint),
      widthKm: options.roadWidthKm,
    }
  }
  return unresolvedEllipse(source, base)
}

function placeAsFootprint(source: LightSource, profile: SpectralFluxInput): EllipseEmissionSource {
  const spectrum = normalizedSpectralFlux(Math.max(0, source.flux), profile)
  return unresolvedEllipse(source, {
    id: `osm-place-${source.id}`,
    name: source.name,
    component: 'osm-place-proxy',
    coverageId: `osm-place:${source.id}`,
    evidence: 'built-population-proxy',
    spectralFlux: spectrum,
    provenance: source.provenance,
  })
}

function unresolvedEllipse(
  source: LightSource,
  base: Omit<EllipseEmissionSource, 'geometry' | 'center' | 'semiMajorKm' | 'semiMinorKm' | 'rotationDeg'>,
): EllipseEmissionSource {
  const equivalentRadius = Math.max(0.08, Math.sqrt(Math.max(0.02, source.areaKm2 ?? 0.02) / Math.PI))
  return {
    ...base,
    geometry: 'ellipse',
    center: { lat: source.lat, lon: source.lon },
    semiMajorKm: equivalentRadius * 1.25,
    semiMinorKm: equivalentRadius / 1.25,
    rotationDeg: 0,
  }
}

function bestContainingFootprint(source: LightSource, footprints: readonly MutableFootprint[]) {
  let best: MutableFootprint | undefined
  let bestScore = Number.POSITIVE_INFINITY
  for (const footprint of footprints) {
    const score = featureEllipseScore(source, footprint.source)
    if (score <= 1 && score < bestScore) {
      best = footprint
      bestScore = score
    }
  }
  return best
}

function featureEllipseScore(source: LightSource, ellipse: EllipseEmissionSource) {
  return Math.min(...featurePoints(source).map((point) => ellipseScore(point, ellipse)))
}

function ellipseScore(point: GeoPoint, ellipse: EllipseEmissionSource) {
  const local = projectToLocalKm(ellipse.center, point)
  const rotation = ellipse.rotationDeg * Math.PI / 180
  const major = local.x * Math.sin(rotation) + local.y * Math.cos(rotation)
  const minor = local.x * Math.cos(rotation) - local.y * Math.sin(rotation)
  return Math.hypot(major / ellipse.semiMajorKm, minor / ellipse.semiMinorKm)
}

function featurePoints(source: LightSource) {
  const points = source.geometry?.points ?? []
  if (points.length < 2) return [{ lat: source.lat, lon: source.lon }]
  const withMidpoints: GeoPoint[] = [{ lat: source.lat, lon: source.lon }, ...points.map(copyPoint)]
  for (let index = 1; index < points.length; index += 1) {
    withMidpoints.push({
      lat: (points[index - 1].lat + points[index].lat) / 2,
      lon: (points[index - 1].lon + points[index].lon) / 2,
    })
  }
  return withMidpoints
}

function featureDistanceKm(a: LightSource, b: LightSource) {
  let minimum = Number.POSITIVE_INFINITY
  for (const pointA of featurePoints(a)) {
    for (const pointB of featurePoints(b)) minimum = Math.min(minimum, distanceKm(pointA, pointB))
  }
  return minimum
}

function allocationWeight(
  built: LightSource,
  roads: readonly LightSource[],
  roadWeightStrength: number,
  maxRoadWeightBoost: number,
  roadInfluenceDistanceKm: number,
) {
  const base = Math.max(1e-9, built.flux || sourceAreaKm2(built))
  const roadInfluence = roads.reduce((sum, road) => {
    const distance = featureDistanceKm(built, road)
    const length = Math.max(0, road.lengthKm ?? road.flux)
    return sum + length * Math.exp(-distance / roadInfluenceDistanceKm)
  }, 0)
  const roadBoost = Math.min(
    maxRoadWeightBoost,
    roadWeightStrength * roadInfluence / Math.max(1, sourceAreaKm2(built)),
  )
  return { total: base * (1 + roadBoost), roadBoost }
}

function sourceAreaKm2(source: LightSource) {
  return Math.max(0.001, source.areaKm2 ?? Math.max(0, source.flux) / 5.4)
}

function scaledSpectrum(spectrum: SpectralFluxInput, scale: number) {
  return Float64Array.from(spectrum, (value) => value * scale)
}

function cloneEllipse(source: EllipseEmissionSource): EllipseEmissionSource {
  return {
    ...source,
    center: { ...source.center },
    spectralFlux: copySpectralFlux(source.spectralFlux),
  }
}

function copyPoint(point: GeoPoint) {
  return { lat: point.lat, lon: point.lon }
}

function combinedProvenance(...values: Array<string | undefined>) {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value)))]
  return unique.join('; ') || undefined
}

function boundedOption(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
) {
  const resolved = value ?? fallback
  if (!Number.isFinite(resolved) || resolved < minimum || resolved > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`)
  }
  return resolved
}

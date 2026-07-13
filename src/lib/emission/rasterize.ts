import { bearingDegrees, destinationPoint, distanceKm, localOffsetPoint, projectToLocalKm } from './geo'
import type { EmissionSource, GeoPoint } from './types'

export type WeightedGeoSample = {
  point: GeoPoint
  weight: number
}

export type RasterizeOptions = {
  sampleSpacingKm: number
  maxSamplesPerSource: number
}

export function quadratureSamples(source: EmissionSource, options: RasterizeOptions) {
  switch (source.geometry) {
    case 'ellipse':
      return ellipseSamples(source, options)
    case 'polygon':
      return polygonSamples(source, options)
    case 'road':
      return roadSamples(source, options)
  }
}

function ellipseSamples(
  source: Extract<EmissionSource, { geometry: 'ellipse' }>,
  options: RasterizeOptions,
) {
  if (!(source.semiMajorKm > 0) || !(source.semiMinorKm > 0)) {
    throw new Error(`Ellipse ${source.id} must have positive radii`)
  }
  const areaKm2 = Math.PI * source.semiMajorKm * source.semiMinorKm
  const requested = Math.ceil(areaKm2 / Math.max(0.01, options.sampleSpacingKm ** 2))
  const sampleCount = clamp(requested, Math.min(64, options.maxSamplesPerSource), options.maxSamplesPerSource)
  const rotation = source.rotationDeg * Math.PI / 180
  const samples: WeightedGeoSample[] = []

  // Hammersley points are uniform in ellipse area and deterministic.
  for (let index = 0; index < sampleCount; index += 1) {
    const radius = Math.sqrt((index + 0.5) / sampleCount)
    const angle = 2 * Math.PI * radicalInverseBase2(index)
    const major = source.semiMajorKm * radius * Math.cos(angle)
    const minor = source.semiMinorKm * radius * Math.sin(angle)
    const eastKm = major * Math.sin(rotation) + minor * Math.cos(rotation)
    const northKm = major * Math.cos(rotation) - minor * Math.sin(rotation)
    samples.push({ point: localOffsetPoint(source.center, eastKm, northKm), weight: 1 })
  }
  return samples
}

function polygonSamples(
  source: Extract<EmissionSource, { geometry: 'polygon' }>,
  options: RasterizeOptions,
) {
  const vertices = removeClosingVertex(source.vertices)
  if (vertices.length < 3) throw new Error(`Polygon ${source.id} must have at least three vertices`)
  const origin = {
    lat: vertices.reduce((sum, point) => sum + point.lat, 0) / vertices.length,
    lon: vertices.reduce((sum, point) => sum + point.lon, 0) / vertices.length,
  }
  const polygon = vertices.map((point) => projectToLocalKm(origin, point))
  const minX = Math.min(...polygon.map((point) => point.x))
  const maxX = Math.max(...polygon.map((point) => point.x))
  const minY = Math.min(...polygon.map((point) => point.y))
  const maxY = Math.max(...polygon.map((point) => point.y))
  let spacing = Math.max(0.05, options.sampleSpacingKm)
  const boundingArea = Math.max(spacing ** 2, (maxX - minX) * (maxY - minY))
  spacing = Math.max(spacing, Math.sqrt(boundingArea / options.maxSamplesPerSource))
  const columns = Math.max(1, Math.ceil((maxX - minX) / spacing))
  const rows = Math.max(1, Math.ceil((maxY - minY) / spacing))
  const stepX = (maxX - minX) / columns || spacing
  const stepY = (maxY - minY) / rows || spacing
  const samples: WeightedGeoSample[] = []

  for (let row = 0; row < rows; row += 1) {
    const y = minY + (row + 0.5) * stepY
    for (let column = 0; column < columns; column += 1) {
      const x = minX + (column + 0.5) * stepX
      if (pointInPolygon({ x, y }, polygon)) {
        samples.push({ point: localOffsetPoint(origin, x, y), weight: stepX * stepY })
      }
    }
  }

  if (samples.length) return samples

  // A sub-resolution polygon still spans its vertices and edges; it is never collapsed to its centroid.
  return vertices.flatMap((point, index) => {
    const next = vertices[(index + 1) % vertices.length]
    return [
      { point, weight: 0.5 },
      {
        point: destinationPoint(point, bearingDegrees(point, next), distanceKm(point, next) / 2),
        weight: 0.5,
      },
    ]
  })
}

function roadSamples(
  source: Extract<EmissionSource, { geometry: 'road' }>,
  options: RasterizeOptions,
) {
  if (source.points.length < 2) throw new Error(`Road ${source.id} must have at least two points`)
  if (source.widthKm < 0) throw new Error(`Road ${source.id} cannot have a negative width`)
  const segments = source.points.slice(1).map((end, index) => {
    const start = source.points[index]
    return {
      start,
      end,
      lengthKm: distanceKm(start, end),
      bearingDeg: bearingDegrees(start, end),
    }
  }).filter((segment) => segment.lengthKm > 0)
  const totalLengthKm = segments.reduce((sum, segment) => sum + segment.lengthKm, 0)
  if (totalLengthKm <= 0) throw new Error(`Road ${source.id} has zero length`)
  const crossSection = source.widthKm > 0
    ? [
        { fraction: -0.5, weight: 1 / 6 },
        { fraction: 0, weight: 4 / 6 },
        { fraction: 0.5, weight: 1 / 6 },
      ]
    : [{ fraction: 0, weight: 1 }]
  const maximumLongitudinalSamples = Math.max(segments.length, Math.floor(
    options.maxSamplesPerSource / crossSection.length,
  ))
  const desiredLongitudinalSamples = Math.ceil(totalLengthKm / Math.max(0.05, options.sampleSpacingKm))
  const longitudinalSamples = Math.min(maximumLongitudinalSamples, desiredLongitudinalSamples)
  const samples: WeightedGeoSample[] = []

  for (const segment of segments) {
    const segmentSamples = Math.max(1, Math.round(
      longitudinalSamples * segment.lengthKm / totalLengthKm,
    ))
    for (let index = 0; index < segmentSamples; index += 1) {
      const alongKm = segment.lengthKm * (index + 0.5) / segmentSamples
      const center = destinationPoint(segment.start, segment.bearingDeg, alongKm)
      for (const cross of crossSection) {
        const point = cross.fraction === 0
          ? center
          : destinationPoint(
              center,
              segment.bearingDeg + (cross.fraction > 0 ? 90 : -90),
              Math.abs(cross.fraction) * source.widthKm,
            )
        samples.push({
          point,
          weight: segment.lengthKm / segmentSamples * cross.weight,
        })
      }
    }
  }
  return samples
}

function removeClosingVertex(vertices: readonly GeoPoint[]) {
  if (vertices.length < 2) return [...vertices]
  const first = vertices[0]
  const last = vertices[vertices.length - 1]
  return first.lat === last.lat && first.lon === last.lon ? vertices.slice(0, -1) : [...vertices]
}

function pointInPolygon(
  point: { x: number; y: number },
  polygon: readonly { x: number; y: number }[],
) {
  let inside = false
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current]
    const b = polygon[previous]
    const crosses = (a.y > point.y) !== (b.y > point.y) &&
      point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

function radicalInverseBase2(value: number) {
  let bits = value >>> 0
  bits = ((bits << 16) | (bits >>> 16)) >>> 0
  bits = (((bits & 0x55555555) << 1) | ((bits & 0xAAAAAAAA) >>> 1)) >>> 0
  bits = (((bits & 0x33333333) << 2) | ((bits & 0xCCCCCCCC) >>> 2)) >>> 0
  bits = (((bits & 0x0F0F0F0F) << 4) | ((bits & 0xF0F0F0F0) >>> 4)) >>> 0
  bits = (((bits & 0x00FF00FF) << 8) | ((bits & 0xFF00FF00) >>> 8)) >>> 0
  return bits * 2.3283064365386963e-10
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

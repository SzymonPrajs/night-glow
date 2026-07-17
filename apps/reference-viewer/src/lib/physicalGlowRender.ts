import type { PhysicalGlowResult } from './physicalGlowProtocol'

type RenderableGlowField = Pick<
  PhysicalGlowResult,
  'azimuthCount' | 'elevationDeg' | 'rgbRadiance'
>

export type PhysicalGlowRenderGrid = {
  elevationDeg: Float32Array
  rgbRadiance: Float32Array
}

const RENDER_ELEVATION_SEGMENTS = [
  { maximumDeg: 10, stepDeg: 0.25 },
  { maximumDeg: 30, stepDeg: 0.5 },
  { maximumDeg: 60, stepDeg: 1 },
  { maximumDeg: 90, stepDeg: 2 },
] as const

/**
 * Densifies the worker's irregular elevation samples before triangulation.
 * The worker field is linear between solved elevations; sampling that same
 * surface more finely prevents large sky triangles from exposing their fixed
 * diagonal while preserving every physically solved value exactly.
 */
export function buildPhysicalGlowRenderGrid(field: RenderableGlowField): PhysicalGlowRenderGrid {
  const elevationDeg = buildRenderElevations(field.elevationDeg)
  const rgbRadiance = new Float32Array(elevationDeg.length * field.azimuthCount * 3)
  let lower = 0

  for (let targetLevel = 0; targetLevel < elevationDeg.length; targetLevel += 1) {
    const targetElevation = elevationDeg[targetLevel]
    while (
      lower + 1 < field.elevationDeg.length - 1 &&
      field.elevationDeg[lower + 1] < targetElevation
    ) lower += 1

    const upper = Math.min(lower + 1, field.elevationDeg.length - 1)
    const span = field.elevationDeg[upper] - field.elevationDeg[lower]
    const mix = span > 0 ? (targetElevation - field.elevationDeg[lower]) / span : 0

    for (let azimuth = 0; azimuth < field.azimuthCount; azimuth += 1) {
      const sourceLower = (lower * field.azimuthCount + azimuth) * 3
      const sourceUpper = (upper * field.azimuthCount + azimuth) * 3
      const destination = (targetLevel * field.azimuthCount + azimuth) * 3
      for (let channel = 0; channel < 3; channel += 1) {
        const lowerValue = finiteNonNegative(field.rgbRadiance[sourceLower + channel])
        const upperValue = finiteNonNegative(field.rgbRadiance[sourceUpper + channel])
        rgbRadiance[destination + channel] = lowerValue + (upperValue - lowerValue) * mix
      }
    }
  }

  return { elevationDeg, rgbRadiance }
}

function buildRenderElevations(sourceElevations: Float32Array) {
  if (!sourceElevations.length) return new Float32Array()
  const minimum = Math.max(0, sourceElevations[0])
  const maximum = Math.min(90, sourceElevations[sourceElevations.length - 1])
  const values = new Set<number>()
  for (const elevation of sourceElevations) values.add(roundElevation(elevation))
  values.add(roundElevation(minimum))

  let elevation = minimum
  for (const segment of RENDER_ELEVATION_SEGMENTS) {
    const segmentMaximum = Math.min(maximum, segment.maximumDeg)
    while (elevation + segment.stepDeg < segmentMaximum + 1e-6) {
      elevation = Math.min(segmentMaximum, elevation + segment.stepDeg)
      values.add(roundElevation(elevation))
    }
    if (segmentMaximum > elevation) {
      elevation = segmentMaximum
      values.add(roundElevation(elevation))
    }
    if (elevation >= maximum) break
  }
  values.add(roundElevation(maximum))

  return Float32Array.from(
    [...values].filter((value) => value >= minimum && value <= maximum).sort((a, b) => a - b),
  )
}

function roundElevation(value: number) {
  return Math.round(value * 1000) / 1000
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

import type { PolarRing } from './types'

export const SECTOR_COUNT = 720
export const SECTOR_WIDTH_DEG = 360 / SECTOR_COUNT
export const DETAILED_MAX_DISTANCE_KM = 300
export const MAX_DISTANCE_KM = 1000

type RingSegment = readonly [startKm: number, endKm: number, widthKm: number]

const DETAILED_SEGMENTS: readonly RingSegment[] = [
  [0, 1, 0.25],
  [1, 5, 0.5],
  [5, 20, 1],
  [20, 50, 2],
  [50, 100, 5],
  [100, 200, 10],
  [200, 300, 20],
]

const TAIL_SEGMENTS: readonly RingSegment[] = [
  [300, 1000, 50],
]

function makeSegmentRings(segments: readonly RingSegment[], resolution: PolarRing['resolution']) {
  const rings: Omit<PolarRing, 'index'>[] = []
  for (const [startKm, endKm, widthKm] of segments) {
    const count = Math.round((endKm - startKm) / widthKm)
    if (Math.abs(startKm + count * widthKm - endKm) > 1e-9) {
      throw new Error(`Ring segment ${startKm}-${endKm} km is not divisible by ${widthKm} km`)
    }
    for (let offset = 0; offset < count; offset += 1) {
      const innerKm = startKm + offset * widthKm
      const outerKm = innerKm + widthKm
      rings.push({
        innerKm,
        outerKm,
        midpointKm: (innerKm + outerKm) / 2,
        widthKm,
        resolution,
      })
    }
  }
  return rings
}

const unindexedRings = [
  ...makeSegmentRings(DETAILED_SEGMENTS, 'detailed'),
  ...makeSegmentRings(TAIL_SEGMENTS, 'tail'),
]

export const POLAR_RINGS: readonly PolarRing[] = unindexedRings.map((ring, index) => ({ ...ring, index }))
export const DETAILED_RING_COUNT = POLAR_RINGS.filter((ring) => ring.resolution === 'detailed').length
export const TAIL_RING_COUNT = POLAR_RINGS.length - DETAILED_RING_COUNT
export const TOTAL_RING_COUNT = POLAR_RINGS.length

if (DETAILED_RING_COUNT !== 67) {
  throw new Error(`Expected 67 detailed rings, created ${DETAILED_RING_COUNT}`)
}

export function normalizeBearing(bearingDeg: number) {
  return ((bearingDeg % 360) + 360) % 360
}

export function sectorIndexForBearing(bearingDeg: number) {
  return Math.min(SECTOR_COUNT - 1, Math.floor(normalizeBearing(bearingDeg) / SECTOR_WIDTH_DEG))
}

export function ringIndexForDistance(distanceKm: number) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm >= MAX_DISTANCE_KM) return -1
  let low = 0
  let high = POLAR_RINGS.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const ring = POLAR_RINGS[middle]
    if (distanceKm < ring.innerKm) high = middle - 1
    else if (distanceKm >= ring.outerKm) low = middle + 1
    else return middle
  }
  return -1
}

import { compileDiagnostics } from './diagnostics'
import { bearingDegrees, distanceKm } from './geo'
import { POLAR_RINGS, ringIndexForDistance, SECTOR_COUNT, SECTOR_WIDTH_DEG, sectorIndexForBearing } from './rings'
import { quadratureSamples } from './rasterize'
import { addScaledSpectrum, copySpectralFlux, spectralTotal, spectrumToArray } from './spectrum'
import {
  EVIDENCE_PRECEDENCE,
  SPECTRAL_BAND_COUNT,
  SPECTRAL_BANDS,
  type BuildEmissionGridOptions,
  type EmissionGrid,
  type EmissionSource,
  type EmissionSourceReport,
} from './types'

const DEFAULT_SAMPLE_SPACING_KM = 0.5
const DEFAULT_MAX_SAMPLES = 4096

export function buildEmissionGrid(options: BuildEmissionGridOptions): EmissionGrid {
  validateObserver(options.observer)
  const sampleSpacingKm = options.sampleSpacingKm ?? DEFAULT_SAMPLE_SPACING_KM
  const maxSamplesPerSource = options.maxSamplesPerSource ?? DEFAULT_MAX_SAMPLES
  if (!(sampleSpacingKm > 0)) throw new Error('sampleSpacingKm must be positive')
  if (!Number.isInteger(maxSamplesPerSource) || maxSamplesPerSource < 16) {
    throw new Error('maxSamplesPerSource must be an integer of at least 16')
  }

  const values = new Float64Array(POLAR_RINGS.length * SECTOR_COUNT * SPECTRAL_BAND_COUNT)
  const componentRingValues = new Map<string, Float64Array>()
  const candidateSpectralFlux = new Float64Array(SPECTRAL_BAND_COUNT)
  const supersededSpectralFlux = new Float64Array(SPECTRAL_BAND_COUNT)
  const acceptedSpectralFlux = new Float64Array(SPECTRAL_BAND_COUNT)
  const depositedSpectralFlux = new Float64Array(SPECTRAL_BAND_COUNT)
  const outsideDomainSpectralFlux = new Float64Array(SPECTRAL_BAND_COUNT)
  const reports: EmissionSourceReport[] = []
  const { selected, superseded } = resolveEvidence(options.sources)

  for (const rejected of superseded) {
    const flux = copySpectralFlux(rejected.source.spectralFlux, `${rejected.source.id} spectral flux`)
    addScaledSpectrum(candidateSpectralFlux, flux)
    addScaledSpectrum(supersededSpectralFlux, flux)
    reports.push({
      id: rejected.source.id,
      name: rejected.source.name,
      component: rejected.source.component,
      coverageId: rejected.source.coverageId,
      status: 'superseded',
      selectedEvidence: rejected.source.evidence,
      supersededBy: rejected.supersededBy,
      sampleCount: 0,
      depositedFraction: 0,
      inputSpectralFlux: spectrumToArray(flux),
      depositedSpectralFlux: zeroSpectrumArray(),
      outsideDomainSpectralFlux: zeroSpectrumArray(),
    })
  }

  for (const source of selected) {
    const flux = copySpectralFlux(source.spectralFlux, `${source.id} spectral flux`)
    addScaledSpectrum(candidateSpectralFlux, flux)
    addScaledSpectrum(acceptedSpectralFlux, flux)
    const sourceDeposited = new Float64Array(SPECTRAL_BAND_COUNT)
    const sourceOutside = new Float64Array(SPECTRAL_BAND_COUNT)
    const samples = quadratureSamples(source, { sampleSpacingKm, maxSamplesPerSource })
    const totalWeight = samples.reduce((sum, sample) => sum + sample.weight, 0)
    if (!(totalWeight > 0)) throw new Error(`Source ${source.id} produced no positive quadrature weight`)
    let depositedWeight = 0

    for (const sample of samples) {
      if (!(sample.weight > 0) || !Number.isFinite(sample.weight)) {
        throw new Error(`Source ${source.id} produced an invalid quadrature weight`)
      }
      const fraction = sample.weight / totalWeight
      const distance = distanceKm(options.observer, sample.point)
      const ringIndex = ringIndexForDistance(distance)
      if (ringIndex < 0) {
        addScaledSpectrum(sourceOutside, flux, fraction)
        addScaledSpectrum(outsideDomainSpectralFlux, flux, fraction)
        continue
      }

      depositedWeight += sample.weight
      const sectorIndex = sectorIndexForBearing(bearingDegrees(options.observer, sample.point))
      const valueStart = cellValueIndex(ringIndex, sectorIndex, 0)
      const componentValues = getComponentValues(componentRingValues, source.component)
      const componentStart = ringIndex * SPECTRAL_BAND_COUNT
      for (let band = 0; band < SPECTRAL_BAND_COUNT; band += 1) {
        const contribution = flux[band] * fraction
        values[valueStart + band] += contribution
        componentValues[componentStart + band] += contribution
        sourceDeposited[band] += contribution
        depositedSpectralFlux[band] += contribution
      }
    }

    const depositedFraction = depositedWeight / totalWeight
    const status = depositedFraction <= 0
      ? 'outside-domain'
      : depositedFraction >= 1 - 1e-12
        ? 'deposited'
        : 'partially-outside-domain'
    reports.push({
      id: source.id,
      name: source.name,
      component: source.component,
      coverageId: source.coverageId,
      status,
      selectedEvidence: source.evidence,
      sampleCount: samples.length,
      depositedFraction,
      inputSpectralFlux: spectrumToArray(flux),
      depositedSpectralFlux: spectrumToArray(sourceDeposited),
      outsideDomainSpectralFlux: spectrumToArray(sourceOutside),
    })
  }

  const hasDirectionalFlux = spectralTotal(depositedSpectralFlux) > 0
  const isotropicFallback = hasDirectionalFlux
    ? undefined
    : {
        spectralFlux: options.fallback
          ? copySpectralFlux(options.fallback.spectralFlux, 'fallback spectral flux')
          : new Float64Array(SPECTRAL_BAND_COUNT),
        reason: options.fallback?.reason ?? 'No directional emission data were available; no bearing was invented.',
      }
  const diagnostics = compileDiagnostics({
    values,
    sectorCount: SECTOR_COUNT,
    rings: POLAR_RINGS,
    componentRingValues,
    candidateSpectralFlux,
    supersededSpectralFlux,
    acceptedSpectralFlux,
    depositedSpectralFlux,
    outsideDomainSpectralFlux,
    sources: reports,
  })

  return {
    mode: hasDirectionalFlux ? 'directional' : 'isotropic-only',
    observer: { ...options.observer },
    sectorCount: SECTOR_COUNT,
    sectorWidthDeg: SECTOR_WIDTH_DEG,
    rings: POLAR_RINGS,
    bands: SPECTRAL_BANDS,
    fluxUnit: options.fluxUnit ?? 'relative-radiant-flux',
    values,
    componentRingValues,
    isotropicFallback,
    diagnostics,
  }
}

export function cellValueIndex(ringIndex: number, sectorIndex: number, bandIndex: number) {
  if (ringIndex < 0 || ringIndex >= POLAR_RINGS.length) throw new RangeError('ringIndex is outside the grid')
  if (sectorIndex < 0 || sectorIndex >= SECTOR_COUNT) throw new RangeError('sectorIndex is outside the grid')
  if (bandIndex < 0 || bandIndex >= SPECTRAL_BAND_COUNT) throw new RangeError('bandIndex is outside the grid')
  return (ringIndex * SECTOR_COUNT + sectorIndex) * SPECTRAL_BAND_COUNT + bandIndex
}

export function getCellSpectrum(grid: EmissionGrid, ringIndex: number, sectorIndex: number) {
  const start = cellValueIndex(ringIndex, sectorIndex, 0)
  return grid.values.slice(start, start + SPECTRAL_BAND_COUNT)
}

export function cumulativeFluxThroughDistance(grid: EmissionGrid, distanceKm: number) {
  if (distanceKm <= 0) return zeroSpectrumArray()
  const completedRings = grid.diagnostics.rings.filter((entry) => entry.ring.outerKm <= distanceKm)
  if (!completedRings.length) return zeroSpectrumArray()
  return [...completedRings[completedRings.length - 1].cumulativeSpectralFlux]
}

function resolveEvidence(sources: readonly EmissionSource[]) {
  const identifiers = new Set<string>()
  const groups = new Map<string, EmissionSource[]>()
  for (const source of sources) {
    if (!source.id || identifiers.has(source.id)) throw new Error(`Emission source id must be unique: ${source.id}`)
    if (!source.coverageId) throw new Error(`Emission source ${source.id} requires a coverageId`)
    identifiers.add(source.id)
    const group = groups.get(source.coverageId) ?? []
    group.push(source)
    groups.set(source.coverageId, group)
  }

  const selected: EmissionSource[] = []
  const superseded: Array<{ source: EmissionSource; supersededBy: string[] }> = []
  for (const group of groups.values()) {
    const highest = Math.max(...group.map(sourcePriority))
    const winners = group.filter((source) => sourcePriority(source) === highest)
    selected.push(...winners)
    for (const source of group) {
      if (!winners.includes(source)) superseded.push({ source, supersededBy: winners.map((winner) => winner.id) })
    }
  }
  return { selected, superseded }
}

function sourcePriority(source: EmissionSource) {
  return source.precedence ?? EVIDENCE_PRECEDENCE[source.evidence]
}

function getComponentValues(componentValues: Map<string, Float64Array>, component: string) {
  const existing = componentValues.get(component)
  if (existing) return existing
  const values = new Float64Array(POLAR_RINGS.length * SPECTRAL_BAND_COUNT)
  componentValues.set(component, values)
  return values
}

function validateObserver(observer: { lat: number; lon: number }) {
  if (!Number.isFinite(observer.lat) || observer.lat < -90 || observer.lat > 90) {
    throw new Error('Observer latitude must be between -90 and 90 degrees')
  }
  if (!Number.isFinite(observer.lon) || observer.lon < -180 || observer.lon > 180) {
    throw new Error('Observer longitude must be between -180 and 180 degrees')
  }
}

function zeroSpectrumArray() {
  return Array.from({ length: SPECTRAL_BAND_COUNT }, () => 0)
}

import { spectralTotal, spectrumToArray } from './spectrum'
import { SPECTRAL_BAND_COUNT, type EmissionDiagnostics, type EmissionSourceReport, type PolarRing } from './types'

export type DiagnosticsInput = {
  values: Float64Array
  sectorCount: number
  rings: readonly PolarRing[]
  componentRingValues: ReadonlyMap<string, Float64Array>
  candidateSpectralFlux: Float64Array
  supersededSpectralFlux: Float64Array
  acceptedSpectralFlux: Float64Array
  depositedSpectralFlux: Float64Array
  outsideDomainSpectralFlux: Float64Array
  sources: EmissionSourceReport[]
}

export function compileDiagnostics(input: DiagnosticsInput): EmissionDiagnostics {
  const ringSpectra = input.rings.map((ring) => {
    const spectrum = new Float64Array(SPECTRAL_BAND_COUNT)
    for (let sector = 0; sector < input.sectorCount; sector += 1) {
      const start = (ring.index * input.sectorCount + sector) * SPECTRAL_BAND_COUNT
      for (let band = 0; band < SPECTRAL_BAND_COUNT; band += 1) spectrum[band] += input.values[start + band]
    }
    return spectrum
  })

  const depositedTotal = spectralTotal(input.depositedSpectralFlux)
  const cumulative = new Float64Array(SPECTRAL_BAND_COUNT)
  let cumulativeTotal = 0
  const rings = input.rings.map((ring) => {
    const spectrum = ringSpectra[ring.index]
    const totalFlux = spectralTotal(spectrum)
    for (let band = 0; band < SPECTRAL_BAND_COUNT; band += 1) cumulative[band] += spectrum[band]
    cumulativeTotal += totalFlux
    const componentTotals = Object.fromEntries([...input.componentRingValues].map(([component, values]) => {
      const start = ring.index * SPECTRAL_BAND_COUNT
      let total = 0
      for (let band = 0; band < SPECTRAL_BAND_COUNT; band += 1) total += values[start + band]
      return [component, total]
    }))
    return {
      ring,
      spectralFlux: spectrumToArray(spectrum),
      totalFlux,
      cumulativeSpectralFlux: spectrumToArray(cumulative),
      cumulativeTotalFlux: cumulativeTotal,
      cumulativeFraction: depositedTotal > 0 ? cumulativeTotal / depositedTotal : 0,
      componentTotals,
    }
  })

  const components = [...input.componentRingValues].map(([component, values]) => {
    const spectrum = new Float64Array(SPECTRAL_BAND_COUNT)
    const ringTotals = input.rings.map((ring) => {
      const start = ring.index * SPECTRAL_BAND_COUNT
      let total = 0
      for (let band = 0; band < SPECTRAL_BAND_COUNT; band += 1) {
        const value = values[start + band]
        spectrum[band] += value
        total += value
      }
      return total
    })
    const totalFlux = spectralTotal(spectrum)
    return {
      component,
      spectralFlux: spectrumToArray(spectrum),
      totalFlux,
      fractionOfDeposited: depositedTotal > 0 ? totalFlux / depositedTotal : 0,
      ringTotals,
    }
  }).sort((a, b) => b.totalFlux - a.totalFlux)

  const residual = Float64Array.from(input.acceptedSpectralFlux, (accepted, band) =>
    accepted - input.depositedSpectralFlux[band] - input.outsideDomainSpectralFlux[band])
  let maxRelativeError = 0
  for (let band = 0; band < SPECTRAL_BAND_COUNT; band += 1) {
    maxRelativeError = Math.max(
      maxRelativeError,
      Math.abs(residual[band]) / Math.max(1e-12, input.acceptedSpectralFlux[band]),
    )
  }

  return {
    candidateSpectralFlux: spectrumToArray(input.candidateSpectralFlux),
    supersededSpectralFlux: spectrumToArray(input.supersededSpectralFlux),
    conservation: {
      acceptedSpectralFlux: spectrumToArray(input.acceptedSpectralFlux),
      depositedSpectralFlux: spectrumToArray(input.depositedSpectralFlux),
      outsideDomainSpectralFlux: spectrumToArray(input.outsideDomainSpectralFlux),
      residualSpectralFlux: spectrumToArray(residual),
      maxRelativeError,
    },
    rings,
    components,
    sources: input.sources,
  }
}

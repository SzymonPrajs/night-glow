import { SPECTRAL_BAND_COUNT, type SpectralFluxInput } from './types'

export function copySpectralFlux(input: SpectralFluxInput, label = 'spectral flux') {
  if (input.length !== SPECTRAL_BAND_COUNT) {
    throw new Error(`${label} must contain ${SPECTRAL_BAND_COUNT} bands; received ${input.length}`)
  }
  const result = Float64Array.from(input)
  for (const value of result) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label} values must be finite and non-negative`)
  }
  return result
}

export function normalizedSpectralFlux(totalFlux: number, profile: SpectralFluxInput) {
  if (!Number.isFinite(totalFlux) || totalFlux < 0) throw new Error('Total flux must be finite and non-negative')
  const normalized = copySpectralFlux(profile, 'spectral profile')
  const sum = spectralTotal(normalized)
  if (sum <= 0) {
    if (totalFlux === 0) return normalized
    throw new Error('A non-zero total flux requires a non-zero spectral profile')
  }
  for (let band = 0; band < normalized.length; band += 1) normalized[band] *= totalFlux / sum
  return normalized
}

export function spectralTotal(flux: ArrayLike<number>) {
  let total = 0
  for (let band = 0; band < flux.length; band += 1) total += flux[band]
  return total
}

export function addScaledSpectrum(target: Float64Array, source: ArrayLike<number>, scale = 1) {
  for (let band = 0; band < target.length; band += 1) target[band] += source[band] * scale
}

export function spectrumToArray(flux: ArrayLike<number>) {
  return Array.from({ length: flux.length }, (_, index) => flux[index])
}

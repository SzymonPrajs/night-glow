import type { Atmosphere, LightSource, SkyMetrics } from '../types'

export function calculateSkyMetrics(
  sources: LightSource[],
  atmosphere: Atmosphere,
  sunAltitude = -30,
  moonLight = 0,
): SkyMetrics {
  const directGlow = sources.reduce((sum, source) => {
    const distanceFalloff = Math.pow(source.distanceKm + 1.8, 1.28)
    return sum + source.flux / distanceFalloff
  }, 0)
  const scattering = 0.5 + atmosphere.aerosol * 0.95 + atmosphere.humidity * 0.5
  const cloudBounce = 1 + atmosphere.cloud * (1.05 - atmosphere.cloudBase * 0.065) * 1.6
  const artificialGlow = Math.log1p(directGlow * 0.28) * 24 * scattering * cloudBounce
  const twilight = clamp((sunAltitude + 18) / 18, 0, 1)
  const glowIndex = clamp(artificialGlow + twilight * 100 + moonLight * 18, 0, 100)
  const zenithMag = clamp(21.92 - 5.05 * Math.pow(glowIndex / 100, 0.78), 16.2, 21.92)
  const limitingMagnitude = clamp(
    7.15 - glowIndex * 0.045 - atmosphere.cloud * 2.45 - atmosphere.humidity * 0.22 - twilight * 2.1,
    0.7,
    7.15,
  )
  const visibleStars = Math.round(clamp(11 * Math.pow(2, 1.05 * (limitingMagnitude + 1)), 18, 4700))
  return {
    zenithMag,
    limitingMagnitude,
    bortle: bortleFromSqm(zenithMag),
    glowIndex,
    visibleStars,
  }
}

export function sourceGlowStrength(source: LightSource, atmosphere: Atmosphere) {
  const spread = 0.6 + atmosphere.aerosol * 1.4 + atmosphere.humidity * 0.85
  const cloudBoost = 1 + atmosphere.cloud * (1.2 - atmosphere.cloudBase * 0.07) * 1.8
  return clamp((source.flux / Math.pow(source.distanceKm + 1.5, 1.15)) * spread * cloudBoost, 0, 80)
}

function bortleFromSqm(sqm: number) {
  if (sqm >= 21.76) return 1
  if (sqm >= 21.6) return 2
  if (sqm >= 21.3) return 3
  if (sqm >= 20.8) return 4
  if (sqm >= 20.3) return 5
  if (sqm >= 19.5) return 6
  if (sqm >= 18.7) return 7
  if (sqm >= 18.0) return 8
  return 9
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

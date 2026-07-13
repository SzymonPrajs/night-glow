import * as THREE from 'three'
import type { CatalogStar } from '../data/starCatalog'
import type { Atmosphere } from '../types'
import { clamp } from './skyModel'

export type StarAppearance = {
  color: THREE.Color
  size: number
  opacity: number
  coreWidth: number
  haloWidth: number
  haloStrength: number
  dispersion: number
}

export function starAppearance(
  star: CatalogStar,
  altitude: number,
  limitingMagnitude: number,
  atmosphere: Atmosphere,
): StarAppearance {
  const airMass = relativeAirMass(altitude)
  const extraColumn = Math.max(0, airMass - 1)
  const extinctionPerAirMass = 0.075 + atmosphere.aerosol * 0.24 + atmosphere.humidity * 0.1
  const apparentMagnitude = star.mag + clamp(extraColumn * extinctionPerAirMass, 0, 3.5)
  const visibility = clamp((limitingMagnitude - apparentMagnitude + 0.32) / 0.68, 0, 1)
  const flux = 10 ** (-0.4 * apparentMagnitude)
  const brightnessScale = clamp(flux ** 0.2, 0.22, 1.6)
  const seeing = 0.75 + atmosphere.aerosol * 0.65 + atmosphere.humidity * 0.35 + atmosphere.cloud * 0.55
  const coreDiameter = clamp(
    (1 + brightnessScale * 1.75) * Math.sqrt(seeing) * airMass ** 0.12,
    1.15,
    7.5,
  )
  const haloStrength = clamp(
    0.035 + atmosphere.aerosol * 0.18 + atmosphere.humidity * 0.1 + atmosphere.cloud * 0.26 + extraColumn * 0.008,
    0.03,
    0.55,
  )
  const size = clamp(coreDiameter * (2.2 + haloStrength * 5) + brightnessScale * 1.5, 3.5, 30)
  const dispersionPixels = clamp(
    extraColumn * (0.035 + atmosphere.aerosol * 0.035 + atmosphere.humidity * 0.02),
    0,
    1.7,
  )

  return {
    color: observedStarColor(star.bv, star.spectralType, extraColumn, atmosphere),
    size,
    opacity: visibility * clamp(1.08 - apparentMagnitude * 0.025, 0.68, 1),
    coreWidth: clamp((0.849 * coreDiameter) / size, 0.045, 0.42),
    haloWidth: 0.27 + atmosphere.aerosol * 0.08 + atmosphere.humidity * 0.05 + atmosphere.cloud * 0.06,
    haloStrength,
    dispersion: (dispersionPixels * 2) / size,
  }
}

function observedStarColor(bv: number | null, spectralType: string, extraAirMass: number, atmosphere: Atmosphere) {
  const intrinsicBv = bv ?? spectralTypeBv(spectralType)
  const color = blackbodyColor(bvTemperature(intrinsicBv))
  const column = clamp(
    extraAirMass * (0.025 + atmosphere.aerosol * 0.15 + atmosphere.humidity * 0.07),
    0,
    1.6,
  )
  const originalPeak = Math.max(color.r, color.g, color.b)
  color.r *= Math.exp(-0.45 * column)
  color.g *= Math.exp(-0.72 * column)
  color.b *= Math.exp(-1.35 * column)
  const observedPeak = Math.max(color.r, color.g, color.b)
  if (observedPeak > 0) color.multiplyScalar(originalPeak / observedPeak)
  return color
}

function relativeAirMass(altitude: number) {
  const safeAltitude = clamp(altitude, 0.25, 90)
  const sine = Math.sin((safeAltitude * Math.PI) / 180)
  return clamp(1 / (sine + 0.50572 * (safeAltitude + 6.07995) ** -1.6364), 1, 20)
}

function spectralTypeBv(spectralType: string) {
  const type = spectralType.toUpperCase().match(/[OBAFGKM]/)?.[0]
  return ({ O: -0.32, B: -0.2, A: 0.13, F: 0.42, G: 0.65, K: 1.05, M: 1.55 } as Record<string, number>)[type ?? 'G']
}

function bvTemperature(bv: number) {
  const colorIndex = clamp(bv, -0.4, 2)
  return clamp(4600 * (1 / (0.92 * colorIndex + 1.7) + 1 / (0.92 * colorIndex + 0.62)), 2200, 30000)
}

function blackbodyColor(kelvin: number) {
  const temperature = kelvin / 100
  const red = temperature <= 66 ? 255 : 329.698727446 * (temperature - 60) ** -0.1332047592
  const green = temperature <= 66
    ? 99.4708025861 * Math.log(temperature) - 161.1195681661
    : 288.1221695283 * (temperature - 60) ** -0.0755148492
  const blue = temperature >= 66
    ? 255
    : temperature <= 19
      ? 0
      : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307
  return new THREE.Color().setRGB(
    clamp(red, 0, 255) / 255,
    clamp(green, 0, 255) / 255,
    clamp(blue, 0, 255) / 255,
    THREE.SRGBColorSpace,
  )
}

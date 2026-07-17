/** Linear RGB used by the solver for a natural moonless sky. */
export const NATURAL_SKY_RGB = [0.0016, 0.002, 0.0032] as const

export function rgbLuminance(rgb: ArrayLike<number>) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

export const NATURAL_SKY_LUMINANCE = rgbLuminance(NATURAL_SKY_RGB)

const DEG_TO_RAD = Math.PI / 180

/**
 * Normalized hemisphere quadrature for an irregular altitude grid.
 *
 * Solid angle is dOmega = cos(elevation) d(elevation) d(azimuth), so using
 * u = sin(elevation) turns the vertical integral into an ordinary trapezoid.
 * The returned weights sum to one over the represented elevation interval.
 */
export function solidAngleElevationWeights(elevationsDeg: ArrayLike<number>) {
  const count = elevationsDeg.length
  if (count === 0) return new Float64Array()
  if (count === 1) return Float64Array.of(1)

  const u = Float64Array.from(elevationsDeg, (elevation, index) => {
    if (!Number.isFinite(elevation) || elevation < 0 || elevation > 90) {
      throw new RangeError(`Elevation ${index} must be finite and between 0 and 90 degrees`)
    }
    return Math.sin(elevation * DEG_TO_RAD)
  })
  for (let index = 1; index < count; index += 1) {
    if (u[index] <= u[index - 1]) throw new RangeError('Elevations must be strictly increasing')
  }

  const weights = new Float64Array(count)
  weights[0] = (u[1] - u[0]) / 2
  for (let index = 1; index < count - 1; index += 1) {
    weights[index] = (u[index + 1] - u[index - 1]) / 2
  }
  weights[count - 1] = (u[count - 1] - u[count - 2]) / 2

  const total = u[count - 1] - u[0]
  for (let index = 0; index < count; index += 1) weights[index] /= total
  return weights
}

/** In-place radix-2 complex FFT. The inverse transform includes 1 / N scaling. */
export function transformRadix2(
  real: Float64Array,
  imaginary: Float64Array,
  inverse = false,
) {
  const size = real.length
  if (imaginary.length !== size || size < 2 || (size & (size - 1)) !== 0) {
    throw new Error('Radix-2 FFT arrays must have the same power-of-two length')
  }

  for (let source = 1, destination = 0; source < size; source += 1) {
    let bit = size >> 1
    while (destination & bit) {
      destination ^= bit
      bit >>= 1
    }
    destination ^= bit
    if (source >= destination) continue
    const swappedReal = real[source]
    const swappedImaginary = imaginary[source]
    real[source] = real[destination]
    imaginary[source] = imaginary[destination]
    real[destination] = swappedReal
    imaginary[destination] = swappedImaginary
  }

  for (let width = 2; width <= size; width *= 2) {
    const half = width >> 1
    const angle = (inverse ? 2 : -2) * Math.PI / width
    const stepReal = Math.cos(angle)
    const stepImaginary = Math.sin(angle)
    for (let start = 0; start < size; start += width) {
      let twiddleReal = 1
      let twiddleImaginary = 0
      for (let offset = 0; offset < half; offset += 1) {
        const even = start + offset
        const odd = even + half
        const oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary
        const oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal
        const evenReal = real[even]
        const evenImaginary = imaginary[even]
        real[even] = evenReal + oddReal
        imaginary[even] = evenImaginary + oddImaginary
        real[odd] = evenReal - oddReal
        imaginary[odd] = evenImaginary - oddImaginary
        const nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary
        twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal
        twiddleReal = nextReal
      }
    }
  }

  if (!inverse) return
  for (let index = 0; index < size; index += 1) {
    real[index] /= size
    imaginary[index] /= size
  }
}

export function linearConvolutionFftSize(sampleCount: number) {
  if (!Number.isInteger(sampleCount) || sampleCount < 2) {
    throw new Error('Circular convolution requires at least two samples')
  }
  let size = 1
  while (size < sampleCount * 2 - 1) size *= 2
  return size
}

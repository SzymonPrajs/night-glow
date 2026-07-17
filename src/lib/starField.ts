import * as THREE from 'three'

export type MilkyWayPoint = { longitude: number; latitude: number; intensity: number }

export const MILKY_WAY_POINTS = makeMilkyWay(4200)

export function createLabelTexture(text: string, accent = '#dbeaff') {
  const canvas = document.createElement('canvas')
  const logicalWidth = 512
  const logicalHeight = 96
  const rasterScale = 2
  canvas.width = logicalWidth * rasterScale
  canvas.height = logicalHeight * rasterScale
  const context = canvas.getContext('2d')!
  context.scale(rasterScale, rasterScale)
  context.font = '500 28px "Manrope", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  context.textBaseline = 'middle'
  const width = Math.min(470, context.measureText(text).width + 42)
  context.fillStyle = 'rgba(3, 8, 18, .72)'
  roundedRect(context, 4, 12, width, 64, 18)
  context.fill()
  context.fillStyle = accent
  context.beginPath()
  context.arc(24, 44, 4, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#eef6ff'
  context.fillText(text, 38, 44)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return { texture, aspect: width / 64 }
}

export function createOrbTexture(color: string, halo: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(128, 128, 4, 128, 128, 124)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(0.13, color)
  gradient.addColorStop(0.28, halo)
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 256, 256)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** A naked-eye lunar disc whose luminous area exactly matches the illuminated fraction. */
export function createMoonTexture(phase: number, waxing = true) {
  const canvas = document.createElement('canvas')
  const textureSize = 256
  const center = textureSize / 2
  const discRadius = 123
  canvas.width = textureSize
  canvas.height = textureSize
  const context = canvas.getContext('2d')!
  const image = context.createImageData(textureSize, textureSize)
  const illuminated = Math.max(0, Math.min(1, phase))
  const terminator = 2 * illuminated - 1

  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const nx = (x + 0.5 - center) / discRadius
      const ny = (y + 0.5 - center) / discRadius
      const radiusSquared = nx * nx + ny * ny
      if (radiusSquared > 1) continue
      const limb = Math.sqrt(Math.max(0, 1 - ny * ny))
      const lit = waxing ? nx >= -terminator * limb : nx <= terminator * limb
      if (!lit) continue
      const limbDarkening = 0.72 + 0.28 * Math.sqrt(Math.max(0, 1 - radiusSquared))
      const offset = (y * textureSize + x) * 4
      image.data[offset] = Math.round(226 * limbDarkening)
      image.data[offset + 1] = Math.round(233 * limbDarkening)
      image.data[offset + 2] = Math.round(238 * limbDarkening)
      image.data[offset + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

/** Solar photosphere with a compact limb-darkened edge and no baked-in halo. */
export function createSunTexture() {
  const canvas = document.createElement('canvas')
  const size = 256
  const center = size / 2
  const radius = 123
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  const image = context.createImageData(size, size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5 - center) / radius
      const ny = (y + 0.5 - center) / radius
      const radiusSquared = nx * nx + ny * ny
      if (radiusSquared > 1) continue
      const mu = Math.sqrt(Math.max(0, 1 - radiusSquared))
      const intensity = 0.48 + 0.52 * mu
      const offset = (y * size + x) * 4
      image.data[offset] = Math.round(255 * intensity)
      image.data[offset + 1] = Math.round(249 * intensity)
      image.data[offset + 2] = Math.round(220 * intensity)
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

/** Unit aureole texture; angular extent and energy are set independently by the renderer. */
export function createGlowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 126)
  gradient.addColorStop(0, 'rgba(255,255,255,.95)')
  gradient.addColorStop(0.035, 'rgba(255,255,255,.62)')
  gradient.addColorStop(0.18, 'rgba(255,255,255,.16)')
  gradient.addColorStop(0.55, 'rgba(255,255,255,.025)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 256, 256)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

function makeMilkyWay(count: number): MilkyWayPoint[] {
  const random = mulberry32(90125)
  return Array.from({ length: count }, () => {
    const longitude = random() * 360
    const centralBulge = 1 - Math.min(1, Math.abs(((longitude + 180) % 360) - 180) / 85)
    const width = 3.5 + centralBulge * 8
    const latitude = gaussian(random) * width + Math.sin((longitude * Math.PI) / 42) * 1.2
    return { longitude, latitude, intensity: 0.35 + random() * 0.45 + centralBulge * 0.35 }
  })
}

function gaussian(random: () => number) {
  return Math.sqrt(-2 * Math.log(Math.max(0.0001, random()))) * Math.cos(2 * Math.PI * random())
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

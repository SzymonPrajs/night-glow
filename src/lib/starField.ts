import * as THREE from 'three'

export type MilkyWayPoint = { longitude: number; latitude: number; intensity: number }

export const MILKY_WAY_POINTS = makeMilkyWay(4200)

export function createLabelTexture(text: string, accent = '#dbeaff') {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  canvas.width = 512
  canvas.height = 96
  context.font = '500 28px Inter, system-ui, sans-serif'
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
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 62)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(0.13, color)
  gradient.addColorStop(0.28, halo)
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** A simple naked-eye lunar disc with an illuminated terminator. */
export function createMoonTexture(phase: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')!
  const image = context.createImageData(128, 128)
  const illuminated = Math.max(0, Math.min(1, phase))
  const terminator = 2 * illuminated - 1

  for (let y = 0; y < 128; y += 1) {
    for (let x = 0; x < 128; x += 1) {
      const nx = (x + 0.5 - 64) / 49
      const ny = (y + 0.5 - 64) / 49
      const radiusSquared = nx * nx + ny * ny
      if (radiusSquared > 1) continue
      const limb = Math.sqrt(Math.max(0, 1 - ny * ny))
      const lit = nx >= -terminator * limb
      if (!lit) continue
      const limbDarkening = 0.72 + 0.28 * Math.sqrt(Math.max(0, 1 - radiusSquared))
      const offset = (y * 128 + x) * 4
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

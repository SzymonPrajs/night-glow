// Imperative WebGL2 sky renderer. It projects the Physics-owned HDR radiance
// product (elevation × azimuth × linear RGB equirectangular grid) through a
// pinhole camera and applies the display transform exactly once: product-load
// normalization (declared), relative exposure, optional subtle enhancement,
// Reinhard tone map, sRGB output. It contains no scientific equations and
// renders on demand only (no animation loop).
import type { ObserverRenderProduct } from '../../lib/contracts/types.ts'

export interface SkyCamera {
  /** Compass azimuth of the view centre, degrees clockwise from north. */
  azimuthDeg: number
  /** Altitude of the view centre above the horizon, degrees. */
  altitudeDeg: number
  /** Horizontal field of view, degrees. */
  fovDeg: number
}

export interface SkyEngineCallbacks {
  /** Throttled camera summary for React readouts; never per-frame state. */
  onCameraSettled?: (camera: SkyCamera) => void
  onContextLost?: () => void
  onContextRestored?: () => void
}

const VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uSky;
uniform vec2 uSkySize; // (azimuth samples, elevation samples)
uniform vec3 uForward;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec2 uTanHalfFov; // (horizontal, vertical)
uniform float uExposure; // linear multiplier incl. product normalization
uniform float uEnhance; // 0..1 display-only lift
in vec2 vUv;
out vec4 outColor;

const float PI2 = 6.28318530718;
const float HALF_PI = 1.57079632679;

vec3 fetchCell(int az, int el) {
  int n = int(uSkySize.x);
  int azWrapped = ((az % n) + n) % n;
  int elClamped = clamp(el, 0, int(uSkySize.y) - 1);
  return texelFetch(uSky, ivec2(azWrapped, elClamped), 0).rgb;
}

vec3 sampleSky(float azimuth, float elevation) {
  float u = azimuth / PI2;
  float v = elevation / HALF_PI;
  float x = u * uSkySize.x - 0.5;
  float y = v * uSkySize.y - 0.5;
  int x0 = int(floor(x));
  int y0 = int(floor(y));
  vec2 f = vec2(x - floor(x), y - floor(y));
  vec3 c00 = fetchCell(x0, y0);
  vec3 c10 = fetchCell(x0 + 1, y0);
  vec3 c01 = fetchCell(x0, y0 + 1);
  vec3 c11 = fetchCell(x0 + 1, y0 + 1);
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

void main() {
  vec3 dir = normalize(uForward + vUv.x * uTanHalfFov.x * uRight + vUv.y * uTanHalfFov.y * uUp);
  float elevation = asin(clamp(dir.z, -1.0, 1.0));
  vec3 color;
  if (elevation < 0.0) {
    // Below the horizon is outside the render-product domain: honest ground,
    // no fabricated terrain.
    color = vec3(0.004, 0.005, 0.009);
  } else {
    float azimuth = atan(dir.x, dir.y);
    if (azimuth < 0.0) azimuth += PI2;
    color = sampleSky(azimuth, elevation) * uExposure;
  }
  color = color / (1.0 + color); // Reinhard tone map (display only)
  color = pow(color, vec3(1.0 - 0.3 * uEnhance)); // subtle display-only lift
  color = pow(color, vec3(1.0 / 2.2)); // linear -> sRGB
  outColor = vec4(color, 1.0);
}
`

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Failed to create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile failed: ${log}`)
  }
  return shader
}

export class SkyEngine {
  private canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext
  private callbacks: SkyEngineCallbacks
  private program: WebGLProgram | null = null
  private texture: WebGLTexture | null = null
  private buffer: WebGLBuffer | null = null
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private cam: SkyCamera = { azimuthDeg: 180, altitudeDeg: 20, fovDeg: 60 }
  private normalization = 1
  private exposureStops = 0
  private enhance = 0
  private skySize: [number, number] = [0, 0]
  private pointers = new Map<number, { x: number; y: number }>()
  private pinchDistance = 0
  private settleTimer: ReturnType<typeof setTimeout> | null = null
  private lost = false

  constructor(canvas: HTMLCanvasElement, callbacks: SkyEngineCallbacks = {}) {
    this.canvas = canvas
    this.callbacks = callbacks
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (!gl) throw new Error('WebGL2 is not available')
    this.gl = gl
    this.initGl()
    this.installInput()
    canvas.addEventListener('webglcontextlost', this.onLost)
    canvas.addEventListener('webglcontextrestored', this.onRestored)
  }

  private onLost = (event: Event) => {
    event.preventDefault()
    this.lost = true
    this.callbacks.onContextLost?.()
  }

  private onRestored = () => {
    this.lost = false
    this.initGl()
    this.render()
    this.callbacks.onContextRestored?.()
  }

  private initGl(): void {
    const gl = this.gl
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE)
    const program = gl.createProgram()
    if (!program) throw new Error('Failed to create program')
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`)
    }
    this.program = program
    this.uniforms = {}
    for (const name of ['uSky', 'uSkySize', 'uForward', 'uRight', 'uUp', 'uTanHalfFov', 'uExposure', 'uEnhance']) {
      this.uniforms[name] = gl.getUniformLocation(program, name)
    }
    this.buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    if (this.skySize[0] > 0 && this.lastValues) {
      this.uploadTexture(this.lastValues, this.skySize[0], this.skySize[1])
    }
  }

  private lastValues: Float32Array | null = null

  /** Uploads a coherent render product. Returns the product's max value. */
  upload(product: ObserverRenderProduct): number {
    const [elevationSamples, azimuthSamples] = [product.shape[0], product.shape[1]]
    this.lastValues = product.values
    this.skySize = [azimuthSamples, elevationSamples]
    let max = 0
    for (let i = 0; i < product.values.length; i += 1) {
      if (product.values[i] > max) max = product.values[i]
    }
    // Display-only normalization: declared per product load, never per zoom.
    // Maps the product max to a low linear value so the rendered frame reads
    // as a night sky (near-black, subtle gradients) rather than washed-out
    // day; Reinhard keeps brighter-than-max extrapolations from clipping.
    this.normalization = max > 0 ? 0.08 / max : 1
    this.uploadTexture(product.values, azimuthSamples, elevationSamples)
    this.render()
    return max
  }

  private uploadTexture(values: Float32Array, azimuthSamples: number, elevationSamples: number): void {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGB32F,
      azimuthSamples,
      elevationSamples,
      0,
      gl.RGB,
      gl.FLOAT,
      values,
    )
  }

  setExposureStops(stops: number): void {
    this.exposureStops = stops
    this.render()
  }

  exposure(): number {
    return this.exposureStops
  }

  setEnhance(value: number): void {
    this.enhance = Math.min(1, Math.max(0, value))
    this.render()
  }

  setCamera(camera: Partial<SkyCamera>): void {
    this.cam = { ...this.cam, ...camera }
    this.cam.altitudeDeg = Math.min(89.9, Math.max(-10, this.cam.altitudeDeg))
    this.cam.fovDeg = Math.min(100, Math.max(4, this.cam.fovDeg))
    this.cam.azimuthDeg = ((this.cam.azimuthDeg % 360) + 360) % 360
    this.render()
    this.scheduleSettled()
  }

  camera(): SkyCamera {
    return { ...this.cam }
  }

  resize(): void {
    if (this.ensureSize()) this.render()
  }

  /** Sizes the drawing buffer to the element's CSS size; true when it changed. */
  private ensureSize(): boolean {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr))
    const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
      return true
    }
    return false
  }

  private scheduleSettled(): void {
    if (this.settleTimer) clearTimeout(this.settleTimer)
    this.settleTimer = setTimeout(() => this.callbacks.onCameraSettled?.(this.camera()), 120)
  }

  private render(): void {
    if (this.lost || !this.program) return
    const gl = this.gl
    this.ensureSize()
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.useProgram(this.program)

    const az = (this.cam.azimuthDeg * Math.PI) / 180
    const alt = (this.cam.altitudeDeg * Math.PI) / 180
    const forward: [number, number, number] = [
      Math.cos(alt) * Math.sin(az),
      Math.cos(alt) * Math.cos(az),
      Math.sin(alt),
    ]
    const upRef: [number, number, number] = Math.abs(Math.sin(alt)) > 0.999 ? [0, 1, 0] : [0, 0, 1]
    const right = normalize(cross(forward, upRef))
    const up = cross(right, forward)
    const tanHalfFovX = Math.tan(((this.cam.fovDeg / 2) * Math.PI) / 180)
    const aspect = this.canvas.width / Math.max(1, this.canvas.height)
    const tanHalfFovY = tanHalfFovX / aspect

    gl.uniform3fv(this.uniforms.uForward, forward)
    gl.uniform3fv(this.uniforms.uRight, right)
    gl.uniform3fv(this.uniforms.uUp, up)
    gl.uniform2f(this.uniforms.uTanHalfFov, tanHalfFovX, tanHalfFovY)
    gl.uniform2f(this.uniforms.uSkySize, this.skySize[0], this.skySize[1])
    gl.uniform1f(this.uniforms.uExposure, this.normalization * Math.pow(2, this.exposureStops))
    gl.uniform1f(this.uniforms.uEnhance, this.enhance)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.uniform1i(this.uniforms.uSky, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private installInput(): void {
    const canvas = this.canvas
    canvas.style.touchAction = 'none'
    canvas.tabIndex = 0

    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId)
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()]
        this.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y)
      }
      canvas.focus()
    })
    canvas.addEventListener('pointermove', (event) => {
      const previous = this.pointers.get(event.pointerId)
      if (!previous) return
      if (this.pointers.size === 1) {
        const dx = event.clientX - previous.x
        const dy = event.clientY - previous.y
        const degPerPixel = this.cam.fovDeg / Math.max(1, canvas.clientWidth)
        this.setCamera({
          azimuthDeg: this.cam.azimuthDeg - dx * degPerPixel,
          altitudeDeg: this.cam.altitudeDeg + dy * degPerPixel,
        })
      }
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        if (this.pinchDistance > 0) {
          this.setCamera({ fovDeg: this.cam.fovDeg * (this.pinchDistance / distance) })
        }
        this.pinchDistance = distance
      }
    })
    const release = (event: PointerEvent) => {
      this.pointers.delete(event.pointerId)
      this.pinchDistance = 0
    }
    canvas.addEventListener('pointerup', release)
    canvas.addEventListener('pointercancel', release)
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault()
        this.setCamera({ fovDeg: this.cam.fovDeg * Math.pow(1.0015, event.deltaY) })
      },
      { passive: false },
    )
    canvas.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 10 : 2
      const handled = (() => {
        switch (event.key) {
          case 'ArrowLeft':
            this.setCamera({ azimuthDeg: this.cam.azimuthDeg - step })
            return true
          case 'ArrowRight':
            this.setCamera({ azimuthDeg: this.cam.azimuthDeg + step })
            return true
          case 'ArrowUp':
            this.setCamera({ altitudeDeg: this.cam.altitudeDeg + step })
            return true
          case 'ArrowDown':
            this.setCamera({ altitudeDeg: this.cam.altitudeDeg - step })
            return true
          case '+':
          case '=':
            this.setCamera({ fovDeg: this.cam.fovDeg * 0.9 })
            return true
          case '-':
            this.setCamera({ fovDeg: this.cam.fovDeg * 1.1 })
            return true
          case 'Home':
          case '0':
            this.setCamera({ azimuthDeg: 180, altitudeDeg: 20, fovDeg: 60 })
            return true
          default:
            return false
        }
      })()
      if (handled) event.preventDefault()
    })
  }

  dispose(): void {
    if (this.settleTimer) clearTimeout(this.settleTimer)
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    const loseContext = this.gl.getExtension('WEBGL_lose_context')
    loseContext?.loseContext()
  }
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function normalize(v: [number, number, number]): [number, number, number] {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { BRIGHT_STARS, DEEP_SKY } from '../data/celestial'
import { equatorialToHorizontal, galacticToEquatorial, horizontalVector, type HorizontalObject } from '../lib/astronomy'
import { clamp, sourceGlowStrength } from '../lib/skyModel'
import { bvToColor, createGlowTexture, createLabelTexture, createOrbTexture, FAINT_STARS, MILKY_WAY_POINTS } from '../lib/starField'
import type { Atmosphere, LightSource, Location, SkyMetrics } from '../types'

type ViewState = { azimuth: number; altitude: number; fov: number }

type SkyCanvasProps = {
  location: Location
  atmosphere: Atmosphere
  sources: LightSource[]
  metrics: SkyMetrics
  date: Date
  solarSystem: HorizontalObject[]
  resetViewToken: number
  onViewChange: (view: ViewState) => void
}

type SceneRefs = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  skyMaterial: THREE.ShaderMaterial
  starGroup: THREE.Group
  deepGroup: THREE.Group
  planetGroup: THREE.Group
  glowGroup: THREE.Group
  milkyWayGroup: THREE.Group
}

const pointVertexShader = `
  attribute float aSize;
  attribute float aOpacity;
  varying vec3 vColor;
  varying float vOpacity;
  uniform float uPixelRatio;
  void main() {
    vColor = color;
    vOpacity = aOpacity;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = max(1.0, aSize * uPixelRatio);
  }
`

const pointFragmentShader = `
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    float d = length(gl_PointCoord - vec2(.5));
    float alpha = smoothstep(.5, .06, d) * vOpacity;
    gl_FragColor = vec4(vColor, alpha);
  }
`

export default function SkyCanvas({
  location,
  atmosphere,
  sources,
  metrics,
  date,
  solarSystem,
  resetViewToken,
  onViewChange,
}: SkyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<SceneRefs | null>(null)
  const yawRef = useRef(0)
  const pitchRef = useRef(0.3)
  const fovRef = useRef(62)
  const draggingRef = useRef<{ x: number; y: number; pointer: number } | null>(null)
  const onViewChangeRef = useRef(onViewChange)
  onViewChangeRef.current = onViewChange

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(fovRef.current, 1, 0.1, 400)
    camera.rotation.order = 'YXZ'
    camera.position.set(0, 0, 0)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uPollution: { value: 0.25 },
        uCloud: { value: 0.1 },
        uHumidity: { value: 0.35 },
        uSunAltitude: { value: -30 },
      },
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDirection;
        uniform float uPollution;
        uniform float uCloud;
        uniform float uHumidity;
        uniform float uSunAltitude;
        void main() {
          float y = clamp(vDirection.y, -0.05, 1.0);
          float horizon = pow(1.0 - max(y, 0.0), 3.2);
          float day = smoothstep(-14.0, 3.0, uSunAltitude);
          vec3 nightTop = mix(vec3(.002, .005, .016), vec3(.012, .025, .052), uPollution);
          vec3 nightHorizon = mix(vec3(.009, .014, .028), vec3(.32, .125, .035), uPollution);
          vec3 color = mix(nightTop, nightHorizon, horizon * (.35 + uPollution * .65));
          vec3 dayTop = vec3(.075, .22, .45);
          vec3 dayHorizon = vec3(.34, .46, .62);
          color = mix(color, mix(dayTop, dayHorizon, horizon), day);
          float n = sin(vDirection.x * 31.0 + sin(vDirection.z * 19.0)) *
                    sin(vDirection.z * 27.0 + vDirection.y * 17.0);
          float clouds = smoothstep(.18 - uHumidity * .25, .78, n * .5 + .5) * uCloud;
          vec3 cloudColor = mix(vec3(.1, .11, .15), vec3(.43, .23, .12), uPollution * horizon);
          color = mix(color, cloudColor, clouds * (.22 + horizon * .38));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    })
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(160, 48, 28), skyMaterial))

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(165, 96),
      new THREE.MeshBasicMaterial({ color: '#010204', depthWrite: true, side: THREE.DoubleSide }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -1.9
    scene.add(ground)
    scene.add(makeHorizonSilhouette())

    const starGroup = new THREE.Group()
    const deepGroup = new THREE.Group()
    const planetGroup = new THREE.Group()
    const glowGroup = new THREE.Group()
    const milkyWayGroup = new THREE.Group()
    scene.add(glowGroup, milkyWayGroup, starGroup, deepGroup, planetGroup)
    sceneRef.current = { scene, camera, renderer, skyMaterial, starGroup, deepGroup, planetGroup, glowGroup, milkyWayGroup }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      renderer.setSize(rect.width, rect.height, false)
      camera.aspect = rect.width / Math.max(1, rect.height)
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    let frame = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)
      camera.rotation.x = pitchRef.current
      camera.rotation.y = yawRef.current
      renderer.render(scene, camera)
    }
    animate()
    emitView(camera, yawRef.current, pitchRef.current, onViewChangeRef.current)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      disposeObject(scene)
      renderer.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const refs = sceneRef.current
    if (!refs) return
    const sun = solarSystem.find((object) => object.kind === 'sun')
    refs.skyMaterial.uniforms.uPollution.value = metrics.glowIndex / 100
    refs.skyMaterial.uniforms.uCloud.value = atmosphere.cloud
    refs.skyMaterial.uniforms.uHumidity.value = atmosphere.humidity
    refs.skyMaterial.uniforms.uSunAltitude.value = sun?.altitude ?? -30
    rebuildStars(refs, location, date, metrics)
    rebuildMilkyWay(refs, location, date, metrics, atmosphere)
    rebuildDeepSky(refs, location, date, metrics)
    rebuildSolarSystem(refs, solarSystem, metrics)
    rebuildGlows(refs, sources, atmosphere)
  }, [location, date, metrics, atmosphere, solarSystem, sources])

  useEffect(() => {
    yawRef.current = 0
    pitchRef.current = 0.3
    fovRef.current = 62
    const camera = sceneRef.current?.camera
    if (camera) {
      camera.fov = 62
      camera.updateProjectionMatrix()
      emitView(camera, 0, 0.3, onViewChangeRef.current)
    }
  }, [resetViewToken])

  const updateView = () => {
    const camera = sceneRef.current?.camera
    if (camera) emitView(camera, yawRef.current, pitchRef.current, onViewChangeRef.current)
  }

  return (
    <canvas
      ref={canvasRef}
      className="sky-canvas"
      aria-label="Interactive three-dimensional sky. Drag to look around and scroll to zoom."
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        draggingRef.current = { x: event.clientX, y: event.clientY, pointer: event.pointerId }
      }}
      onPointerMove={(event) => {
        const drag = draggingRef.current
        if (!drag || drag.pointer !== event.pointerId) return
        const dx = event.clientX - drag.x
        const dy = event.clientY - drag.y
        yawRef.current += dx * 0.0045
        pitchRef.current = clamp(pitchRef.current + dy * 0.004, -0.2, 1.45)
        draggingRef.current = { ...drag, x: event.clientX, y: event.clientY }
        updateView()
      }}
      onPointerUp={() => { draggingRef.current = null }}
      onPointerCancel={() => { draggingRef.current = null }}
      onWheel={(event) => {
        event.preventDefault()
        fovRef.current = clamp(fovRef.current + event.deltaY * 0.025, 24, 82)
        const camera = sceneRef.current?.camera
        if (camera) {
          camera.fov = fovRef.current
          camera.updateProjectionMatrix()
          updateView()
        }
      }}
    />
  )
}

function rebuildStars(refs: SceneRefs, location: Location, date: Date, metrics: SkyMetrics) {
  clearGroup(refs.starGroup)
  const allStars = [...BRIGHT_STARS, ...FAINT_STARS]
  const positions: number[] = []
  const colors: number[] = []
  const sizes: number[] = []
  const opacity: number[] = []
  for (const star of allStars) {
    const horizontal = equatorialToHorizontal(star.ra, star.dec, date, location)
    const vector = horizontalVector(horizontal.azimuth, horizontal.altitude, 102)
    const color = bvToColor(star.color)
    const visible = smoothVisibility(star.mag, metrics.limitingMagnitude)
    positions.push(vector.x, vector.y, vector.z)
    colors.push(color.r, color.g, color.b)
    sizes.push(clamp(5.8 - star.mag * 0.6, 1.1, 7.2))
    opacity.push(visible)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
  geometry.setAttribute('aOpacity', new THREE.Float32BufferAttribute(opacity, 1))
  const material = makePointMaterial(refs.renderer)
  refs.starGroup.add(new THREE.Points(geometry, material))

  for (const star of BRIGHT_STARS.filter((item) => item.mag < 1.65 && item.mag < metrics.limitingMagnitude)) {
    const horizontal = equatorialToHorizontal(star.ra, star.dec, date, location)
    if (horizontal.altitude < 3) continue
    const vector = horizontalVector(horizontal.azimuth, horizontal.altitude, 96)
    const label = makeLabel(`${star.name}  ·  ${star.constellation}`, '#a9cfff')
    label.position.set(vector.x, vector.y + 1.4, vector.z)
    refs.starGroup.add(label)
  }
}

function rebuildMilkyWay(refs: SceneRefs, location: Location, date: Date, metrics: SkyMetrics, atmosphere: Atmosphere) {
  clearGroup(refs.milkyWayGroup)
  const visibility = clamp((metrics.limitingMagnitude - 4.55) / 2.2, 0, 1) * (1 - atmosphere.cloud * 0.86)
  if (visibility < 0.025) return
  const positions: number[] = []
  const colors: number[] = []
  const sizes: number[] = []
  const opacities: number[] = []
  for (const point of MILKY_WAY_POINTS) {
    const equatorial = galacticToEquatorial(point.longitude, point.latitude)
    const horizontal = equatorialToHorizontal(equatorial.ra, equatorial.dec, date, location)
    const vector = horizontalVector(horizontal.azimuth, horizontal.altitude, 108)
    positions.push(vector.x, vector.y, vector.z)
    colors.push(0.55, 0.67, 0.8)
    sizes.push(1.1 + point.intensity * 1.45)
    opacities.push(point.intensity * visibility * 0.24)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
  geometry.setAttribute('aOpacity', new THREE.Float32BufferAttribute(opacities, 1))
  refs.milkyWayGroup.add(new THREE.Points(geometry, makePointMaterial(refs.renderer, THREE.AdditiveBlending)))
}

function rebuildDeepSky(refs: SceneRefs, location: Location, date: Date, metrics: SkyMetrics) {
  clearGroup(refs.deepGroup)
  for (const object of DEEP_SKY) {
    const required = object.kind === 'cluster' ? object.mag - 0.6 : object.mag + 1.25
    if (metrics.limitingMagnitude < required) continue
    const horizontal = equatorialToHorizontal(object.ra, object.dec, date, location)
    if (horizontal.altitude < 1) continue
    const vector = horizontalVector(horizontal.azimuth, horizontal.altitude, 98)
    const color = object.kind === 'nebula' ? '#80c6c2' : object.kind === 'galaxy' ? '#b1b9d9' : '#a8c7ff'
    const sprite = makeOrb(color, 'rgba(117, 155, 214, .25)', clamp(object.size / 18, 1.5, 7))
    sprite.position.set(vector.x, vector.y, vector.z)
    refs.deepGroup.add(sprite)
    if (metrics.limitingMagnitude > 5.1 || object.mag < 4.2) {
      const label = makeLabel(`${object.catalog}  ${object.name}`, color)
      label.position.set(vector.x, vector.y + 1.5, vector.z)
      refs.deepGroup.add(label)
    }
  }
}

function rebuildSolarSystem(refs: SceneRefs, objects: HorizontalObject[], metrics: SkyMetrics) {
  clearGroup(refs.planetGroup)
  for (const object of objects) {
    if (object.altitude < -3) continue
    if (object.kind === 'planet' && object.magnitude > metrics.limitingMagnitude) continue
    const vector = horizontalVector(object.azimuth, object.altitude, 92)
    const style = planetStyle(object.name)
    const scale = object.kind === 'sun' ? 8 : object.kind === 'moon' ? 5.5 : clamp(4.3 - object.magnitude * 0.35, 2.1, 5.5)
    const orb = makeOrb(style.color, style.halo, scale)
    orb.position.set(vector.x, vector.y, vector.z)
    refs.planetGroup.add(orb)
    const label = makeLabel(`${object.name}${object.kind === 'moon' ? `  ${Math.round((object.phase ?? 0) * 100)}%` : ''}`, style.color)
    label.position.set(vector.x, vector.y + scale * 0.45, vector.z)
    refs.planetGroup.add(label)
  }
}

function rebuildGlows(refs: SceneRefs, sources: LightSource[], atmosphere: Atmosphere) {
  clearGroup(refs.glowGroup)
  const bins = Array.from({ length: 24 }, () => 0)
  for (const source of sources) {
    const index = Math.round(source.bearing / 15) % 24
    bins[index] += sourceGlowStrength(source, atmosphere)
  }
  const texture = createGlowTexture()
  bins.forEach((value, index) => {
    if (value < 0.3) return
    const strength = clamp(Math.log1p(value) / 4.2, 0.06, 1)
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: new THREE.Color().setHSL(0.075, 0.78, 0.56),
      transparent: true,
      opacity: 0.18 + strength * 0.62,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const sprite = new THREE.Sprite(material)
    const position = horizontalVector(index * 15, 4 + strength * 2.2, 86)
    sprite.position.set(position.x, position.y, position.z)
    sprite.scale.set(18 + strength * 29, 10 + strength * 19, 1)
    refs.glowGroup.add(sprite)
  })
}

function makePointMaterial(renderer: THREE.WebGLRenderer, blending: THREE.Blending = THREE.NormalBlending) {
  return new THREE.ShaderMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending,
    uniforms: { uPixelRatio: { value: Math.min(renderer.getPixelRatio(), 2) } },
    vertexShader: pointVertexShader,
    fragmentShader: pointFragmentShader,
  })
}

function makeLabel(text: string, accent: string) {
  const { texture, aspect } = createLabelTexture(text, accent)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.92 }))
  sprite.scale.set(7.2 * aspect, 7.2, 1)
  return sprite
}

function makeOrb(color: string, halo: string, scale: number) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createOrbTexture(color, halo),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }))
  sprite.scale.set(scale, scale, 1)
  return sprite
}

function makeHorizonSilhouette() {
  const random = seeded(7129)
  const vertices: number[] = []
  const radius = 119
  const steps = 192
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2
    const ridge = -1.3 + Math.sin(angle * 5.2) * 0.8 + Math.sin(angle * 13.1) * 0.28 + random() * 0.35
    const nextAngle = ((i + 1) / steps) * Math.PI * 2
    const nextRidge = -1.3 + Math.sin(nextAngle * 5.2) * 0.8 + Math.sin(nextAngle * 13.1) * 0.28 + random() * 0.35
    vertices.push(
      Math.sin(angle) * radius, -3.2, Math.cos(angle) * radius,
      Math.sin(angle) * radius, ridge, Math.cos(angle) * radius,
      Math.sin(nextAngle) * radius, nextRidge, Math.cos(nextAngle) * radius,
      Math.sin(angle) * radius, -3.2, Math.cos(angle) * radius,
      Math.sin(nextAngle) * radius, nextRidge, Math.cos(nextAngle) * radius,
      Math.sin(nextAngle) * radius, -3.2, Math.cos(nextAngle) * radius,
    )
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#020305', side: THREE.DoubleSide }))
}

function planetStyle(name: string) {
  const styles: Record<string, { color: string; halo: string }> = {
    Sun: { color: '#fff7d0', halo: 'rgba(255, 190, 75, .42)' },
    Moon: { color: '#e9efff', halo: 'rgba(182, 201, 255, .28)' },
    Mercury: { color: '#d7cfbf', halo: 'rgba(214, 207, 192, .24)' },
    Venus: { color: '#fff0ba', halo: 'rgba(255, 224, 146, .35)' },
    Mars: { color: '#ff9b72', halo: 'rgba(242, 100, 68, .3)' },
    Jupiter: { color: '#f2d1a8', halo: 'rgba(235, 188, 135, .3)' },
    Saturn: { color: '#e8d6a3', halo: 'rgba(220, 193, 119, .28)' },
    Uranus: { color: '#a9eced', halo: 'rgba(119, 221, 226, .24)' },
    Neptune: { color: '#8faeff', halo: 'rgba(90, 126, 238, .25)' },
  }
  return styles[name] ?? { color: '#ffffff', halo: 'rgba(255,255,255,.2)' }
}

function smoothVisibility(magnitude: number, limit: number) {
  return clamp((limit - magnitude + 0.35) / 0.7, 0, 1) * clamp(1.15 - magnitude * 0.06, 0.5, 1)
}

function emitView(camera: THREE.PerspectiveCamera, yaw: number, pitch: number, callback: (view: ViewState) => void) {
  const direction = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'))
  const azimuth = (Math.atan2(direction.x, direction.z) * 180) / Math.PI
  callback({ azimuth: (azimuth + 360) % 360, altitude: (Math.asin(direction.y) * 180) / Math.PI, fov: camera.fov })
}

function clearGroup(group: THREE.Group) {
  for (const child of [...group.children]) {
    group.remove(child)
    disposeObject(child)
  }
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    mesh.geometry?.dispose()
    const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []
    for (const material of materials) {
      const spriteMaterial = material as THREE.SpriteMaterial
      spriteMaterial.map?.dispose()
      material.dispose()
    }
  })
}

function seeded(seed: number) {
  return () => {
    seed = Math.sin(seed) * 10000
    return seed - Math.floor(seed)
  }
}

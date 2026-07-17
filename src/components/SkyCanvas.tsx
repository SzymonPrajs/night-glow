import { useCallback, useEffect, useId, useRef } from 'react'
import * as THREE from 'three'
import { BRIGHT_STARS, DEEP_SKY } from '../data/celestial'
import { STAR_CATALOG } from '../data/starCatalog'
import { equatorialToHorizontal, galacticToEquatorial, horizontalVector, type HorizontalObject } from '../lib/astronomy'
import {
  APPEARANCE_ENDPOINTS,
  interpolateAppearanceValue,
  normalizeEnhancement,
  REALISTIC_APPEARANCE_PROFILE,
  realisticGlowRgb,
} from '../lib/appearance'
import {
  angularSpriteScale,
  clearAirTransmissionRgb,
  horizontalUnitVector,
} from '../lib/celestialLight'
import { physicalZenithSample, samplePhysicalGlow } from '../lib/physicalGlowField'
import type { PhysicalGlowResult } from '../lib/physicalGlowProtocol'
import { buildPhysicalGlowRenderGrid } from '../lib/physicalGlowRender'
import { clamp } from '../lib/skyModel'
import { NATURAL_SKY_LUMINANCE, NATURAL_SKY_RGB } from '../lib/photometry'
import {
  apparentStarMagnitude,
  cloudAdjustedLimitingMagnitude,
  directCloudExtinction,
  directCloudTransmission,
  starAppearance,
} from '../lib/starAppearance'
import {
  createGlowTexture,
  createLabelTexture,
  createMoonTexture,
  createOrbTexture,
  createSunTexture,
  MILKY_WAY_POINTS,
} from '../lib/starField'
import type { Atmosphere, Location, SeeingConditions, SkyMetrics } from '../types'

type ViewState = { azimuth: number; altitude: number; fov: number }
type ActivePointer = { x: number; y: number }

const DEFAULT_YAW = 0
const DEFAULT_PITCH = 0.3
const DEFAULT_FOV = 62
const MIN_PITCH = -0.2
const MAX_PITCH = 1.45
const MIN_FOV = 0.08
const MAX_FOV = 82
const MAX_PIXEL_RATIO = 2
const KEYBOARD_LOOK_STEP = THREE.MathUtils.degToRad(2)
const KEYBOARD_LOOK_STEP_LARGE = THREE.MathUtils.degToRad(10)
const KEYBOARD_ZOOM_FACTOR = 0.82
const PINCH_ZOOM_RATE = 0.006

type SkyCanvasProps = {
  location: Location
  atmosphere: Atmosphere
  seeing: SeeingConditions
  skyEnhancement: number
  moonLight: number
  glowField?: PhysicalGlowResult
  metrics: SkyMetrics
  date: Date
  solarSystem: HorizontalObject[]
  resetViewToken: number
  onViewChange: (view: ViewState) => void
}

const colorSpaceShader = `
  float linearChannelToSrgb(float value) {
    float safe = max(value, 0.0);
    return safe <= 0.0031308 ? safe * 12.92 : 1.055 * pow(safe, 1.0 / 2.4) - 0.055;
  }
  vec3 linearToSrgb(vec3 value) {
    return vec3(
      linearChannelToSrgb(value.r),
      linearChannelToSrgb(value.g),
      linearChannelToSrgb(value.b)
    );
  }
`

const realisticSkyResponseShader = `
  ${colorSpaceShader}
  const vec3 NATURAL_SKY = vec3(${NATURAL_SKY_RGB.join(', ')});
  const float NATURAL_SKY_Y = ${NATURAL_SKY_LUMINANCE};
  float visualLuminance(vec3 value) {
    return dot(value, vec3(0.2126, 0.7152, 0.0722));
  }
  vec3 realisticSkyTone(vec3 radiance) {
    float physicalY = max(visualLuminance(radiance), 0.0000001);
    float displayY = min(0.55, 0.006 * pow(max(physicalY / NATURAL_SKY_Y, 0.000001), 0.22));
    vec3 scaled = max(radiance, vec3(0.0)) * (displayY / physicalY);
    float luminanceCd = 0.0001842 * physicalY / NATURAL_SKY_Y;
    float logLuminanceCd = log(max(luminanceCd, 0.000001)) / 2.302585;
    float mesopic = smoothstep(-2.30103, -0.30103, logLuminanceCd);
    float chroma = mix(0.16, 0.72, mesopic);
    return linearToSrgb(max(mix(vec3(displayY), scaled, chroma), vec3(0.0)));
  }

  float logAnchorMix(float value, float x0, float y0, float x1, float y1) {
    float mixValue = smoothstep(x0, x1, value);
    if (y0 <= 0.0) return y1 * mixValue;
    return exp(mix(log(y0), log(y1), mixValue));
  }
  float solarZenithRatio(float altitude) {
    if (altitude <= -18.0) return 0.0;
    if (altitude <= -15.0) return logAnchorMix(altitude, -18.0, 0.0, -15.0, 0.25);
    if (altitude <= -12.0) return logAnchorMix(altitude, -15.0, 0.25, -12.0, 5.0);
    if (altitude <= -9.0) return logAnchorMix(altitude, -12.0, 5.0, -9.0, 45.0);
    if (altitude <= -6.0) return logAnchorMix(altitude, -9.0, 45.0, -6.0, 500.0);
    if (altitude <= -3.0) return logAnchorMix(altitude, -6.0, 500.0, -3.0, 5000.0);
    if (altitude <= 0.0) return logAnchorMix(altitude, -3.0, 5000.0, 0.0, 40000.0);
    if (altitude <= 6.0) return logAnchorMix(altitude, 0.0, 40000.0, 6.0, 400000.0);
    if (altitude <= 15.0) return logAnchorMix(altitude, 6.0, 400000.0, 15.0, 2000000.0);
    if (altitude <= 45.0) return logAnchorMix(altitude, 15.0, 2000000.0, 45.0, 8000000.0);
    return logAnchorMix(altitude, 45.0, 8000000.0, 90.0, 12000000.0);
  }
  float perez(float theta, float gamma, float turbidity) {
    float A = 0.1787 * turbidity - 1.4630;
    float B = -0.3554 * turbidity + 0.4275;
    float C = -0.0227 * turbidity + 5.3251;
    float D = 0.1206 * turbidity - 2.5771;
    float E = -0.0670 * turbidity + 0.3703;
    return (1.0 + A * exp(B / max(cos(theta), 0.015))) *
      (1.0 + C * exp(D * gamma) + E * cos(gamma) * cos(gamma));
  }
  float solarDistribution(vec3 direction, vec3 sunDirection, float sunAltitude, float turbidity) {
    float theta = acos(clamp(direction.y, 0.0, 1.0));
    float gamma = acos(clamp(dot(direction, sunDirection), -1.0, 1.0));
    if (sunAltitude >= 0.0) {
      float sunTheta = acos(clamp(sunDirection.y, 0.0, 1.0));
      return clamp(perez(theta, gamma, turbidity) / max(perez(0.0, sunTheta, turbidity), 0.01), 0.04, 60.0);
    }
    float horizonBand = exp(-max(0.0, degrees(asin(clamp(direction.y, 0.0, 1.0)))) / 10.0);
    float sunward = exp(-gamma / 0.42);
    return 1.0 + horizonBand * (1.5 + 6.0 * sunward);
  }
  vec3 normalizedSkyColor(vec3 color) {
    return color * (NATURAL_SKY_Y / max(visualLuminance(color), 0.000001));
  }
  vec3 realisticBaseRadiance(
    vec3 rawDirection,
    vec3 sunDirection,
    vec3 moonDirection,
    float sunAltitude,
    float moonLight,
    float aerosol,
    float humidity
  ) {
    vec3 direction = normalize(rawDirection);
    float horizon = pow(1.0 - clamp(direction.y, 0.0, 1.0), 3.2);
    vec3 base = NATURAL_SKY * (1.0 + horizon * 0.45);
    float solarRatio = solarZenithRatio(sunAltitude);
    float sunGamma = acos(clamp(dot(direction, sunDirection), -1.0, 1.0));
    float turbidity = clamp(2.0 + aerosol * 8.0 + humidity * 1.5, 1.7, 10.0);
    float solarShape = solarDistribution(direction, sunDirection, sunAltitude, turbidity);
    vec3 daylightBlue = normalizedSkyColor(vec3(0.34, 0.66, 1.28));
    vec3 twilightWarm = normalizedSkyColor(vec3(1.45, 0.44, 0.105));
    float warmAltitude = 1.0 - smoothstep(0.0, 18.0, abs(sunAltitude - 1.0));
    float warm = exp(-sunGamma / 0.48) * warmAltitude;
    warm *= 0.35 + 0.65 * horizon;
    vec3 solarColor = mix(daylightBlue, twilightWarm, clamp(warm, 0.0, 0.92));
    base += solarColor * solarRatio * solarShape;
    float moonGamma = acos(clamp(dot(direction, moonDirection), -1.0, 1.0));
    float moonShape = (1.0 + horizon * 0.7) * (0.72 + 2.8 * exp(-moonGamma / 0.32));
    vec3 moonColor = normalizedSkyColor(vec3(0.76, 0.86, 1.0));
    base += moonColor * (30.0 * max(moonLight, 0.0)) * moonShape;
    return base;
  }
`

type SpritePresentationBinding = {
  sprite: THREE.Sprite
  material: THREE.SpriteMaterial
  realisticOpacity: number
  enhancedOpacity: number
  realisticScaleX: number
  realisticScaleY: number
  enhancedScaleX: number
  enhancedScaleY: number
  realisticColor?: THREE.Color
  enhancedColor?: THREE.Color
  realisticY?: number
  enhancedY?: number
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
  latestEnhancement: number
  starMaterial?: THREE.ShaderMaterial
  milkyWayMaterial?: THREE.ShaderMaterial
  glowMaterial?: THREE.ShaderMaterial
  starLabelBindings: SpritePresentationBinding[]
  deepBindings: SpritePresentationBinding[]
  planetBindings: SpritePresentationBinding[]
}

const pointVertexShader = `
  attribute vec3 aRealisticColor;
  attribute vec3 aEnhancedColor;
  attribute float aRealisticSize;
  attribute float aEnhancedSize;
  attribute float aRealisticOpacity;
  attribute float aEnhancedOpacity;
  varying vec3 vColor;
  varying float vOpacity;
  uniform float uEnhancement;
  uniform float uPixelRatio;
  void main() {
    vColor = mix(aRealisticColor, aEnhancedColor, uEnhancement);
    vOpacity = mix(aRealisticOpacity, aEnhancedOpacity, uEnhancement);
    float size = mix(aRealisticSize, aEnhancedSize, uEnhancement);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = max(1.0, size * uPixelRatio);
  }
`

const pointFragmentShader = `
  varying vec3 vColor;
  varying float vOpacity;
  uniform float uEnhancement;
  ${colorSpaceShader}
  void main() {
    float d = length(gl_PointCoord - vec2(.5));
    float alpha = smoothstep(.5, .06, d) * vOpacity;
    vec3 displayColor = mix(linearToSrgb(max(vColor, vec3(0.0))), vColor, uEnhancement);
    gl_FragColor = vec4(displayColor, alpha);
  }
`

const starVertexShader = `
  attribute vec3 aRealisticColor;
  attribute vec3 aEnhancedColor;
  attribute vec2 aSignals;
  attribute float aVisibility;
  attribute vec3 aPsfSigmaArcsec;
  attribute float aEnhancedSigmaCss;
  attribute vec2 aDispersions;
  varying vec3 vColor;
  varying float vVisibility;
  varying float vSignal;
  varying vec3 vSigmaCss;
  varying float vDispersionCss;
  varying float vSpriteSizeCss;
  uniform float uEnhancement;
  uniform float uPixelRatio;
  uniform float uPixelsPerArcsecond;
  void main() {
    vec3 angularSigmaCss = aPsfSigmaArcsec * uPixelsPerArcsecond;
    float samplingSigmaCss = 0.42;
    float presentationSigmaCss = aEnhancedSigmaCss * uEnhancement;
    vSigmaCss = sqrt(
      angularSigmaCss * angularSigmaCss +
      vec3(samplingSigmaCss * samplingSigmaCss + presentationSigmaCss * presentationSigmaCss)
    );
    vDispersionCss = mix(
      aDispersions.x * uPixelsPerArcsecond,
      aDispersions.y,
      uEnhancement
    );
    float maximumSigma = max(vSigmaCss.r, max(vSigmaCss.g, vSigmaCss.b));
    vSpriteSizeCss = clamp(10.0 * maximumSigma + 2.0 * vDispersionCss, 4.0, 256.0);
    vColor = mix(aRealisticColor, aEnhancedColor, uEnhancement);
    vVisibility = aVisibility;
    vSignal = mix(aSignals.x, aSignals.y, uEnhancement);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = vSpriteSizeCss * uPixelRatio;
  }
`

const starFragmentShader = `
  varying vec3 vColor;
  varying float vVisibility;
  varying float vSignal;
  varying vec3 vSigmaCss;
  varying float vDispersionCss;
  varying float vSpriteSizeCss;
  uniform float uEnhancement;
  uniform float uRealisticStarGain;
  ${colorSpaceShader}
  float gaussian(vec2 offset, float sigma) {
    float variance = max(sigma * sigma, 0.000001);
    return exp(-0.5 * dot(offset, offset) / variance) / (6.28318530718 * variance);
  }
  void main() {
    vec2 pointCss = (gl_PointCoord - vec2(.5)) * vSpriteSizeCss;
    float red = gaussian(pointCss - vec2(0.0, vDispersionCss), vSigmaCss.r);
    float green = gaussian(pointCss, vSigmaCss.g);
    float blue = gaussian(pointCss + vec2(0.0, vDispersionCss), vSigmaCss.b);
    vec3 profile = vColor * vec3(red, green, blue);
    vec3 signal = profile * vSignal * vVisibility;
    float peak = max(signal.r, max(signal.g, signal.b));
    float gain = mix(uRealisticStarGain, 1.0, uEnhancement);
    signal *= gain / (1.0 + (gain - 1.0) * peak);
    float intensity = max(signal.r, max(signal.g, signal.b));
    if (vVisibility <= 0.0 || intensity < 0.000001) discard;
    vec3 chroma = linearToSrgb(signal / intensity);
    float alpha = clamp(linearChannelToSrgb(intensity), 0.0, 1.0);
    gl_FragColor = vec4(chroma, alpha);
  }
`

export default function SkyCanvas({
  location,
  atmosphere,
  seeing,
  skyEnhancement,
  moonLight,
  glowField,
  metrics,
  date,
  solarSystem,
  resetViewToken,
  onViewChange,
}: SkyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<SceneRefs | null>(null)
  const yawRef = useRef(DEFAULT_YAW)
  const pitchRef = useRef(DEFAULT_PITCH)
  const fovRef = useRef(DEFAULT_FOV)
  const activePointersRef = useRef(new Map<number, ActivePointer>())
  const instructionsId = useId()
  const onViewChangeRef = useRef(onViewChange)
  onViewChangeRef.current = onViewChange

  const updateView = useCallback(() => {
    const camera = sceneRef.current?.camera
    if (camera) emitView(camera, yawRef.current, pitchRef.current, onViewChangeRef.current)
  }, [])

  const applyFov = useCallback((nextFov: number) => {
    const refs = sceneRef.current
    fovRef.current = refs
      ? applyCameraFov(refs, nextFov)
      : clamp(nextFov, MIN_FOV, MAX_FOV)
    if (refs) updateView()
  }, [updateView])

  const resetView = useCallback(() => {
    yawRef.current = DEFAULT_YAW
    pitchRef.current = DEFAULT_PITCH
    applyFov(DEFAULT_FOV)
  }, [applyFov])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const activePointers = activePointersRef.current
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(fovRef.current, 1, 0.1, 400)
    camera.rotation.order = 'YXZ'
    camera.position.set(0, 0, 0)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    renderer.toneMappingExposure = 1

    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uPollution: { value: 0.25 },
        uAerosol: { value: 0.25 },
        uCloud: { value: 0.1 },
        uHumidity: { value: 0.35 },
        uSunAltitude: { value: -30 },
        uSunDirection: { value: new THREE.Vector3(0, -1, 0) },
        uMoonDirection: { value: new THREE.Vector3(0, -1, 0) },
        uZenithMag: { value: 21.92 },
        uEnhancement: { value: 0 },
        uHasPhysicalGlow: { value: 0 },
        uMoonLight: { value: 0 },
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
        uniform float uAerosol;
        uniform float uCloud;
        uniform float uHumidity;
        uniform float uSunAltitude;
        uniform vec3 uSunDirection;
        uniform vec3 uMoonDirection;
        uniform float uZenithMag;
        uniform float uEnhancement;
        uniform float uHasPhysicalGlow;
        uniform float uMoonLight;
        ${realisticSkyResponseShader}
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
          vec3 direction = normalize(vDirection);
          vec3 realisticBase = realisticBaseRadiance(
            direction,
            normalize(uSunDirection),
            normalize(uMoonDirection),
            uSunAltitude,
            uMoonLight,
            uAerosol,
            uHumidity
          );
          float ratio = max(0.0, pow(10.0, 0.4 * (21.92 - uZenithMag)) - 1.0);
          float fallbackRatio = max(0.0, ratio - solarZenithRatio(uSunAltitude) - 30.0 * uMoonLight);
          vec3 fallbackColor = vec3(1.0, 0.78, 0.56);
          fallbackColor *= NATURAL_SKY_Y / visualLuminance(fallbackColor);
          realisticBase += fallbackColor * fallbackRatio * (0.35 + horizon * 0.65) * (1.0 - uHasPhysicalGlow);
          vec3 realisticColor = realisticSkyTone(realisticBase);
          vec3 realisticCloud = mix(realisticColor, vec3(0.52), smoothstep(-3.0, 12.0, uSunAltitude));
          realisticColor = mix(realisticColor, realisticCloud, clouds * (0.18 + horizon * 0.2));
          color = mix(realisticColor, color, uEnhancement);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    })
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(160, 48, 28), skyMaterial))

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(165, 96),
      new THREE.MeshBasicMaterial({ color: '#010204', depthWrite: true, side: THREE.DoubleSide, toneMapped: false }),
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
    const refs: SceneRefs = {
      scene,
      camera,
      renderer,
      skyMaterial,
      starGroup,
      deepGroup,
      planetGroup,
      glowGroup,
      milkyWayGroup,
      latestEnhancement: 0,
      starLabelBindings: [],
      deepBindings: [],
      planetBindings: [],
    }
    sceneRef.current = refs

    const resize = () => refreshRendererSize(refs)
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    window.addEventListener('resize', resize)
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      fovRef.current = applyCameraFov(refs, fovRef.current * Math.exp(event.deltaY * 0.0015))
      emitView(camera, yawRef.current, pitchRef.current, onViewChangeRef.current)
    }
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    let dprQuery: MediaQueryList | null = null
    const listenForDprChange = () => {
      dprQuery?.removeEventListener('change', handleDprChange)
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      dprQuery.addEventListener('change', handleDprChange)
    }
    const handleDprChange = () => {
      resize()
      listenForDprChange()
    }
    listenForDprChange()
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
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('wheel', handleWheel)
      dprQuery?.removeEventListener('change', handleDprChange)
      activePointers.clear()
      disposeObject(scene)
      renderer.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const refs = sceneRef.current
    if (!refs) return
    const sun = solarSystem.find((object) => object.kind === 'sun')
    const moon = solarSystem.find((object) => object.kind === 'moon')
    const sunDirection = horizontalUnitVector(sun?.azimuth ?? 0, sun?.altitude ?? -90)
    const moonDirection = horizontalUnitVector(moon?.azimuth ?? 0, moon?.altitude ?? -90)
    refs.skyMaterial.uniforms.uPollution.value = metrics.glowIndex / 550
    refs.skyMaterial.uniforms.uAerosol.value = atmosphere.aerosol
    refs.skyMaterial.uniforms.uCloud.value = atmosphere.cloud
    refs.skyMaterial.uniforms.uHumidity.value = atmosphere.humidity
    refs.skyMaterial.uniforms.uSunAltitude.value = sun?.altitude ?? -30
    refs.skyMaterial.uniforms.uSunDirection.value.set(...sunDirection)
    refs.skyMaterial.uniforms.uMoonDirection.value.set(...moonDirection)
    refs.skyMaterial.uniforms.uZenithMag.value = metrics.zenithMag
    refs.skyMaterial.uniforms.uHasPhysicalGlow.value = glowField ? 1 : 0
    refs.skyMaterial.uniforms.uMoonLight.value = moonLight
    rebuildStars(refs, location, date, metrics, atmosphere, seeing, glowField)
    rebuildMilkyWay(refs, location, date, metrics, atmosphere, glowField)
    rebuildDeepSky(refs, location, date, metrics, atmosphere, glowField)
    rebuildSolarSystem(refs, solarSystem, metrics, atmosphere, glowField)
    rebuildPhysicalGlows(refs, glowField, sun, moon, moonLight, atmosphere)
    updatePointMaterialResolution(refs)
    applyPresentation(refs, refs.latestEnhancement)
  }, [location, date, metrics, atmosphere, seeing, solarSystem, glowField, moonLight])

  useEffect(() => {
    const refs = sceneRef.current
    if (refs) applyPresentation(refs, skyEnhancement)
  }, [skyEnhancement])

  useEffect(() => {
    resetView()
  }, [resetViewToken, resetView])

  return (
    <>
      <canvas
        ref={canvasRef}
        className="sky-canvas"
        tabIndex={0}
        aria-label="Interactive three-dimensional sky"
        aria-describedby={instructionsId}
        onKeyDown={(event) => {
          const angularScale = clamp(fovRef.current / DEFAULT_FOV, 0.001, 1)
          const lookStep = (event.shiftKey ? KEYBOARD_LOOK_STEP_LARGE : KEYBOARD_LOOK_STEP) * angularScale
          let handled = true
          switch (event.key) {
            case 'ArrowLeft':
              yawRef.current -= lookStep
              break
            case 'ArrowRight':
              yawRef.current += lookStep
              break
            case 'ArrowUp':
              pitchRef.current = clamp(pitchRef.current + lookStep, MIN_PITCH, MAX_PITCH)
              break
            case 'ArrowDown':
              pitchRef.current = clamp(pitchRef.current - lookStep, MIN_PITCH, MAX_PITCH)
              break
            case '+':
            case '=':
            case 'Add':
              applyFov(fovRef.current * KEYBOARD_ZOOM_FACTOR)
              break
            case '-':
            case '_':
            case 'Subtract':
              applyFov(fovRef.current / KEYBOARD_ZOOM_FACTOR)
              break
            case 'Home':
            case '0':
              resetView()
              break
            default:
              handled = false
          }
          if (!handled) return
          event.preventDefault()
          if (event.key.startsWith('Arrow')) updateView()
        }}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) return
          event.currentTarget.focus({ preventScroll: true })
          event.currentTarget.setPointerCapture(event.pointerId)
          activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        }}
        onPointerMove={(event) => {
          const pointers = activePointersRef.current
          const previous = pointers.get(event.pointerId)
          if (!previous) return

          if (pointers.size === 1) {
            const angularScale = clamp(fovRef.current / DEFAULT_FOV, 0.001, 1)
            yawRef.current += (event.clientX - previous.x) * 0.0045 * angularScale
            pitchRef.current = clamp(
              pitchRef.current + (event.clientY - previous.y) * 0.004 * angularScale,
              MIN_PITCH,
              MAX_PITCH,
            )
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
            updateView()
            return
          }

          const pinchPointers = [...pointers.entries()].slice(0, 2)
          const previousDistance = pointerDistance(pinchPointers[0][1], pinchPointers[1][1])
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
          if (!pinchPointers.some(([pointerId]) => pointerId === event.pointerId)) return
          const nextPinchPointers = pinchPointers.map(([pointerId]) => pointers.get(pointerId)!)
          const nextDistance = pointerDistance(nextPinchPointers[0], nextPinchPointers[1])
          applyFov(fovRef.current * Math.exp(-(nextDistance - previousDistance) * PINCH_ZOOM_RATE))
        }}
        onPointerUp={(event) => {
          activePointersRef.current.delete(event.pointerId)
        }}
        onPointerCancel={(event) => {
          activePointersRef.current.delete(event.pointerId)
        }}
        onLostPointerCapture={(event) => {
          activePointersRef.current.delete(event.pointerId)
        }}
      />
      <span
        id={instructionsId}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        Drag with one pointer or use the arrow keys to look around. Hold Shift for larger arrow-key steps.
        Pinch with two pointers, scroll, or use plus and minus to zoom. Press Home or 0 to reset the view.
      </span>
    </>
  )
}

function rebuildStars(
  refs: SceneRefs,
  location: Location,
  date: Date,
  metrics: SkyMetrics,
  atmosphere: Atmosphere,
  seeing: SeeingConditions,
  glowField?: PhysicalGlowResult,
) {
  clearGroup(refs.starGroup)
  refs.starMaterial = undefined
  refs.starLabelBindings = []
  const positions: number[] = []
  const realisticColors: number[] = []
  const enhancedColors: number[] = []
  const visibilities: number[] = []
  const realisticSignals: number[] = []
  const enhancedSignals: number[] = []
  const psfSigmasArcsec: number[] = []
  const enhancedSigmasCss: number[] = []
  const realisticDispersions: number[] = []
  const enhancedDispersions: number[] = []
  const globalLightPenalty = directionalLightPenalty(glowField, metrics, atmosphere)

  for (const star of STAR_CATALOG) {
    const horizontal = equatorialToHorizontal(star.ra, star.dec, date, location)
    const vector = horizontalVector(horizontal.azimuth, horizontal.altitude, 102)
    const directionalLimit = glowField
      ? samplePhysicalGlow(glowField, horizontal.azimuth, horizontal.altitude).limitingMagnitude - globalLightPenalty
      : metrics.limitingMagnitude + directCloudExtinction(90, atmosphere)
    const appearance = starAppearance(star, horizontal.altitude, directionalLimit, atmosphere, seeing)
    const realistic = appearance.realistic
    const enhanced = appearance.enhanced
    positions.push(vector.x, vector.y, vector.z)
    realisticColors.push(realistic.color.r, realistic.color.g, realistic.color.b)
    enhancedColors.push(enhanced.color.r, enhanced.color.g, enhanced.color.b)
    visibilities.push(appearance.visibility)
    realisticSignals.push(appearance.physicalFlux)
    enhancedSignals.push(enhanced.signal)
    psfSigmasArcsec.push(...appearance.psf.sigmaArcsec)
    enhancedSigmasCss.push(enhanced.coreSigmaCssPixels)
    realisticDispersions.push(realistic.dispersionArcseconds)
    enhancedDispersions.push(enhanced.dispersionCssPixels)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aRealisticColor', new THREE.Float32BufferAttribute(realisticColors, 3))
  geometry.setAttribute('aEnhancedColor', new THREE.Float32BufferAttribute(enhancedColors, 3))
  geometry.setAttribute('aSignals', new THREE.Float32BufferAttribute(
    pairAttributes(realisticSignals, enhancedSignals),
    2,
  ))
  geometry.setAttribute('aVisibility', new THREE.Float32BufferAttribute(visibilities, 1))
  geometry.setAttribute('aPsfSigmaArcsec', new THREE.Float32BufferAttribute(psfSigmasArcsec, 3))
  geometry.setAttribute('aEnhancedSigmaCss', new THREE.Float32BufferAttribute(enhancedSigmasCss, 1))
  geometry.setAttribute('aDispersions', new THREE.Float32BufferAttribute(
    pairAttributes(realisticDispersions, enhancedDispersions),
    2,
  ))
  const material = makeStarMaterial(refs.renderer)
  refs.starMaterial = material
  refs.starGroup.add(new THREE.Points(geometry, material))

  for (const star of BRIGHT_STARS.filter((item) => item.mag < 1.65)) {
    const horizontal = equatorialToHorizontal(star.ra, star.dec, date, location)
    if (horizontal.altitude < 3) continue
    const localLimit = glowField
      ? samplePhysicalGlow(glowField, horizontal.azimuth, horizontal.altitude).limitingMagnitude - globalLightPenalty
      : metrics.limitingMagnitude + directCloudExtinction(90, atmosphere)
    if (apparentStarMagnitude(star, horizontal.altitude, atmosphere) >= localLimit) continue
    const vector = horizontalVector(horizontal.azimuth, horizontal.altitude, 96)
    const cloudTransmission = directCloudTransmission(horizontal.altitude, atmosphere)
    addPresentationLabel(
      refs.starGroup,
      refs.starLabelBindings,
      `${star.name}  ·  ${star.constellation}`,
      new THREE.Vector3(vector.x, vector.y + 1.4, vector.z),
      '#c9d0d5',
      '#a9cfff',
      0.58 * cloudTransmission,
      0.92 * cloudTransmission,
      5.7,
      7.2,
    )
  }
}

function rebuildMilkyWay(
  refs: SceneRefs,
  location: Location,
  date: Date,
  metrics: SkyMetrics,
  atmosphere: Atmosphere,
  glowField?: PhysicalGlowResult,
) {
  clearGroup(refs.milkyWayGroup)
  refs.milkyWayMaterial = undefined
  const globalLightPenalty = directionalLightPenalty(glowField, metrics, atmosphere)
  const positions: number[] = []
  const realisticColors: number[] = []
  const enhancedColors: number[] = []
  const realisticSizes: number[] = []
  const enhancedSizes: number[] = []
  const realisticOpacities: number[] = []
  const enhancedOpacities: number[] = []

  for (const point of MILKY_WAY_POINTS) {
    const equatorial = galacticToEquatorial(point.longitude, point.latitude)
    const horizontal = equatorialToHorizontal(equatorial.ra, equatorial.dec, date, location)
    const localLimit = glowField
      ? samplePhysicalGlow(glowField, horizontal.azimuth, horizontal.altitude).limitingMagnitude - globalLightPenalty
      : metrics.limitingMagnitude + directCloudExtinction(90, atmosphere)
    const cloudTransmission = directCloudTransmission(horizontal.altitude, atmosphere)
    const effectiveLimit = cloudAdjustedLimitingMagnitude(localLimit, horizontal.altitude, atmosphere)
    const visibility = clamp((effectiveLimit - 4.55) / 2.2, 0, 1)
    if (visibility < 0.025) continue
    const vector = horizontalVector(horizontal.azimuth, horizontal.altitude, 108)
    const physicalOpacity = point.intensity * visibility * cloudTransmission
    positions.push(vector.x, vector.y, vector.z)
    realisticColors.push(0.44, 0.47, 0.5)
    enhancedColors.push(0.55, 0.67, 0.8)
    realisticSizes.push(0.75 + point.intensity * 0.8)
    enhancedSizes.push(1.1 + point.intensity * 1.45)
    realisticOpacities.push(physicalOpacity * APPEARANCE_ENDPOINTS.realistic.milkyWayOpacity)
    enhancedOpacities.push(physicalOpacity * APPEARANCE_ENDPOINTS.enhanced.milkyWayOpacity)
  }
  if (!positions.length) return

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aRealisticColor', new THREE.Float32BufferAttribute(realisticColors, 3))
  geometry.setAttribute('aEnhancedColor', new THREE.Float32BufferAttribute(enhancedColors, 3))
  geometry.setAttribute('aRealisticSize', new THREE.Float32BufferAttribute(realisticSizes, 1))
  geometry.setAttribute('aEnhancedSize', new THREE.Float32BufferAttribute(enhancedSizes, 1))
  geometry.setAttribute('aRealisticOpacity', new THREE.Float32BufferAttribute(realisticOpacities, 1))
  geometry.setAttribute('aEnhancedOpacity', new THREE.Float32BufferAttribute(enhancedOpacities, 1))
  const material = makePointMaterial(refs.renderer, THREE.AdditiveBlending)
  refs.milkyWayMaterial = material
  refs.milkyWayGroup.add(new THREE.Points(geometry, material))
}

function rebuildDeepSky(
  refs: SceneRefs,
  location: Location,
  date: Date,
  metrics: SkyMetrics,
  atmosphere: Atmosphere,
  glowField?: PhysicalGlowResult,
) {
  clearGroup(refs.deepGroup)
  refs.deepBindings = []
  const globalLightPenalty = directionalLightPenalty(glowField, metrics, atmosphere)

  for (const object of DEEP_SKY) {
    const required = object.kind === 'cluster' ? object.mag - 0.6 : object.mag + 1.25
    const horizontal = equatorialToHorizontal(object.ra, object.dec, date, location)
    if (horizontal.altitude < 1) continue
    const localLimit = glowField
      ? samplePhysicalGlow(glowField, horizontal.azimuth, horizontal.altitude).limitingMagnitude - globalLightPenalty
      : metrics.limitingMagnitude + directCloudExtinction(90, atmosphere)
    const cloudTransmission = directCloudTransmission(horizontal.altitude, atmosphere)
    const effectiveLimit = cloudAdjustedLimitingMagnitude(localLimit, horizontal.altitude, atmosphere)
    if (effectiveLimit < required) continue

    const vector = horizontalVector(horizontal.azimuth, horizontal.altitude, 98)
    const position = new THREE.Vector3(vector.x, vector.y, vector.z)
    const realisticColor = '#d0d5d2'
    const enhancedColor = object.kind === 'nebula' ? '#80c6c2' : object.kind === 'galaxy' ? '#b1b9d9' : '#a8c7ff'
    const enhancedScale = clamp(object.size / 18, 1.5, 7)
    addEndpointOrbPair(
      refs.deepGroup,
      refs.deepBindings,
      position,
      {
        color: realisticColor,
        halo: 'rgba(214, 220, 218, .07)',
        scale: enhancedScale * 0.56,
        opacity: APPEARANCE_ENDPOINTS.realistic.deepSkyOpacity * cloudTransmission,
      },
      {
        color: enhancedColor,
        halo: 'rgba(117, 155, 214, .25)',
        scale: enhancedScale,
        opacity: APPEARANCE_ENDPOINTS.enhanced.deepSkyOpacity * cloudTransmission,
      },
    )

    if (effectiveLimit > 5.1 || object.mag < 4.2) {
      addPresentationLabel(
        refs.deepGroup,
        refs.deepBindings,
        `${object.catalog}  ${object.name}`,
        new THREE.Vector3(vector.x, vector.y + 1.5, vector.z),
        realisticColor,
        enhancedColor,
        0.52 * cloudTransmission,
        0.92 * cloudTransmission,
        5.4,
        7.2,
      )
    }
  }
}

function rebuildSolarSystem(
  refs: SceneRefs,
  objects: HorizontalObject[],
  metrics: SkyMetrics,
  atmosphere: Atmosphere,
  glowField?: PhysicalGlowResult,
) {
  clearGroup(refs.planetGroup)
  refs.planetBindings = []
  const globalLightPenalty = directionalLightPenalty(glowField, metrics, atmosphere)

  for (const object of objects) {
    const angularRadius = (object.angularDiameter ?? 0) / 2
    if (object.altitude < -Math.max(0.05, angularRadius)) continue
    const localLimit = glowField
      ? samplePhysicalGlow(glowField, object.azimuth, object.altitude).limitingMagnitude - globalLightPenalty
      : metrics.limitingMagnitude + directCloudExtinction(90, atmosphere)
    const cloudTransmission = directCloudTransmission(object.altitude, atmosphere)
    const effectiveLimit = cloudAdjustedLimitingMagnitude(localLimit, object.altitude, atmosphere)
    if (object.kind === 'planet' && object.magnitude > effectiveLimit) continue

    const vector = horizontalVector(object.azimuth, object.altitude, 92)
    const position = new THREE.Vector3(vector.x, vector.y, vector.z)
    const style = planetStyle(object.name)
    const enhancedScale = object.kind === 'sun'
      ? 8
      : object.kind === 'moon'
        ? 5.5
        : clamp(4.3 - object.magnitude * 0.35, 2.1, 5.5)
    const realisticScale = object.kind === 'sun' || object.kind === 'moon'
      ? angularSpriteScale(object.angularDiameter ?? 0.535, 92)
      : clamp(0.5 - object.magnitude * 0.045, 0.27, 0.72)
    const transmission = clearAirTransmissionRgb(object.altitude, atmosphere)
    const transmissionLuminance = transmission[0] * 0.2126 + transmission[1] * 0.7152 + transmission[2] * 0.0722
    const clearAirOpacity = clamp(Math.sqrt(transmissionLuminance) * 1.4, 0.03, 1)
    const realisticOpacity = APPEARANCE_ENDPOINTS.realistic.planetOpacity * cloudTransmission * clearAirOpacity
    const enhancedOpacity = APPEARANCE_ENDPOINTS.enhanced.planetOpacity * cloudTransmission
    const realisticColor = transmittedColor(subduedColor(style.color), transmission)

    if (object.kind === 'sun') {
      const realisticSun = makeSunOrb(1, realisticColor, 1)
      const enhancedSun = makeOrb(style.color, style.halo)
      addEndpointSpritePair(
        refs.planetGroup,
        refs.planetBindings,
        position,
        realisticSun,
        enhancedSun,
        realisticScale,
        enhancedScale,
        clamp(realisticOpacity * 1.6, 0, 1),
        enhancedOpacity,
      )
      const realisticHalo = makeGlowOrb('#ffad55', 1, 1)
      const enhancedHalo = makeGlowOrb('#ffc66f', 1, 1)
      addEndpointSpritePair(
        refs.planetGroup,
        refs.planetBindings,
        position,
        realisticHalo,
        enhancedHalo,
        angularSpriteScale(2.2 + atmosphere.aerosol * 9 + atmosphere.humidity * 2.5, 92),
        angularSpriteScale(8 + atmosphere.aerosol * 14, 92),
        cloudTransmission * clamp(0.035 + atmosphere.aerosol * 0.2 + atmosphere.humidity * 0.06, 0.02, 0.32),
        cloudTransmission * 0.3,
      )
    } else if (object.kind === 'moon') {
      const realisticMoon = makeMoonOrb(object.phase ?? 0, object.waxing ?? true, 1, 1)
      realisticMoon.material.color.set(transmittedColor('#ffffff', transmission))
      const enhancedMoon = makeOrb(style.color, style.halo)
      addEndpointSpritePair(
        refs.planetGroup,
        refs.planetBindings,
        position,
        realisticMoon,
        enhancedMoon,
        realisticScale,
        enhancedScale,
        realisticOpacity,
        enhancedOpacity,
      )
      const realisticHalo = makeGlowOrb('#cbdcff', 1, 1)
      const enhancedHalo = makeGlowOrb('#b6c9ff', 1, 1)
      addEndpointSpritePair(
        refs.planetGroup,
        refs.planetBindings,
        position,
        realisticHalo,
        enhancedHalo,
        angularSpriteScale(1.6, 92),
        angularSpriteScale(4.5, 92),
        cloudTransmission * clamp(0.008 + atmosphere.aerosol * 0.035 + atmosphere.humidity * 0.02, 0.005, 0.08),
        cloudTransmission * 0.12,
      )
    } else {
      addEndpointOrbPair(
        refs.planetGroup,
        refs.planetBindings,
        position,
        {
          color: realisticColor,
          halo: 'rgba(255, 255, 255, .09)',
          scale: realisticScale,
          opacity: realisticOpacity,
        },
        {
          color: style.color,
          halo: style.halo,
          scale: enhancedScale,
          opacity: enhancedOpacity,
        },
      )
    }

    addPresentationLabel(
      refs.planetGroup,
      refs.planetBindings,
      `${object.name}${object.kind === 'moon' ? `  ${Math.round((object.phase ?? 0) * 100)}%` : ''}`,
      position,
      realisticColor,
      style.color,
      0.62 * cloudTransmission,
      0.92 * cloudTransmission,
      5.8,
      7.2,
      vector.y + realisticScale * 0.45,
      vector.y + enhancedScale * 0.45,
    )
  }
}

function rebuildPhysicalGlows(
  refs: SceneRefs,
  field: PhysicalGlowResult | undefined,
  sun: HorizontalObject | undefined,
  moon: HorizontalObject | undefined,
  moonLight: number,
  atmosphere: Atmosphere,
) {
  clearGroup(refs.glowGroup)
  refs.glowMaterial = undefined
  if (!field?.rgbRadiance.length) return

  const realisticField = buildPhysicalGlowRenderGrid({
    azimuthCount: field.azimuthCount,
    elevationDeg: field.elevationDeg,
    rgbRadiance: realisticGlowRgb(field),
  })
  const enhancedField = buildPhysicalGlowRenderGrid(field)
  const altitudes = enhancedField.elevationDeg
  const positions: number[] = []
  const realisticRadiance: number[] = []
  const enhancedRadiance: number[] = []
  const indices: number[] = []
  const sampleCount = field.azimuthCount

  for (let index = 0; index <= sampleCount; index += 1) {
    const bearing = field.azimuthOffsetDeg + (index / sampleCount) * 360
    const sourceBearing = index % sampleCount
    for (let level = 0; level < altitudes.length; level += 1) {
      const altitude = altitudes[level]
      const position = horizontalVector(bearing, altitude, 86)
      const source = (level * sampleCount + sourceBearing) * 3
      positions.push(position.x, position.y, position.z)
      realisticRadiance.push(
        realisticField.rgbRadiance[source],
        realisticField.rgbRadiance[source + 1],
        realisticField.rgbRadiance[source + 2],
      )
      enhancedRadiance.push(
        enhancedField.rgbRadiance[source],
        enhancedField.rgbRadiance[source + 1],
        enhancedField.rgbRadiance[source + 2],
      )
    }
  }

  const rowSize = altitudes.length
  for (let bearing = 0; bearing < sampleCount; bearing += 1) {
    for (let level = 0; level < rowSize - 1; level += 1) {
      const lowerLeft = bearing * rowSize + level
      const upperLeft = lowerLeft + 1
      const lowerRight = (bearing + 1) * rowSize + level
      const upperRight = lowerRight + 1
      indices.push(lowerLeft, lowerRight, upperLeft, upperLeft, lowerRight, upperRight)
    }
  }

  const sunDirection = horizontalUnitVector(sun?.azimuth ?? 0, sun?.altitude ?? -90)
  const moonDirection = horizontalUnitVector(moon?.azimuth ?? 0, moon?.altitude ?? -90)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aRealisticRadiance', new THREE.Float32BufferAttribute(realisticRadiance, 3))
  geometry.setAttribute('aEnhancedRadiance', new THREE.Float32BufferAttribute(enhancedRadiance, 3))
  geometry.setIndex(indices)
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uExposure: { value: 32 },
      uEnhancement: { value: refs.latestEnhancement },
      uSunAltitude: { value: sun?.altitude ?? -30 },
      uSunDirection: { value: new THREE.Vector3(...sunDirection) },
      uMoonDirection: { value: new THREE.Vector3(...moonDirection) },
      uMoonLight: { value: moonLight },
      uAerosol: { value: atmosphere.aerosol },
      uHumidity: { value: atmosphere.humidity },
    },
    vertexShader: `
      attribute vec3 aRealisticRadiance;
      attribute vec3 aEnhancedRadiance;
      varying vec3 vRealisticRadiance;
      varying vec3 vEnhancedRadiance;
      varying vec3 vDirection;
      void main() {
        vRealisticRadiance = aRealisticRadiance;
        vEnhancedRadiance = aEnhancedRadiance;
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vRealisticRadiance;
      varying vec3 vEnhancedRadiance;
      varying vec3 vDirection;
      uniform float uExposure;
      uniform float uEnhancement;
      uniform float uSunAltitude;
      uniform vec3 uSunDirection;
      uniform vec3 uMoonDirection;
      uniform float uMoonLight;
      uniform float uAerosol;
      uniform float uHumidity;
      ${realisticSkyResponseShader}
      void main() {
        vec3 enhancedMapped = vec3(1.0) - exp(-max(vEnhancedRadiance, vec3(0.0)) * uExposure);
        vec3 base = realisticBaseRadiance(
          normalize(vDirection),
          normalize(uSunDirection),
          normalize(uMoonDirection),
          uSunAltitude,
          uMoonLight,
          uAerosol,
          uHumidity
        );
        vec3 realisticDelta = max(
          realisticSkyTone(base + max(vRealisticRadiance, vec3(0.0))) - realisticSkyTone(base),
          vec3(0.0)
        );
        vec4 realisticOutput = vec4(realisticDelta, 1.0);
        vec4 enhancedOutput = vec4(enhancedMapped, .82);
        gl_FragColor = mix(realisticOutput, enhancedOutput, uEnhancement);
      }
    `,
  })
  refs.glowMaterial = material
  refs.glowGroup.add(new THREE.Mesh(geometry, material))
}

function directionalLightPenalty(
  field: PhysicalGlowResult | undefined,
  metrics: SkyMetrics,
  atmosphere: Atmosphere,
) {
  if (!field) return 0
  return Math.max(
    0,
    physicalZenithSample(field).limitingMagnitude
      - metrics.limitingMagnitude
      - directCloudExtinction(90, atmosphere),
  )
}

function applyPresentation(refs: SceneRefs, skyEnhancement: number) {
  const enhancement = normalizeEnhancement(skyEnhancement)
  refs.latestEnhancement = enhancement
  refs.skyMaterial.uniforms.uEnhancement.value = enhancement
  if (refs.starMaterial) refs.starMaterial.uniforms.uEnhancement.value = enhancement
  if (refs.milkyWayMaterial) refs.milkyWayMaterial.uniforms.uEnhancement.value = enhancement
  if (refs.glowMaterial) refs.glowMaterial.uniforms.uEnhancement.value = enhancement
  applySpriteBindings(refs.starLabelBindings, enhancement)
  applySpriteBindings(refs.deepBindings, enhancement)
  applySpriteBindings(refs.planetBindings, enhancement)
}

function applySpriteBindings(bindings: SpritePresentationBinding[], enhancement: number) {
  for (const binding of bindings) {
    binding.material.opacity = interpolateAppearanceValue(
      binding.realisticOpacity,
      binding.enhancedOpacity,
      enhancement,
    )
    binding.sprite.scale.set(
      interpolateAppearanceValue(binding.realisticScaleX, binding.enhancedScaleX, enhancement),
      interpolateAppearanceValue(binding.realisticScaleY, binding.enhancedScaleY, enhancement),
      1,
    )
    if (binding.realisticColor && binding.enhancedColor) {
      binding.material.color.setRGB(
        interpolateAppearanceValue(binding.realisticColor.r, binding.enhancedColor.r, enhancement),
        interpolateAppearanceValue(binding.realisticColor.g, binding.enhancedColor.g, enhancement),
        interpolateAppearanceValue(binding.realisticColor.b, binding.enhancedColor.b, enhancement),
      )
    }
    if (binding.realisticY != null && binding.enhancedY != null) {
      binding.sprite.position.y = interpolateAppearanceValue(binding.realisticY, binding.enhancedY, enhancement)
    }
  }
}

function makePointMaterial(
  renderer: THREE.WebGLRenderer,
  blending: THREE.Blending = THREE.NormalBlending,
) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending,
    uniforms: {
      uPixelRatio: { value: renderer.getPixelRatio() },
      uEnhancement: { value: 0 },
    },
    vertexShader: pointVertexShader,
    fragmentShader: pointFragmentShader,
  })
}

function refreshRendererSize(refs: SceneRefs) {
  const rect = refs.renderer.domElement.getBoundingClientRect()
  const width = Math.max(1, rect.width)
  const height = Math.max(1, rect.height)
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
  if (refs.renderer.getPixelRatio() !== pixelRatio) refs.renderer.setPixelRatio(pixelRatio)
  refs.renderer.setSize(width, height, false)
  refs.camera.aspect = width / height
  refs.camera.updateProjectionMatrix()
  updatePointMaterialResolution(refs)
}

function applyCameraFov(refs: SceneRefs, nextFov: number) {
  const fov = clamp(nextFov, MIN_FOV, MAX_FOV)
  refs.camera.fov = fov
  refs.camera.updateProjectionMatrix()
  updatePointMaterialResolution(refs)
  return fov
}

function updatePointMaterialResolution(refs: SceneRefs) {
  const pixelRatio = refs.renderer.getPixelRatio()
  const pixelsPerArcsecond = getCssPixelsPerArcsecond(refs)
  for (const group of [refs.starGroup, refs.milkyWayGroup]) {
    group.traverse((object) => {
      if (!(object instanceof THREE.Points)) return
      const material = object.material
      if (!(material instanceof THREE.ShaderMaterial)) return
      if (material.uniforms.uPixelRatio) material.uniforms.uPixelRatio.value = pixelRatio
      if (material.uniforms.uPixelsPerArcsecond) material.uniforms.uPixelsPerArcsecond.value = pixelsPerArcsecond
    })
  }
}

function getCssPixelsPerArcsecond(refs: SceneRefs) {
  const cssHeight = Math.max(1, refs.renderer.domElement.getBoundingClientRect().height)
  return cssHeight / Math.max(1, refs.camera.fov * 3600)
}

function pointerDistance(first: ActivePointer, second: ActivePointer) {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function pairAttributes(first: number[], second: number[]) {
  const paired = new Float32Array(first.length * 2)
  for (let index = 0; index < first.length; index += 1) {
    paired[index * 2] = first[index]
    paired[index * 2 + 1] = second[index]
  }
  return paired
}

function makeStarMaterial(renderer: THREE.WebGLRenderer) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uPixelRatio: { value: renderer.getPixelRatio() },
      uEnhancement: { value: 0 },
      uRealisticStarGain: { value: REALISTIC_APPEARANCE_PROFILE.starDisplayGain },
      uPixelsPerArcsecond: { value: 0.0036 },
    },
    vertexShader: starVertexShader,
    fragmentShader: starFragmentShader,
  })
}

function addPresentationLabel(
  group: THREE.Group,
  bindings: SpritePresentationBinding[],
  text: string,
  position: THREE.Vector3,
  realisticColor: string,
  enhancedColor: string,
  realisticOpacity: number,
  enhancedOpacity: number,
  realisticScale: number,
  enhancedScale: number,
  realisticY?: number,
  enhancedY?: number,
) {
  const { texture, aspect } = createLabelTexture(text, '#ffffff')
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: realisticColor,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.position.copy(position)
  group.add(sprite)
  bindings.push({
    sprite,
    material,
    realisticOpacity,
    enhancedOpacity,
    realisticScaleX: realisticScale * aspect,
    realisticScaleY: realisticScale,
    enhancedScaleX: enhancedScale * aspect,
    enhancedScaleY: enhancedScale,
    realisticColor: new THREE.Color(realisticColor),
    enhancedColor: new THREE.Color(enhancedColor),
    realisticY,
    enhancedY,
  })
}

type OrbEndpoint = {
  color: string
  halo: string
  scale: number
  opacity: number
}

function addEndpointOrbPair(
  group: THREE.Group,
  bindings: SpritePresentationBinding[],
  position: THREE.Vector3,
  realistic: OrbEndpoint,
  enhanced: OrbEndpoint,
) {
  addEndpointSpritePair(
    group,
    bindings,
    position,
    makeOrb(realistic.color, realistic.halo),
    makeOrb(enhanced.color, enhanced.halo),
    realistic.scale,
    enhanced.scale,
    realistic.opacity,
    enhanced.opacity,
  )
}

function addEndpointSpritePair(
  group: THREE.Group,
  bindings: SpritePresentationBinding[],
  position: THREE.Vector3,
  realisticSprite: THREE.Sprite,
  enhancedSprite: THREE.Sprite,
  realisticScale: number,
  enhancedScale: number,
  realisticOpacity: number,
  enhancedOpacity: number,
) {
  realisticSprite.position.copy(position)
  enhancedSprite.position.copy(position)
  group.add(realisticSprite, enhancedSprite)
  bindings.push(
    {
      sprite: realisticSprite,
      material: realisticSprite.material,
      realisticOpacity,
      enhancedOpacity: 0,
      realisticScaleX: realisticScale,
      realisticScaleY: realisticScale,
      enhancedScaleX: realisticScale,
      enhancedScaleY: realisticScale,
    },
    {
      sprite: enhancedSprite,
      material: enhancedSprite.material,
      realisticOpacity: 0,
      enhancedOpacity,
      realisticScaleX: enhancedScale,
      realisticScaleY: enhancedScale,
      enhancedScaleX: enhancedScale,
      enhancedScaleY: enhancedScale,
    },
  )
}

function makeOrb(color: string, halo: string, scale = 1, opacity = 1) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createOrbTexture(color, halo),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    opacity,
  }))
  sprite.scale.set(scale, scale, 1)
  return sprite
}

function makeMoonOrb(phase: number, waxing = true, scale = 1, opacity = 1) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createMoonTexture(phase, waxing),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity,
  }))
  sprite.scale.set(scale, scale, 1)
  return sprite
}

function makeSunOrb(scale = 1, color = '#ffffff', opacity = 1) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createSunTexture(),
    color,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity,
  }))
  sprite.scale.set(scale, scale, 1)
  return sprite
}

function makeGlowOrb(color: string, scale = 1, opacity = 1) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createGlowTexture(),
    color,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    opacity,
  }))
  sprite.scale.set(scale, scale, 1)
  return sprite
}

function transmittedColor(color: string, transmission: readonly [number, number, number]) {
  const transmitted = new THREE.Color(color)
  transmitted.r *= transmission[0]
  transmitted.g *= transmission[1]
  transmitted.b *= transmission[2]
  const peak = Math.max(transmitted.r, transmitted.g, transmitted.b)
  if (peak > 0) transmitted.multiplyScalar(1 / peak)
  return `#${transmitted.getHexString()}`
}

function subduedColor(color: string) {
  return `#${new THREE.Color(color).lerp(new THREE.Color('#d9dddf'), 0.68).getHexString()}`
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

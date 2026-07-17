'use client'

import { useEffect, useRef, useState } from 'react'
import type { CustomLayerInterface, Map as MapLibreMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export default function GlobeProbe() {
  const container = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (!container.current) return
    let map: MapLibreMap | undefined
    let disposed = false

    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (disposed || !container.current) return
      map = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {},
          layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#030812' } }],
        },
        center: [21.01, 52.01],
        zoom: 1.6,
        attributionControl: false,
        renderWorldCopies: false,
      })
      map.on('error', ({ error }) => setStatus(`error: ${error.message}`))
      map.once('style.load', () => {
        map?.setProjection({ type: 'globe' })
        map?.addLayer(createSyntheticLayer())
        setStatus('ready')
      })
    })

    return () => {
      disposed = true
      map?.remove()
    }
  }, [])

  return (
    <section className="probe-card" aria-label="MapLibre globe feasibility probe">
      <div ref={container} className="globe-canvas" />
      <p role="status">MapLibre custom layer: {status}</p>
    </section>
  )
}

function createSyntheticLayer(): CustomLayerInterface {
  let program: WebGLProgram | null = null
  let buffer: WebGLBuffer | null = null
  return {
    id: 'synthetic-emission-conformance-layer',
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      if (!(gl instanceof WebGL2RenderingContext)) throw new Error('The M1 globe probe requires WebGL2')
      const vertex = compile(gl, gl.VERTEX_SHADER, `#version 300 es
        in vec2 position;
        void main() { gl_Position = vec4(position, 0.0, 1.0); }
      `)
      const fragment = compile(gl, gl.FRAGMENT_SHADER, `#version 300 es
        precision highp float;
        out vec4 color;
        void main() { color = vec4(1.0, 0.35, 0.08, 0.42); }
      `)
      program = gl.createProgram()
      buffer = gl.createBuffer()
      if (!program || !buffer) throw new Error('Unable to allocate synthetic custom layer')
      gl.attachShader(program, vertex)
      gl.attachShader(program, fragment)
      gl.linkProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(String(gl.getProgramInfoLog(program)))
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.08, -0.08, 0.08, -0.08, 0, 0.1]), gl.STATIC_DRAW)
    },
    render(gl) {
      if (!program || !buffer) return
      gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      const position = gl.getAttribLocation(program, 'position')
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    onRemove(_map, gl) {
      if (buffer) gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
      buffer = null
      program = null
    },
  }
}

function compile(gl: WebGL2RenderingContext, kind: number, source: string) {
  const shader = gl.createShader(kind)
  if (!shader) throw new Error('Unable to allocate shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(String(gl.getShaderInfoLog(shader)))
  return shader
}

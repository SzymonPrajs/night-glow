'use client'

import { useEffect, useRef, useState } from 'react'

export default function ObserverProbe() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const gl = canvas.current?.getContext('webgl2')
    if (!gl) {
      setStatus('unsupported')
      return
    }
    gl.clearColor(0.004, 0.01, 0.025, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    setStatus('ready')
    return () => {
      const loseContext = gl.getExtension('WEBGL_lose_context')
      loseContext?.loseContext()
    }
  }, [])

  return (
    <section className="probe-card" aria-label="Observer WebGL2 feasibility probe">
      <canvas ref={canvas} width="960" height="540" />
      <p role="status">Observer WebGL2 engine: {status}</p>
    </section>
  )
}

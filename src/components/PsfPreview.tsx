import { useEffect, useMemo, useRef } from 'react'
import { gaussianPsf, seeingPsf } from '../lib/seeing'
import type { SeeingConditions } from '../types'

type PsfPreviewProps = {
  seeing: SeeingConditions
  altitudeDeg: number
}

const PREVIEW_WIDTH = 132
const PREVIEW_HEIGHT = 92

export default function PsfPreview({ seeing, altitudeDeg }: PsfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const psf = useMemo(() => seeingPsf(seeing, altitudeDeg), [seeing, altitudeDeg])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = PREVIEW_WIDTH * pixelRatio
    canvas.height = PREVIEW_HEIGHT * pixelRatio
    const image = context.createImageData(canvas.width, canvas.height)
    const maximumSigma = Math.max(...psf.sigmaArcsec)
    const halfExtentArcsec = maximumSigma * 4.6
    const channelPeaks = psf.sigmaArcsec.map((sigma) => gaussianPsf(0, sigma))

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const xArcsec = (x / (canvas.width - 1) * 2 - 1) * halfExtentArcsec
        const yArcsec = (y / (canvas.height - 1) * 2 - 1) * halfExtentArcsec * PREVIEW_HEIGHT / PREVIEW_WIDTH
        const radius = Math.hypot(xArcsec, yArcsec)
        const values = psf.sigmaArcsec.map((sigma, channel) => (
          gaussianPsf(radius, sigma) / channelPeaks[channel]
        ))
        const intensity = Math.max(...values)
        const offset = (y * canvas.width + x) * 4
        image.data[offset] = Math.round(255 * values[0] ** 0.44)
        image.data[offset + 1] = Math.round(255 * values[1] ** 0.44)
        image.data[offset + 2] = Math.round(255 * values[2] ** 0.44)
        image.data[offset + 3] = Math.round(255 * Math.min(1, intensity ** 0.55))
      }
    }
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.putImageData(image, 0, 0)
  }, [psf])

  return (
    <section className="psf-preview" aria-labelledby="psf-preview-heading">
      <div className="psf-preview-heading">
        <span id="psf-preview-heading">Current Gaussian PSF</span>
        <strong>{psf.referenceFwhmArcsec.toFixed(2)}″ FWHM</strong>
      </div>
      <div className="psf-preview-body">
        <div className="psf-preview-image">
          <canvas
            ref={canvasRef}
            width={PREVIEW_WIDTH}
            height={PREVIEW_HEIGHT}
            aria-label={`Magnified Gaussian stellar point-spread function, ${psf.referenceFwhmArcsec.toFixed(2)} arcseconds FWHM`}
            data-psf-fwhm={psf.referenceFwhmArcsec.toFixed(4)}
          />
          <span>Angular profile · magnified</span>
        </div>
        <dl>
          <div><dt>View altitude</dt><dd>{Math.round(psf.altitudeDeg)}°</dd></div>
          <div><dt>Air mass</dt><dd>{psf.airMass.toFixed(2)}×</dd></div>
          <div><dt>Fried r₀</dt><dd>{psf.friedParameterCm.toFixed(1)} cm</dd></div>
          <div><dt>Coherence τ₀</dt><dd>{psf.coherenceTimeMs.toFixed(1)} ms</dd></div>
        </dl>
      </div>
      <p>Unit-integral PSF: worse seeing broadens and lowers the peak without creating or removing stellar flux.</p>
    </section>
  )
}

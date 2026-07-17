import { useId } from 'react'
import { Sparkles } from 'lucide-react'

type SkyPresentationControlProps = {
  value: number
  onChange: (value: number) => void
}

export default function SkyPresentationControl({ value, onChange }: SkyPresentationControlProps) {
  const inputId = useId()
  const noteId = useId()
  const percent = Math.round(Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0)) * 100)
  const valueText = percent === 0
    ? 'Realistic; presentation only; physical calculations unchanged'
    : percent === 100
      ? 'Enhanced; presentation only; physical calculations unchanged'
      : `${percent} percent enhanced; presentation only; physical calculations unchanged`

  return (
    <section
      className="presentation-control"
      aria-labelledby={`${inputId}-label`}
      title="Presentation only; the physical sky calculation and visibility remain unchanged"
    >
      <div className="presentation-heading">
        <span id={`${inputId}-label`}><Sparkles size={14} aria-hidden="true" /> Presentation</span>
        <strong>{percent}%</strong>
      </div>
      <label className="presentation-range" htmlFor={inputId}>
        <span>Realistic</span>
        <input
          id={inputId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          aria-label="Sky presentation, Realistic to Enhanced"
          aria-describedby={noteId}
          aria-valuetext={valueText}
          onChange={(event) => onChange(Number(event.target.value) / 100)}
          style={{ '--presentation-progress': `${percent}%` } as React.CSSProperties}
        />
        <span>Enhanced</span>
      </label>
      <p className="sr-only" id={noteId}>Presentation only · physical sky unchanged</p>
    </section>
  )
}

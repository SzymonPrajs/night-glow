import { Cloud, CloudFog, Droplets, Sparkles, Wind } from 'lucide-react'
import type { Atmosphere } from '../types'

type SettingsPanelProps = {
  atmosphere: Atmosphere
  onChange: (atmosphere: Atmosphere) => void
}

const PRESETS: Array<{ name: string; values: Atmosphere }> = [
  { name: 'Crisp', values: { aerosol: 0.12, humidity: 0.22, cloud: 0, cloudBase: 8 } },
  { name: 'Humid', values: { aerosol: 0.48, humidity: 0.82, cloud: 0.16, cloudBase: 4.6 } },
  { name: 'Low cloud', values: { aerosol: 0.55, humidity: 0.88, cloud: 0.72, cloudBase: 1.2 } },
]

export default function SettingsPanel({ atmosphere, onChange }: SettingsPanelProps) {
  const set = (key: keyof Atmosphere, value: number) => onChange({ ...atmosphere, [key]: value })
  return (
    <>
      <div className="preset-row" aria-label="Weather presets">
        {PRESETS.map((preset) => {
          const active = Math.abs(atmosphere.aerosol - preset.values.aerosol) < 0.01 &&
            Math.abs(atmosphere.cloud - preset.values.cloud) < 0.01
          return (
            <button key={preset.name} className={active ? 'preset active' : 'preset'} onClick={() => onChange(preset.values)}>
              {preset.name}
            </button>
          )
        })}
      </div>

      <div className="sliders">
        <Slider
          icon={<Wind size={15} />}
          label="Aerosol haze"
          value={atmosphere.aerosol}
          display={`${Math.round(atmosphere.aerosol * 100)}%`}
          min={0}
          max={1}
          step={0.01}
          onChange={(value) => set('aerosol', value)}
        />
        <Slider
          icon={<Droplets size={15} />}
          label="Humidity"
          value={atmosphere.humidity}
          display={`${Math.round(atmosphere.humidity * 100)}%`}
          min={0}
          max={1}
          step={0.01}
          onChange={(value) => set('humidity', value)}
        />
        <Slider
          icon={<Cloud size={15} />}
          label="Cloud cover"
          value={atmosphere.cloud}
          display={`${Math.round(atmosphere.cloud * 100)}%`}
          min={0}
          max={1}
          step={0.01}
          onChange={(value) => set('cloud', value)}
        />
        <Slider
          icon={<CloudFog size={15} />}
          label="Cloud base"
          value={atmosphere.cloudBase}
          display={`${atmosphere.cloudBase.toFixed(1)} km`}
          min={0.3}
          max={10}
          step={0.1}
          onChange={(value) => set('cloudBase', value)}
        />
      </div>

      <div className="model-note">
        <Sparkles size={15} />
        <span>Low clouds amplify nearby glow; haze and humidity spread it higher across the dome.</span>
      </div>
    </>
  )
}

type SliderProps = {
  icon: React.ReactNode
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

function Slider({ icon, label, value, display, min, max, step, onChange }: SliderProps) {
  const id = `setting-${label.toLowerCase().replace(' ', '-')}`
  return (
    <label className="slider-control" htmlFor={id}>
      <span className="slider-label"><span>{icon}{label}</span><strong>{display}</strong></span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--range-progress': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
      />
    </label>
  )
}

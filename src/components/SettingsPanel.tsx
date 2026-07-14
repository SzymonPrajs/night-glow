import { Activity, Cloud, CloudFog, Droplets, Gauge, Layers3, MountainSnow, Sparkles, SunMedium, Wind } from 'lucide-react'
import type { AppearanceMode, Atmosphere } from '../types'

type SettingsPanelProps = {
  atmosphere: Atmosphere
  appearanceMode: AppearanceMode
  onAppearanceModeChange: (mode: AppearanceMode) => void
  onChange: (atmosphere: Atmosphere) => void
}

const APPEARANCE_MODES: ReadonlyArray<{
  mode: AppearanceMode
  label: string
  description: string
}> = [
  { mode: 'realistic', label: 'Realistic', description: 'Natural brightness and low-light colour' },
  { mode: 'atlas', label: 'Atlas', description: 'Enhanced visibility and object colour' },
]

const PRESETS: Array<{ name: string; values: Atmosphere }> = [
  {
    name: 'Crisp',
    values: {
      aerosol: 0.04, humidity: 0.28, cloud: 0, cloudBase: 8, angstromExponent: 1.5,
      aerosolScaleHeightKm: 1.2, aerosolSingleScatteringAlbedo: 0.91, aerosolAsymmetry: 0.62,
      cloudThicknessKm: 1.5, cloudOpticalDepth: 4, groundAlbedo: 0.13, maxScatteringOrder: 2,
    },
  },
  {
    name: 'Humid',
    values: {
      aerosol: 0.22, humidity: 0.82, cloud: 0.12, cloudBase: 4.6, angstromExponent: 1.15,
      aerosolScaleHeightKm: 1.8, aerosolSingleScatteringAlbedo: 0.94, aerosolAsymmetry: 0.74,
      cloudThicknessKm: 2.2, cloudOpticalDepth: 7, groundAlbedo: 0.15, maxScatteringOrder: 4,
    },
  },
  {
    name: 'Low cloud',
    values: {
      aerosol: 0.3, humidity: 0.9, cloud: 0.78, cloudBase: 0.8, angstromExponent: 0.9,
      aerosolScaleHeightKm: 0.75, aerosolSingleScatteringAlbedo: 0.96, aerosolAsymmetry: 0.8,
      cloudThicknessKm: 1.3, cloudOpticalDepth: 28, groundAlbedo: 0.16, maxScatteringOrder: 5,
    },
  },
]

export default function SettingsPanel({
  atmosphere,
  appearanceMode,
  onAppearanceModeChange,
  onChange,
}: SettingsPanelProps) {
  const set = (key: keyof Atmosphere, value: number) => onChange({ ...atmosphere, [key]: value })
  return (
    <>
      <fieldset className="appearance-control">
        <legend>Sky appearance</legend>
        <div className="appearance-options">
          {APPEARANCE_MODES.map(({ mode, label, description }) => (
            <label className="appearance-option" key={mode}>
              <input
                type="radio"
                name="sky-appearance"
                value={mode}
                checked={appearanceMode === mode}
                onChange={() => onAppearanceModeChange(mode)}
              />
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

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
          label="Reference AOD (550 nm)"
          value={atmosphere.aerosol}
          display={atmosphere.aerosol.toFixed(2)}
          min={0.02}
          max={0.8}
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

        <div className="settings-section"><span>Particle optics</span><i /></div>
        <Slider
          icon={<Activity size={15} />}
          label="Ångström exponent"
          value={atmosphere.angstromExponent}
          display={atmosphere.angstromExponent.toFixed(2)}
          min={0}
          max={2.5}
          step={0.05}
          onChange={(value) => set('angstromExponent', value)}
        />
        <Slider
          icon={<Layers3 size={15} />}
          label="Aerosol scale height"
          value={atmosphere.aerosolScaleHeightKm}
          display={`${atmosphere.aerosolScaleHeightKm.toFixed(1)} km`}
          min={0.3}
          max={4}
          step={0.1}
          onChange={(value) => set('aerosolScaleHeightKm', value)}
        />
        <Slider
          icon={<SunMedium size={15} />}
          label="Single-scatter albedo"
          value={atmosphere.aerosolSingleScatteringAlbedo}
          display={atmosphere.aerosolSingleScatteringAlbedo.toFixed(2)}
          min={0.7}
          max={1}
          step={0.01}
          onChange={(value) => set('aerosolSingleScatteringAlbedo', value)}
        />
        <Slider
          icon={<Gauge size={15} />}
          label="Forward asymmetry"
          value={atmosphere.aerosolAsymmetry}
          display={atmosphere.aerosolAsymmetry.toFixed(2)}
          min={0.45}
          max={0.9}
          step={0.01}
          onChange={(value) => set('aerosolAsymmetry', value)}
        />

        <div className="settings-section"><span>Cloud & surface</span><i /></div>
        <Slider
          icon={<CloudFog size={15} />}
          label="Cloud thickness"
          value={atmosphere.cloudThicknessKm}
          display={`${atmosphere.cloudThicknessKm.toFixed(1)} km`}
          min={0.2}
          max={8}
          step={0.1}
          onChange={(value) => set('cloudThicknessKm', value)}
        />
        <Slider
          icon={<Cloud size={15} />}
          label="Cloud optical depth"
          value={atmosphere.cloudOpticalDepth}
          display={atmosphere.cloudOpticalDepth.toFixed(0)}
          min={0}
          max={80}
          step={1}
          onChange={(value) => set('cloudOpticalDepth', value)}
        />
        <Slider
          icon={<MountainSnow size={15} />}
          label="Ground albedo"
          value={atmosphere.groundAlbedo}
          display={atmosphere.groundAlbedo.toFixed(2)}
          min={0.04}
          max={0.85}
          step={0.01}
          onChange={(value) => set('groundAlbedo', value)}
        />
        <Slider
          icon={<Layers3 size={15} />}
          label="Explicit scatter orders"
          value={atmosphere.maxScatteringOrder}
          display={`${atmosphere.maxScatteringOrder}`}
          min={1}
          max={6}
          step={1}
          onChange={(value) => set('maxScatteringOrder', value)}
        />
      </div>

      <div className="model-note">
        <Sparkles size={15} />
        <span>AOD is the dry/reference-humidity baseline. Humidity applies hygroscopic growth; clouds can brighten local light while extinguishing distant light. The remaining bounded scatter tail is closed analytically.</span>
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

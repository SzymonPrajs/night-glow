import { useRef, useState, type KeyboardEvent } from 'react'
import { Activity, Cloud, CloudFog, Droplets, Focus, Gauge, Layers3, MountainSnow, Sparkles, SunMedium, Wind } from 'lucide-react'
import type { PhysicalGlowAnalysisState } from '../hooks/usePhysicalGlow'
import { findWeatherPreset, WEATHER_PRESETS } from '../lib/weatherPresets'
import type { Atmosphere, SeeingConditions } from '../types'
import PsfPreview from './PsfPreview'

type SettingsPanelProps = {
  atmosphere: Atmosphere
  seeing: SeeingConditions
  viewAltitude: number
  analysis: Pick<
    PhysicalGlowAnalysisState,
    'status' | 'progress' | 'stage' | 'detail' | 'error' | 'result'
  >
  onChange: (atmosphere: Atmosphere) => void
  onSeeingChange: (seeing: SeeingConditions) => void
}

export default function SettingsPanel({
  atmosphere,
  seeing,
  viewAltitude,
  analysis,
  onChange,
  onSeeingChange,
}: SettingsPanelProps) {
  const [weatherView, setWeatherView] = useState<'presets' | 'custom'>('presets')
  const presetsTabRef = useRef<HTMLButtonElement>(null)
  const customTabRef = useRef<HTMLButtonElement>(null)
  const activePreset = findWeatherPreset(atmosphere)
  const analysisProgress = Math.round(Math.min(100, Math.max(0, analysis.progress)))
  const hasAnalysisResult = analysis.result !== undefined
  const analysisStatus = getAnalysisStatusLabel(analysis.status, hasAnalysisResult)
  const set = (key: keyof Atmosphere, value: number) => onChange({ ...atmosphere, [key]: value })
  const setSeeing = (key: keyof SeeingConditions, value: number) => (
    onSeeingChange({ ...seeing, [key]: value })
  )
  const onWeatherTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let nextView: 'presets' | 'custom'
    if (event.key === 'Home') nextView = 'presets'
    else if (event.key === 'End') nextView = 'custom'
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      nextView = weatherView === 'presets' ? 'custom' : 'presets'
    } else return
    event.preventDefault()
    setWeatherView(nextView)
    const nextTabRef = nextView === 'presets' ? presetsTabRef : customTabRef
    nextTabRef.current?.focus()
  }
  return (
    <>
      <section className="weather-control" aria-labelledby="weather-heading">
        <div className="weather-heading" id="weather-heading">
          <span>Weather model</span>
          <strong>{activePreset?.name ?? 'Custom'}</strong>
        </div>
        <div className={`weather-analysis ${analysis.status}`}>
          <div className="weather-analysis-label">
            <span role="status" aria-live="polite" aria-atomic="true">
              {analysisStatus}
            </span>
            <strong>{analysisProgress}%</strong>
          </div>
          <div
            className="weather-analysis-track"
            role="progressbar"
            aria-label="Weather analysis progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={analysisProgress}
            aria-valuetext={analysis.stage}
          >
            <span style={{ width: `${analysisProgress}%` }} />
          </div>
          {analysis.status === 'loading' && <p className="weather-analysis-stage">{analysis.stage}</p>}
          {analysis.detail && <p className="analysis-progress-detail">{analysis.detail}</p>}
          {analysis.error && <p className="analysis-message" role="alert">{analysis.error}</p>}
        </div>
        <div className="weather-tabs" role="tablist" aria-label="Weather controls">
          <button
            ref={presetsTabRef}
            type="button"
            id="weather-presets-tab"
            role="tab"
            aria-selected={weatherView === 'presets'}
            aria-controls="weather-presets-panel"
            tabIndex={weatherView === 'presets' ? 0 : -1}
            onClick={() => setWeatherView('presets')}
            onKeyDown={onWeatherTabKeyDown}
          >
            Presets
          </button>
          <button
            ref={customTabRef}
            type="button"
            id="weather-custom-tab"
            role="tab"
            aria-selected={weatherView === 'custom'}
            aria-controls="weather-custom-panel"
            tabIndex={weatherView === 'custom' ? 0 : -1}
            onClick={() => setWeatherView('custom')}
            onKeyDown={onWeatherTabKeyDown}
          >
            Custom
          </button>
        </div>

        <div
          className="weather-preset-grid"
          id="weather-presets-panel"
          role="tabpanel"
          aria-labelledby="weather-presets-tab"
          hidden={weatherView !== 'presets'}
        >
          {WEATHER_PRESETS.map((preset) => {
            const active = activePreset?.id === preset.id
            const nameId = `weather-preset-${preset.id}-name`
            const summaryId = `weather-preset-${preset.id}-summary`
            return (
              <button
                key={preset.id}
                type="button"
                className={active ? 'weather-preset active' : 'weather-preset'}
                aria-labelledby={nameId}
                aria-describedby={summaryId}
                aria-pressed={active}
                data-tooltip={preset.summary}
                title={preset.summary}
                onClick={() => onChange({ ...preset.values })}
              >
                <strong id={nameId}>{preset.name}</strong>
                <span className="sr-only" id={summaryId}>{preset.summary}</span>
              </button>
            )
          })}
        </div>
        <div
          className="custom-weather-panel"
          id="weather-custom-panel"
          role="tabpanel"
          aria-labelledby="weather-custom-tab"
          hidden={weatherView !== 'custom'}
        >
            <p>Fine-tune the active weather model. Any change becomes a custom setup.</p>
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

              <div className="settings-section"><span>Optical seeing</span><i /></div>
              <Slider
                icon={<Focus size={15} />}
                label="Zenith seeing FWHM"
                value={seeing.zenithFwhmArcsec}
                display={`${seeing.zenithFwhmArcsec.toFixed(2)}″`}
                min={0.3}
                max={4}
                step={0.05}
                onChange={(value) => setSeeing('zenithFwhmArcsec', value)}
              />
              <Slider
                icon={<Wind size={15} />}
                label="Effective upper wind"
                value={seeing.effectiveWindMps}
                display={`${Math.round(seeing.effectiveWindMps)} m/s`}
                min={1}
                max={60}
                step={1}
                onChange={(value) => setSeeing('effectiveWindMps', value)}
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
                display={atmosphere.cloudOpticalDepth < 3
                  ? atmosphere.cloudOpticalDepth.toFixed(1)
                  : atmosphere.cloudOpticalDepth.toFixed(0)}
                min={0}
                max={80}
                step={0.1}
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

            <details className="model-note">
              <summary><Sparkles size={15} /> How the weather model works</summary>
              <p>AOD is the dry/reference-humidity baseline. Humidity applies hygroscopic growth; clouds can brighten local light while extinguishing direct celestial light. The remaining bounded scatter tail is closed analytically.</p>
            </details>
        </div>
        <PsfPreview seeing={seeing} altitudeDeg={viewAltitude} />
      </section>
    </>
  )
}

function getAnalysisStatusLabel(
  status: PhysicalGlowAnalysisState['status'],
  hasResult: boolean,
) {
  if (status === 'loading') return hasResult
    ? 'Updating — showing previous field'
    : 'Building sky model'
  if (status === 'live') return 'Physical field current'
  if (status === 'error') return hasResult
    ? 'Update failed — showing last valid field'
    : 'Physical analysis unavailable'
  return hasResult ? 'Previous physical field available' : 'Waiting for sky model'
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
  const id = `setting-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
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
        aria-valuetext={display}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--range-progress': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
      />
    </label>
  )
}

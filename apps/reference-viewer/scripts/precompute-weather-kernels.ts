import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { performance } from 'node:perf_hooks'
import { buildAtmosphericKernelAsync } from '../src/lib/physics'
import {
  PRECOMPUTED_WEATHER_KERNEL_BANDS,
  PRECOMPUTED_WEATHER_KERNEL_BYTE_LENGTH,
  PRECOMPUTED_WEATHER_KERNEL_GRID,
  precomputedWeatherAtmosphereInput,
  precomputedWeatherKernelCacheKey,
  precomputedWeatherTransferOptions,
} from '../src/lib/precomputedWeatherKernels'
import { WEATHER_PRESETS, type WeatherPreset } from '../src/lib/weatherPresets'

type GeneratedKernelReport = {
  presetId: string
  cacheKey: string
  asset: string
  bytes: number
  sha256: string
  maxOrdersUsed: number
  runtimeMs: number
}

const execFileAsync = promisify(execFile)
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = resolve(projectRoot, 'public/kernels')

async function generatePreset(preset: WeatherPreset): Promise<GeneratedKernelReport> {
  const started = performance.now()
  const kernel = await buildAtmosphericKernelAsync(
    precomputedWeatherAtmosphereInput(preset.values),
    PRECOMPUTED_WEATHER_KERNEL_GRID,
    {
      ...precomputedWeatherTransferOptions(preset),
      bands: PRECOMPUTED_WEATHER_KERNEL_BANDS,
      yieldEvery: 128,
    },
  )
  const expectedCacheKey = precomputedWeatherKernelCacheKey(preset)
  if (kernel.key !== expectedCacheKey) {
    throw new Error(`${preset.id} generated cache key ${kernel.key}; expected ${expectedCacheKey}`)
  }

  const bytes = float32LittleEndian(kernel.values)
  if (bytes.byteLength !== PRECOMPUTED_WEATHER_KERNEL_BYTE_LENGTH) {
    throw new Error(
      `${preset.id} generated ${bytes.byteLength.toLocaleString()} bytes; ` +
      `expected ${PRECOMPUTED_WEATHER_KERNEL_BYTE_LENGTH.toLocaleString()}`,
    )
  }

  await mkdir(outputDirectory, { recursive: true })
  const filename = `weather-${preset.id}.f32`
  await writeFile(resolve(outputDirectory, filename), bytes)
  return {
    presetId: preset.id,
    cacheKey: kernel.key,
    asset: `public/kernels/${filename}`,
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    maxOrdersUsed: kernel.maxOrdersUsed,
    runtimeMs: performance.now() - started,
  }
}

function float32LittleEndian(values: Float32Array) {
  const bytes = Buffer.allocUnsafe(values.byteLength)
  for (let index = 0; index < values.length; index += 1) {
    bytes.writeFloatLE(values[index], index * Float32Array.BYTES_PER_ELEMENT)
  }
  return bytes
}

function selectedPreset() {
  const presetFlag = process.argv.find((argument) => argument.startsWith('--preset='))
  const positionalFlag = process.argv.indexOf('--preset')
  const id = presetFlag?.slice('--preset='.length) ??
    (positionalFlag >= 0 ? process.argv[positionalFlag + 1] : undefined)
  if (!id) return undefined
  const preset = WEATHER_PRESETS.find((candidate) => candidate.id === id)
  if (!preset) throw new Error(`Unknown weather preset ${id}`)
  return preset
}

function requestedJobs() {
  const jobsFlag = process.argv.find((argument) => argument.startsWith('--jobs='))
  const positionalFlag = process.argv.indexOf('--jobs')
  const raw = jobsFlag?.slice('--jobs='.length) ??
    (positionalFlag >= 0 ? process.argv[positionalFlag + 1] : undefined)
  const parsed = Number(raw)
  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(WEATHER_PRESETS.length, Math.floor(parsed)))
    : Math.min(4, availableParallelism(), WEATHER_PRESETS.length)
}

async function generateAllPresets() {
  const pending = [...WEATHER_PRESETS]
  const reports: GeneratedKernelReport[] = []
  const ownScript = fileURLToPath(import.meta.url)
  const tsxExecutable = resolve(projectRoot, 'node_modules/.bin/tsx')
  const jobs = requestedJobs()

  await Promise.all(Array.from({ length: jobs }, async () => {
    while (pending.length > 0) {
      const preset = pending.shift()
      if (!preset) return
      const { stdout } = await execFileAsync(tsxExecutable, [ownScript, '--preset', preset.id], {
        cwd: projectRoot,
        maxBuffer: 1024 * 1024,
      })
      reports.push(JSON.parse(stdout.trim()) as GeneratedKernelReport)
    }
  }))

  reports.sort((left, right) =>
    WEATHER_PRESETS.findIndex((preset) => preset.id === left.presetId) -
    WEATHER_PRESETS.findIndex((preset) => preset.id === right.presetId))
  return reports
}

const started = performance.now()
const preset = selectedPreset()
const reports = preset ? [await generatePreset(preset)] : await generateAllPresets()
const result = preset
  ? reports[0]
  : {
      jobs: requestedJobs(),
      runtimeMs: performance.now() - started,
      totalBytes: reports.reduce((total, report) => total + report.bytes, 0),
      kernels: reports,
    }
console.log(JSON.stringify(result, null, preset ? 0 : 2))

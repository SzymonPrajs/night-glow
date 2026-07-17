import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
const paths = {
  environment: new URL('../packages/environment/target/wasm32-unknown-unknown/release/environment_wasm.wasm', import.meta.url),
  physics: new URL('../packages/physics/target/wasm32-unknown-unknown/release/nightglow_wasm.wasm', import.meta.url),
}
const timings = {}
const instances = {}
for (const [name, path] of Object.entries(paths)) {
  const bytes = await readFile(path)
  const compileStart = performance.now()
  const module = await WebAssembly.compile(bytes)
  const compileMs = performance.now() - compileStart
  const instantiateStart = performance.now()
  instances[name] = await WebAssembly.instantiate(module)
  timings[name] = {
    wasm_bytes: bytes.byteLength,
    compile_ms: Number(compileMs.toFixed(3)),
    instantiate_ms: Number((performance.now() - instantiateStart).toFixed(3)),
    initial_memory_bytes: instances[name].exports.memory.buffer.byteLength,
  }
}

const solve = instances.physics.exports.nightglow_exponential_transmittance
assert.equal(typeof solve, 'function')

let maxRelativeError = 0
for (const [beta, scale, path, intervals] of [
  [1.2e-4, 8_000, 60_000, 4_096],
  [4.0e-5, 1_500, 10_000, 2_048],
  [2.0e-5, 12_000, 2_000, 1_024],
]) {
  const step = path / intervals
  let sum = 0.5 * (beta + beta * Math.exp(-path / scale))
  for (let index = 1; index < intervals; index += 1) sum += beta * Math.exp(-(index * step) / scale)
  const expected = Math.exp(-sum * step)
  const actual = solve(beta, scale, path, intervals)
  const relativeError = Math.abs(actual - expected) / Math.max(Math.abs(expected), Number.EPSILON)
  maxRelativeError = Math.max(maxRelativeError, relativeError)
}
assert.ok(maxRelativeError <= 1e-12)

const fixture = JSON.parse(await readFile(new URL('../packages/contracts/fixtures/v1/observer-render-product.json', import.meta.url), 'utf8'))
const outputPointer = instances.physics.exports.nightglow_first_slice_solve(70, 99_850)
const outputLength = instances.physics.exports.nightglow_first_slice_output_len()
const values = new Float32Array(instances.physics.exports.memory.buffer, outputPointer, outputLength)
const maxProductRelativeError = Math.max(...values.map((value, index) => Math.abs(value - fixture.values[index]) / fixture.values[index]))
assert.equal(outputLength, fixture.values.length)
assert.ok(maxProductRelativeError < 1e-6)

const environmentTotal = instances.environment.exports.nightglow_fixture_emission_total(1_000_000, 1, 2, 0, 4)
assert.equal(environmentTotal, 70)
const report = {
  modules: timings,
  fixture_directional_intensity_w_sr: environmentTotal,
  max_js_wasm_relative_error: maxRelativeError,
  max_render_product_relative_error: maxProductRelativeError,
}
for (const moduleReport of Object.values(report.modules)) {
  assert.ok(moduleReport.wasm_bytes < 1_048_576)
  assert.ok(moduleReport.initial_memory_bytes <= 16 * 1_048_576)
}
console.log(JSON.stringify(report, null, 2))

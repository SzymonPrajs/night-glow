// Copies repo-owned runtime assets into public/ so the Next.js app can serve
// them as static files. Upstream sources remain the single source of truth;
// the copies are generated output (git-ignored) refreshed by predev/prebuild.
import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const repoRoot = path.resolve(appRoot, '../..')

const copies = []

async function copyTree(relativeSourceDir, relativeTargetDir, filter = () => true) {
  const sourceDir = path.join(repoRoot, relativeSourceDir)
  const targetDir = path.join(appRoot, relativeTargetDir)
  await mkdir(targetDir, { recursive: true })
  for (const entry of await readdir(sourceDir)) {
    if (!filter(entry)) continue
    const source = path.join(sourceDir, entry)
    const target = path.join(targetDir, entry)
    await copyFile(source, target)
    copies.push(`${relativeSourceDir}/${entry} -> ${relativeTargetDir}/${entry}`)
  }
}

async function copyOne(relativeSource, relativeTarget) {
  const source = path.join(repoRoot, relativeSource)
  const target = path.join(appRoot, relativeTarget)
  await mkdir(path.dirname(target), { recursive: true })
  await copyFile(source, target)
  copies.push(`${relativeSource} -> ${relativeTarget}`)
}

await copyTree('packages/contracts/fixtures/v1', 'public/fixtures/v1', (name) => name.endsWith('.json'))
await copyOne(
  'runtime/browser-worker/fixtures/v1/runtime-compatibility-manifest.json',
  'public/fixtures/v1/runtime-compatibility-manifest.json',
)
await copyOne('runtime/browser-worker/src/coordinator.js', 'public/workers/coordinator.js')
await copyOne('runtime/browser-worker/src/coordinator.worker.js', 'public/workers/coordinator.worker.js')

const wasmModules = [
  [
    'packages/environment/target/wasm32-unknown-unknown/release/environment_wasm.wasm',
    'public/wasm/environment_wasm.wasm',
  ],
  [
    'packages/physics/target/wasm32-unknown-unknown/release/nightglow_wasm.wasm',
    'public/wasm/nightglow_wasm.wasm',
  ],
]
let missingWasm = 0
for (const [source, target] of wasmModules) {
  if (existsSync(path.join(repoRoot, source))) {
    await copyOne(source, target)
  } else {
    missingWasm += 1
    console.warn(`[sync-assets] WARNING: ${source} not found; run \`make rust-wasm\` at the repo root first.`)
  }
}

for (const entry of copies) console.log(`[sync-assets] ${entry}`)
console.log(`[sync-assets] ${copies.length} files copied${missingWasm ? `, ${missingWasm} wasm module(s) missing` : ''}.`)

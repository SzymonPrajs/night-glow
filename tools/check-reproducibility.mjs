import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const load = async (path) => JSON.parse(await readFile(`${root}${path}`, 'utf8'))
const hash = async (path) => createHash('sha256').update(await readFile(`${root}${path}`)).digest('hex')
const build = await load('implementation/acceptance/non-ui-build-inputs.json')
const licenses = await load('implementation/acceptance/non-ui-license-report.json')

assert.equal(build.manifest_revision, 'nightglow-non-ui-build-inputs-v1')
assert.equal((await readFile(`${root}.nvmrc`, 'utf8')).trim(), build.toolchains.node)
const rustToolchain = await readFile(`${root}rust-toolchain.toml`, 'utf8')
assert.match(rustToolchain, new RegExp(`channel = "${build.toolchains.rust.replaceAll('.', '\\.')}"`))
for (const [path, expected] of Object.entries(build.sha256)) assert.equal(await hash(path), expected, path)

assert.equal(licenses.report_revision, 'nightglow-non-ui-license-report-v1')
assert.ok(licenses.source_packages.every((item) => item.path && item.declared_license && item.redistribution_status))
for (const asset of licenses.assets) {
  assert.ok(['redistributable', 'review_required'].includes(asset.redistribution_status))
  assert.equal(await hash(asset.path), asset.sha256, asset.path)
}

const contractManifest = await load('packages/contracts/fixtures/v1/manifest.json')
assert.equal(contractManifest.license, 'CC0-1.0')
const terrain = await load('packages/physics/fixtures/v1/surface-terrain-product.json')
assert.equal(terrain.content_license, 'CC0-1.0')

console.log(`Reproducibility: ${Object.keys(build.sha256).length} pinned inputs and ${licenses.assets.length} licensed assets verified.`)

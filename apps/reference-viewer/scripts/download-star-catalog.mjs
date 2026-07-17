import { mkdir, writeFile } from 'node:fs/promises'

const LIMIT = 6.5
const SOURCE = 'V/50/catalog'
const SOURCE_URL = 'https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50'
const query = new URL('https://vizier.cds.unistra.fr/viz-bin/asu-tsv')
query.searchParams.set('-source', SOURCE)
query.searchParams.set('-out', 'HR,Name,RAJ2000,DEJ2000,Vmag,B-V,SpType')
query.searchParams.set('-out.max', 'unlimited')
query.searchParams.set('Vmag', `<=${LIMIT}`)

const response = await fetch(query)
if (!response.ok) throw new Error(`VizieR returned ${response.status} ${response.statusText}`)

const rows = (await response.text()).split('\n')
const headerIndex = rows.findIndex((line) => line.startsWith('HR\tName\tRAJ2000'))
if (headerIndex < 0) throw new Error('VizieR response did not contain the expected catalog columns')

const stars = rows.slice(headerIndex + 3).flatMap((line) => {
  if (!/^\s*\d+\t/.test(line)) return []
  const [hrText, nameText, raText, decText, magnitudeText, bvText, spectralTypeText] = line.split('\t')
  const hr = Number.parseInt(hrText, 10)
  const magnitude = Number.parseFloat(magnitudeText)
  const ra = parseRightAscension(raText)
  const dec = parseDeclination(decText)
  if (![hr, magnitude, ra, dec].every(Number.isFinite) || magnitude > LIMIT) return []

  const bv = Number.parseFloat(bvText)
  return [[
    hr,
    round(ra, 6),
    round(dec, 6),
    round(magnitude, 2),
    Number.isFinite(bv) ? round(bv, 2) : null,
    spectralTypeText.trim(),
    nameText.trim().replace(/\s+/g, ' '),
  ]]
})

if (stars.length < 8_000) throw new Error(`Expected a full magnitude-${LIMIT} catalog, received ${stars.length} stars`)

const catalog = {
  source: SOURCE,
  sourceUrl: SOURCE_URL,
  magnitudeLimit: LIMIT,
  columns: ['hr', 'raHours', 'decDegrees', 'visualMagnitude', 'bv', 'spectralType', 'name'],
  stars,
}

await mkdir('src/data', { recursive: true })
await writeFile('src/data/stars-mag6.json', `${JSON.stringify(catalog)}\n`)
console.log(`Wrote ${stars.length} stars through V=${LIMIT} to src/data/stars-mag6.json`)

function parseRightAscension(value) {
  const [hours, minutes, seconds] = value.trim().split(/\s+/).map(Number)
  return hours + minutes / 60 + seconds / 3600
}

function parseDeclination(value) {
  const sign = value.trim().startsWith('-') ? -1 : 1
  const [degrees, minutes, seconds] = value.trim().replace(/^[+-]/, '').split(/\s+/).map(Number)
  return sign * (degrees + minutes / 60 + seconds / 3600)
}

function round(value, digits) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

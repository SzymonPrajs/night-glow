import catalog from './stars-mag6.json'

type CatalogRow = [
  hr: number,
  ra: number,
  dec: number,
  magnitude: number,
  bv: number | null,
  spectralType: string,
  name: string,
]

export type CatalogStar = {
  hr: number
  ra: number
  dec: number
  mag: number
  bv: number | null
  spectralType: string
  name: string
}

export const STAR_CATALOG = (catalog.stars as CatalogRow[]).map(
  ([hr, ra, dec, mag, bv, spectralType, name]): CatalogStar => ({ hr, ra, dec, mag, bv, spectralType, name }),
)

export const STAR_CATALOG_INFO = {
  count: STAR_CATALOG.length,
  magnitudeLimit: catalog.magnitudeLimit,
  source: catalog.source,
  sourceUrl: catalog.sourceUrl,
}

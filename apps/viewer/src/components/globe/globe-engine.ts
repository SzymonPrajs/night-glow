// Imperative MapLibre adapter for the Globe view. React never touches the map
// directly; it mounts this engine and calls semantic methods. The engine owns
// the map, its sources/layers and their disposal.
import type maplibregl from 'maplibre-gl'
import type { CellFeature } from './grid.ts'
import { cellsToGeoJSON, graticuleFeatures, haloGeoJSON, type Ramp } from './grid.ts'

export interface PickedCellProps {
  index: number
  value: number
  validity: string
  coverageStatus: string | null
  stateClass: string
}

export interface GlobeEngineOptions {
  center: [number, number]
  zoom: number
  onMoveEnd: (center: [number, number], zoom: number) => void
  onPick: (props: PickedCellProps, lngLat: [number, number], point: { x: number; y: number }) => void
  onBackgroundClick: () => void
}

type MapLibreModule = typeof maplibregl

const SOURCE_CELLS = 'display-cells'
const SOURCE_HALO = 'display-halo'
const SOURCE_GRATICULE = 'graticule'

export class GlobeEngine {
  private map: maplibregl.Map
  private maplibre: MapLibreModule
  private marker: maplibregl.Marker | null = null
  private options: GlobeEngineOptions

  constructor(maplibre: MapLibreModule, container: HTMLElement, options: GlobeEngineOptions) {
    this.options = options
    this.maplibre = maplibre
    this.map = new maplibre.Map({
      container,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#050914' },
          },
        ],
      },
      center: options.center,
      zoom: options.zoom,
      attributionControl: false,
      renderWorldCopies: false,
    })
    this.map.on('style.load', () => {
      this.map.setProjection({ type: 'globe' })
      this.installStaticLayers()
    })
    this.map.on('moveend', () => {
      const center = this.map.getCenter()
      this.options.onMoveEnd([center.lng, center.lat], this.map.getZoom())
    })
    this.map.on('click', (event) => {
      const features = this.map.queryRenderedFeatures(event.point, { layers: ['cells-fill'] })
      const feature = features[0]
      if (feature) {
        this.options.onPick(
          feature.properties as unknown as PickedCellProps,
          [event.lngLat.lng, event.lngLat.lat],
          { x: event.point.x, y: event.point.y },
        )
      } else {
        this.options.onBackgroundClick()
      }
    })
    this.map.on('mousemove', (event) => {
      const features = this.map.queryRenderedFeatures(event.point, { layers: ['cells-fill'] })
      this.map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : ''
    })
  }

  private installStaticLayers(): void {
    if (!this.map.getSource(SOURCE_GRATICULE)) {
      this.map.addSource(SOURCE_GRATICULE, { type: 'geojson', data: graticuleFeatures(10) })
      this.map.addLayer({
        id: 'graticule-line',
        type: 'line',
        source: SOURCE_GRATICULE,
        paint: { 'line-color': 'rgba(141, 200, 255, 0.12)', 'line-width': 1 },
      })
    }
    if (!this.map.getSource(SOURCE_HALO)) {
      this.map.addSource(SOURCE_HALO, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      this.map.addLayer({
        id: 'cells-halo',
        type: 'circle',
        source: SOURCE_HALO,
        layout: { visibility: 'none' },
        paint: {
          'circle-color': '#f0b269',
          'circle-opacity': 0.22,
          'circle-blur': 1,
          'circle-radius': ['+', 6, ['*', 26, ['get', 'weight']]],
        },
      })
    }
    if (!this.map.getSource(SOURCE_CELLS)) {
      this.map.addSource(SOURCE_CELLS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      this.map.addLayer({
        id: 'cells-fill',
        type: 'fill',
        source: SOURCE_CELLS,
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.92, 'fill-outline-color': 'rgba(141, 200, 255, 0.25)' },
      })
      // Outline semantics per state class: solid = valid, dashed = supported
      // dark/upper bound, dotted = missing/censored/masked. Never hue alone.
      this.map.addLayer({
        id: 'cells-line-valid',
        type: 'line',
        source: SOURCE_CELLS,
        filter: ['==', ['get', 'stateClass'], 'valid'],
        paint: { 'line-color': 'rgba(232, 241, 255, 0.35)', 'line-width': 1 },
      })
      this.map.addLayer({
        id: 'cells-line-dark',
        type: 'line',
        source: SOURCE_CELLS,
        filter: ['==', ['get', 'stateClass'], 'dark'],
        paint: { 'line-color': 'rgba(240, 178, 105, 0.7)', 'line-width': 1.5, 'line-dasharray': [3, 2] },
      })
      this.map.addLayer({
        id: 'cells-line-invalid',
        type: 'line',
        source: SOURCE_CELLS,
        filter: ['==', ['get', 'stateClass'], 'invalid'],
        paint: { 'line-color': 'rgba(147, 167, 196, 0.6)', 'line-width': 1.5, 'line-dasharray': [1, 2] },
      })
      this.map.addLayer({
        id: 'cells-bounds',
        type: 'line',
        source: SOURCE_CELLS,
        layout: { visibility: 'none' },
        paint: { 'line-color': 'rgba(183, 220, 255, 0.9)', 'line-width': 2 },
      })
    }
    this.applyPendingProduct()
    if (this.map.getLayer('cells-bounds')) {
      this.map.setLayoutProperty('cells-bounds', 'visibility', this.inspectionVisible ? 'visible' : 'none')
    }
  }

  private inspectionVisible = false

  /** Replaces the active product's cells (and emission halo when present). */
  setProduct(cells: CellFeature[], ramp: Ramp, halo: boolean): void {
    this.pendingProduct = { cells, ramp, halo }
    this.applyPendingProduct()
  }

  private pendingProduct: { cells: CellFeature[]; ramp: Ramp; halo: boolean } | null = null

  private applyPendingProduct(): void {
    if (!this.pendingProduct) return
    const cellsSource = this.map.getSource(SOURCE_CELLS) as maplibregl.GeoJSONSource | undefined
    const haloSource = this.map.getSource(SOURCE_HALO) as maplibregl.GeoJSONSource | undefined
    if (!cellsSource || !haloSource || !this.map.getLayer('cells-halo')) return
    const { cells, ramp, halo } = this.pendingProduct
    cellsSource.setData(cellsToGeoJSON(cells))
    haloSource.setData(halo ? haloGeoJSON(cells, ramp) : { type: 'FeatureCollection', features: [] })
    this.map.setLayoutProperty('cells-halo', 'visibility', halo ? 'visible' : 'none')
  }

  setInspectionVisible(visible: boolean): void {
    this.inspectionVisible = visible
    if (this.map.getLayer('cells-bounds')) {
      this.map.setLayoutProperty('cells-bounds', 'visibility', visible ? 'visible' : 'none')
    }
  }

  moveTo(center: [number, number], zoom: number): void {
    const current = this.map.getCenter()
    const samePlace = Math.abs(current.lng - center[0]) < 1e-6 && Math.abs(current.lat - center[1]) < 1e-6
    const sameZoom = Math.abs(this.map.getZoom() - zoom) < 1e-3
    if (!samePlace || !sameZoom) {
      this.map.easeTo({ center, zoom, duration: 300 })
    }
  }

  showPreviewPin(lngLat: [number, number]): void {
    this.hidePreviewPin()
    const element = document.createElement('div')
    element.className = 'globePreviewPin'
    element.setAttribute('aria-hidden', 'true')
    this.marker = new this.maplibre.Marker({ element }).setLngLat(lngLat).addTo(this.map)
  }

  hidePreviewPin(): void {
    this.marker?.remove()
    this.marker = null
  }

  resize(): void {
    this.map.resize()
  }

  dispose(): void {
    this.hidePreviewPin()
    this.map.remove()
  }
}

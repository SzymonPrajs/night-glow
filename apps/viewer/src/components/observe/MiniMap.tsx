'use client'

import { useEffect, useRef, useState } from 'react'
import type maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { SkyCamera } from './sky-engine.ts'
import { formatLatLon } from '../../lib/format.ts'
import styles from './observe.module.css'

export interface MiniMapProps {
  latitudeDeg: number
  longitudeDeg: number
  camera: SkyCamera
  contextCells: GeoJSON.FeatureCollection | null
  onRelocate: (latitudeDeg: number, longitudeDeg: number) => void
}

// Low-power 2-D mini-map for local relocation inside the Sky view. Lazily
// loaded so MapLibre never enters the observer core bundle. Preview/commit
// semantics match the Globe: a click only previews, the button commits.
export default function MiniMap({ latitudeDeg, longitudeDeg, camera, contextCells, onRelocate }: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const maplibreRef = useRef<typeof maplibregl | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const [preview, setPreview] = useState<{ latitudeDeg: number; longitudeDeg: number } | null>(null)

  useEffect(() => {
    let disposed = false
    ;(async () => {
      const maplibre = (await import('maplibre-gl')).default
      if (disposed || !containerRef.current) return
      maplibreRef.current = maplibre
      const map = new maplibre.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {},
          layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#070d1a' } },
          ],
        },
        center: [longitudeDeg, latitudeDeg],
        zoom: 11,
        attributionControl: false,
        interactive: true,
      })
      map.on('style.load', () => {
        map.addSource('wedge', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({
          id: 'wedge-fill',
          type: 'fill',
          source: 'wedge',
          paint: { 'fill-color': 'rgba(141, 200, 255, 0.18)' },
        })
        map.addLayer({
          id: 'wedge-line',
          type: 'line',
          source: 'wedge',
          paint: { 'line-color': 'rgba(141, 200, 255, 0.6)', 'line-width': 1 },
        })
        map.addSource('context', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({
          id: 'context-fill',
          type: 'fill',
          source: 'context',
          paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.35 },
        })
      })
      map.on('click', (event) => {
        setPreview({ latitudeDeg: event.lngLat.lat, longitudeDeg: event.lngLat.lng })
      })
      mapRef.current = map
    })()
    return () => {
      disposed = true
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
      maplibreRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync pins, wedge and context data.
  useEffect(() => {
    const map = mapRef.current
    const maplibre = maplibreRef.current
    if (!map || !maplibre) return
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []
    const committed = document.createElement('div')
    committed.className = 'miniMapCommittedPin'
    markersRef.current.push(new maplibre.Marker({ element: committed }).setLngLat([longitudeDeg, latitudeDeg]).addTo(map))
    if (preview) {
      const previewEl = document.createElement('div')
      previewEl.className = 'globePreviewPin'
      markersRef.current.push(
        new maplibre.Marker({ element: previewEl }).setLngLat([preview.longitudeDeg, preview.latitudeDeg]).addTo(map),
      )
    }
    const wedgeSource = map.getSource('wedge') as maplibregl.GeoJSONSource | undefined
    wedgeSource?.setData(wedgeGeoJSON(longitudeDeg, latitudeDeg, camera.azimuthDeg, camera.fovDeg))
    const contextSource = map.getSource('context') as maplibregl.GeoJSONSource | undefined
    if (contextCells) contextSource?.setData(contextCells)
    map.easeTo({ center: [longitudeDeg, latitudeDeg], duration: 200 })
  }, [latitudeDeg, longitudeDeg, camera, preview, contextCells])

  return (
    <div className={styles.miniMapPanel}>
      <div ref={containerRef} className={styles.miniMapCanvas} aria-label="Relocation mini-map" />
      <div className={styles.miniMapFooter}>
        {preview ? (
          <>
            <span className="mono">{formatLatLon(preview.latitudeDeg, preview.longitudeDeg)}</span>
            <button
              type="button"
              className={styles.moveButton}
              onClick={() => {
                onRelocate(preview.latitudeDeg, preview.longitudeDeg)
                setPreview(null)
              }}
            >
              Move sky here
            </button>
          </>
        ) : (
          <span className={styles.miniMapHint}>Click to preview a new location</span>
        )}
      </div>
    </div>
  )
}

function wedgeGeoJSON(
  longitudeDeg: number,
  latitudeDeg: number,
  azimuthDeg: number,
  fovDeg: number,
): GeoJSON.FeatureCollection {
  const steps = 16
  const radiusDeg = 0.06
  const coordinates: [number, number][] = [[longitudeDeg, latitudeDeg]]
  const start = azimuthDeg - fovDeg / 2
  for (let i = 0; i <= steps; i += 1) {
    const angle = ((start + (fovDeg * i) / steps) * Math.PI) / 180
    coordinates.push([
      longitudeDeg + (radiusDeg * Math.sin(angle)) / Math.max(0.2, Math.cos((latitudeDeg * Math.PI) / 180)),
      latitudeDeg + radiusDeg * Math.cos(angle),
    ])
  }
  coordinates.push([longitudeDeg, latitudeDeg])
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coordinates] } }],
  }
}

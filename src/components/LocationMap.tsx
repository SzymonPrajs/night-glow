import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { LightSource, Location, MapAnalysis } from '../types'

type LocationMapProps = {
  location: Location
  sources: LightSource[]
  status: MapAnalysis['status']
  onChange: (location: Location) => void
}

export default function LocationMap({ location, sources, status, onChange }: LocationMapProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const sourceLayerRef = useRef<L.LayerGroup | null>(null)
  const initialLocationRef = useRef(location)
  const callbackRef = useRef(onChange)
  callbackRef.current = onChange

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return
    const initialLocation = initialLocationRef.current
    const map = L.map(elementRef.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 3,
      maxZoom: 18,
    }).setView([initialLocation.lat, initialLocation.lon], 10)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    const marker = L.marker([initialLocation.lat, initialLocation.lon], {
      icon: L.divIcon({
        className: 'observer-marker-wrap',
        html: '<span class="observer-marker"><span></span></span>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    }).addTo(map)
    const sourceLayer = L.layerGroup().addTo(map)
    map.on('click', (event) => {
      callbackRef.current({
        lat: Number(event.latlng.lat.toFixed(5)),
        lon: Number(event.latlng.lng.toFixed(5)),
        label: 'Pinned location',
      })
    })
    mapRef.current = map
    markerRef.current = marker
    sourceLayerRef.current = sourceLayer
    window.setTimeout(() => map.invalidateSize(), 50)
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
      sourceLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    markerRef.current?.setLatLng([location.lat, location.lon])
    const map = mapRef.current
    if (map && !map.getBounds().pad(-0.18).contains([location.lat, location.lon])) {
      map.panTo([location.lat, location.lon])
    }
  }, [location])

  useEffect(() => {
    const layer = sourceLayerRef.current
    if (!layer) return
    layer.clearLayers()
    if (status !== 'live') return
    for (const source of sources.slice(0, 80)) {
      const color = source.category === 'road' ? '#7fc2ff' : source.category === 'place' ? '#ffc775' : '#ff9665'
      L.circleMarker([source.lat, source.lon], {
        radius: Math.min(10, 2.2 + Math.sqrt(source.flux) * 0.55),
        color,
        fillColor: color,
        fillOpacity: 0.25,
        opacity: 0.6,
        weight: 1,
      })
        .bindTooltip(`${source.name} · ${source.distanceKm.toFixed(1)} km`)
        .addTo(layer)
    }
  }, [sources, status])

  return (
    <div className="map-shell">
      <div ref={elementRef} className="location-map" aria-label="OpenStreetMap location picker" />
      <div className="map-hint">Click anywhere to move the observer</div>
      {status === 'loading' && <div className="map-loading"><span />Surveying nearby lights…</div>}
    </div>
  )
}

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Location } from '../types'

type LocationMapProps = {
  location: Location
  heading: number
  onChange: (location: Location) => void
}

export default function LocationMap({ location, heading, onChange }: LocationMapProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
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
        html: '<span class="observer-marker"><span class="observer-direction"><i></i></span><span class="observer-dot"></span></span>',
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      }),
    }).addTo(map)
    map.on('click', (event) => {
      callbackRef.current({
        lat: Number(event.latlng.lat.toFixed(5)),
        lon: Number(event.latlng.lng.toFixed(5)),
        label: 'Pinned location',
      })
    })
    mapRef.current = map
    markerRef.current = marker
    window.setTimeout(() => map.invalidateSize(), 50)
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
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
    const arrow = markerRef.current?.getElement()?.querySelector<HTMLElement>('.observer-direction')
    if (arrow) arrow.style.transform = `rotate(${heading}deg)`
  }, [heading])

  return (
    <div className="map-shell">
      <div ref={elementRef} className="location-map" aria-label="OpenStreetMap location picker" />
      <div className="map-hint">Click anywhere to move the observer</div>
    </div>
  )
}

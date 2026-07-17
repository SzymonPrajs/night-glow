import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Location } from '../types'

type LocationMapProps = {
  location: Location
  heading: number
  visible?: boolean
  onChange: (location: Location) => void
}

export default function LocationMap({ location, heading, visible = true, onChange }: LocationMapProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const initialLocationRef = useRef(location)
  const callbackRef = useRef(onChange)
  const lastHeadingRef = useRef(heading)
  const continuousHeadingRef = useRef(heading)
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
    marker.bindTooltip(initialLocation.label, {
      direction: 'top',
      offset: [0, -18],
    })
    map.on('click', (event) => {
      callbackRef.current({
        lat: Number(event.latlng.lat.toFixed(5)),
        lon: Number(event.latlng.lng.toFixed(5)),
        label: 'Pinned location',
      })
    })
    mapRef.current = map
    markerRef.current = marker
    const headingTimer = window.setTimeout(() => {
      const arrow = marker.getElement()?.querySelector<HTMLElement>('.observer-direction')
      if (arrow) arrow.style.transform = `rotate(${continuousHeadingRef.current}deg)`
    }, 0)
    return () => {
      window.clearTimeout(headingTimer)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!visible || !mapRef.current) return
    const map = mapRef.current
    const immediateTimer = window.setTimeout(() => map.invalidateSize(), 0)
    const settledTimer = window.setTimeout(() => map.invalidateSize(), 260)
    return () => {
      window.clearTimeout(immediateTimer)
      window.clearTimeout(settledTimer)
    }
  }, [visible])

  useEffect(() => {
    markerRef.current?.setLatLng([location.lat, location.lon])
    markerRef.current?.setTooltipContent(location.label)
    const map = mapRef.current
    if (map && !map.getBounds().pad(-0.18).contains([location.lat, location.lon])) {
      map.panTo([location.lat, location.lon])
    }
  }, [location])

  useEffect(() => {
    const previous = lastHeadingRef.current
    const shortestDelta = ((heading - previous + 540) % 360) - 180
    continuousHeadingRef.current += shortestDelta
    lastHeadingRef.current = heading
    const arrow = markerRef.current?.getElement()?.querySelector<HTMLElement>('.observer-direction')
    if (arrow) arrow.style.transform = `rotate(${continuousHeadingRef.current}deg)`
  }, [heading])

  return (
    <div className="map-shell">
      <div ref={elementRef} className="location-map" aria-label="OpenStreetMap location picker" />
      <div className="map-hint">Click or tap anywhere to move the observer</div>
    </div>
  )
}

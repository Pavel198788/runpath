import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { TrackPoint } from '@/domain/geo/geo'

/** Карта маршрута на OpenStreetMap. Тайлы кэшируются service worker'ом для офлайна. */
export default function TrackMap({
  points,
  className,
}: {
  points: TrackPoint[]
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || points.length === 0) return
    const map = L.map(ref.current, { zoomControl: false, attributionControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    const latlngs = points.map((p) => [p.lat, p.lon] as [number, number])
    const line = L.polyline(latlngs, { color: '#f97316', weight: 4 }).addTo(map)
    const first = latlngs[0]!
    const last = latlngs[latlngs.length - 1]!
    L.circleMarker(first, { radius: 6, color: '#16a34a', fillOpacity: 1 }).addTo(map)
    L.circleMarker(last, { radius: 6, color: '#dc2626', fillOpacity: 1 }).addTo(map)
    map.fitBounds(line.getBounds(), { padding: [20, 20] })
    return () => {
      map.remove()
    }
  }, [points])

  return (
    <div
      ref={ref}
      className={className ?? 'h-64 w-full rounded-xl'}
      role="img"
      aria-label="Карта маршрута"
    />
  )
}

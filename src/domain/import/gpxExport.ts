import type { TrackPoint } from '@/domain/geo/geo'

/** Экспорт трека в GPX 1.1 — для переноса в другие приложения. */
export function toGpx(opts: {
  name: string
  startTime: string | null
  points: TrackPoint[]
}): string {
  const start = opts.startTime ? Date.parse(opts.startTime) : Date.now()
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const pts = opts.points
    .map((p) => {
      const time = new Date(start + p.t * 1000).toISOString()
      const ele = p.alt !== null ? `<ele>${p.alt.toFixed(1)}</ele>` : ''
      return `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${ele}<time>${time}</time></trkpt>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunPath" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${esc(opts.name)}</name>
    <type>running</type>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`
}

import { elevationGainM, trackDistanceM, type TrackPoint } from '@/domain/geo/geo'
import { sportFromText, toIsoDateLocal, type ImportedActivity } from './types'

/** GPX 1.1: <trk><name/><type/><trkseg><trkpt lat lon><ele/><time/><extensions>…hr… */
export function parseGpx(xml: string): ImportedActivity[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Некорректный GPX')
  const tracks = Array.from(doc.getElementsByTagName('trk'))
  const activities: ImportedActivity[] = []
  for (const trk of tracks) {
    const pts = Array.from(trk.getElementsByTagName('trkpt'))
    const times: number[] = []
    const hrs: number[] = []
    const points: TrackPoint[] = []
    let start: number | null = null
    for (const p of pts) {
      const lat = Number(p.getAttribute('lat'))
      const lon = Number(p.getAttribute('lon'))
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      const timeText = p.getElementsByTagName('time')[0]?.textContent
      const ts = timeText ? Date.parse(timeText) : NaN
      if (Number.isFinite(ts)) {
        if (start === null) start = ts
        times.push(ts)
      }
      const eleText = p.getElementsByTagName('ele')[0]?.textContent
      const hr = firstNumberByLocalName(p, 'hr')
      if (hr !== null) hrs.push(hr)
      points.push({
        lat,
        lon,
        t: start !== null && Number.isFinite(ts) ? (ts - start) / 1000 : points.length,
        alt: eleText ? Number(eleText) : null,
        acc: null,
        hr,
      })
    }
    if (points.length === 0) continue
    const startTime = start !== null ? new Date(start) : null
    const durationSec = times.length > 1 ? (times[times.length - 1]! - times[0]!) / 1000 : 0
    activities.push({
      externalId: null,
      source: 'file',
      startTime: startTime?.toISOString() ?? null,
      date: toIsoDateLocal(startTime ?? new Date()),
      sport: sportFromText(trk.getElementsByTagName('type')[0]?.textContent),
      durationSec: Math.round(durationSec),
      distanceM: Math.round(trackDistanceM(points)),
      avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
      elevationGainM: elevationGainM(points),
      points,
      name: trk.getElementsByTagName('name')[0]?.textContent?.trim() ?? null,
    })
  }
  return activities
}

/** Ищет первый элемент с локальным именем (без учёта namespace-префикса, например gpxtpx:hr). */
export function firstNumberByLocalName(el: Element, localName: string): number | null {
  const all = el.getElementsByTagName('*')
  for (const node of Array.from(all)) {
    if (node.localName === localName) {
      const v = Number(node.textContent)
      return Number.isFinite(v) ? v : null
    }
  }
  return null
}

import { elevationGainM, trackDistanceM, type TrackPoint } from '@/domain/geo/geo'
import { sportFromText, toIsoDateLocal, type ImportedActivity } from './types'

/** TCX (Garmin Training Center): Activity[Sport] → Lap → Track → Trackpoint. */
export function parseTcx(xml: string): ImportedActivity[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Некорректный TCX')
  const activities: ImportedActivity[] = []
  for (const act of Array.from(doc.getElementsByTagName('Activity'))) {
    const laps = Array.from(act.getElementsByTagName('Lap'))
    let totalTime = 0
    let totalDist = 0
    for (const lap of laps) {
      totalTime += Number(lap.getElementsByTagName('TotalTimeSeconds')[0]?.textContent ?? 0)
      totalDist += Number(lap.getElementsByTagName('DistanceMeters')[0]?.textContent ?? 0)
    }
    const tps = Array.from(act.getElementsByTagName('Trackpoint'))
    const points: TrackPoint[] = []
    const hrs: number[] = []
    let start: number | null = null
    let lastTs: number | null = null
    for (const tp of tps) {
      const ts = Date.parse(tp.getElementsByTagName('Time')[0]?.textContent ?? '')
      if (Number.isFinite(ts)) {
        if (start === null) start = ts
        lastTs = ts
      }
      const hr = tp
        .getElementsByTagName('HeartRateBpm')[0]
        ?.getElementsByTagName('Value')[0]?.textContent
      if (hr) hrs.push(Number(hr))
      const lat = tp.getElementsByTagName('LatitudeDegrees')[0]?.textContent
      const lon = tp.getElementsByTagName('LongitudeDegrees')[0]?.textContent
      if (lat && lon && start !== null && Number.isFinite(ts)) {
        const alt = tp.getElementsByTagName('AltitudeMeters')[0]?.textContent
        points.push({
          lat: Number(lat),
          lon: Number(lon),
          t: (ts - start) / 1000,
          alt: alt ? Number(alt) : null,
          acc: null,
        })
      }
    }
    const idText = act.getElementsByTagName('Id')[0]?.textContent?.trim() ?? null
    const startTime = start !== null ? new Date(start) : idText ? new Date(idText) : null
    const duration = totalTime || (start !== null && lastTs !== null ? (lastTs - start) / 1000 : 0)
    activities.push({
      externalId: idText,
      source: 'file',
      startTime: startTime && Number.isFinite(startTime.getTime()) ? startTime.toISOString() : null,
      date: toIsoDateLocal(
        startTime && Number.isFinite(startTime.getTime()) ? startTime : new Date(),
      ),
      sport: sportFromText(act.getAttribute('Sport')),
      durationSec: Math.round(duration),
      distanceM: totalDist
        ? Math.round(totalDist)
        : points.length
          ? Math.round(trackDistanceM(points))
          : null,
      avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
      elevationGainM: points.length ? elevationGainM(points) : null,
      points,
      name: null,
    })
  }
  return activities
}

import { db } from '../db'
import type { Track } from '../entities'
import { encodePolyline } from '@/domain/geo/polyline'
import { splitsByKm, trackDistanceM, type TrackPoint } from '@/domain/geo/geo'
import { withMeta } from './helpers'

/** Сохраняет трек и возвращает его; сплиты и полилинию считаем здесь один раз. */
export async function saveTrack(logId: string, points: TrackPoint[]): Promise<Track> {
  const track = withMeta<Track>({
    logId,
    points,
    polyline: encodePolyline(points.map((p) => [p.lat, p.lon])),
    distanceM: Math.round(trackDistanceM(points)),
    splits: splitsByKm(points),
  })
  await db.tracks.put(track)
  return track
}

export async function getTrack(id: string): Promise<Track | undefined> {
  const t = await db.tracks.get(id)
  return t && t.deletedAt === null ? t : undefined
}

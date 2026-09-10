import { db } from '../db'
import { addWorkoutLog } from '../repositories/workoutLogRepo'
import { saveTrack } from '../repositories/trackRepo'
import { touch } from '../repositories/helpers'
import { elevationGainM, splitsByKm } from '@/domain/geo/geo'
import { estimateMaxHr, hrLoad, timeInZones } from '@/domain/load/hrLoad'
import { getProfile } from '../repositories/profileRepo'
import type { ImportedActivity } from '@/domain/import/types'
import type { WorkoutType } from '@/domain/plan/types'

export interface ImportOutcome {
  imported: number
  duplicates: number
  skipped: number
}

/** Считаем дублем запись из того же источника с тем же id или с той же датой и длительностью ±60 с. */
export async function isDuplicate(a: ImportedActivity): Promise<boolean> {
  if (a.externalId) {
    const byId = await db.workoutLogs
      .where('externalId')
      .equals(a.externalId)
      .filter((l) => l.deletedAt === null)
      .first()
    if (byId) return true
  }
  const sameDay = await db.workoutLogs
    .where('date')
    .equals(a.date)
    .filter((l) => l.deletedAt === null)
    .toArray()
  return sameDay.some(
    (l) =>
      Math.abs(l.durationSec - a.durationSec) <= 60 &&
      (l.distanceM === null || a.distanceM === null || Math.abs(l.distanceM - a.distanceM) <= 200),
  )
}

/**
 * Импортирует активности: создаёт записи дневника (и треки), пропускает дубли и не-бег,
 * привязывает к запланированной тренировке того же дня, если она ещё не выполнена.
 */
export async function importActivities(activities: ImportedActivity[]): Promise<ImportOutcome> {
  const outcome: ImportOutcome = { imported: 0, duplicates: 0, skipped: 0 }
  const profile = await getProfile()
  const maxHr =
    profile?.maxHr ??
    (profile?.birthYear ? estimateMaxHr(new Date().getFullYear() - profile.birthYear) : null)
  for (const a of activities) {
    if (a.sport === 'other' || a.durationSec <= 0) {
      outcome.skipped++
      continue
    }
    if (await isDuplicate(a)) {
      outcome.duplicates++
      continue
    }
    const planned = await db.workouts
      .where('date')
      .equals(a.date)
      .filter((w) => w.deletedAt === null && w.status === 'planned' && w.type !== 'strength')
      .first()
    const type: WorkoutType = planned?.type ?? (a.sport === 'walking' ? 'walk' : 'easy')
    const log = await addWorkoutLog({
      workoutId: planned?.id ?? null,
      date: a.date,
      type,
      source: a.source,
      durationSec: a.durationSec,
      distanceM: a.distanceM,
      rpe: null,
      feeling: null,
      pains: [],
      note: '',
      completedSegments: null,
      startTime: a.startTime,
      avgHr: a.avgHr,
      elevationGainM: a.elevationGainM ?? (a.points.length ? elevationGainM(a.points) : null),
      splits: a.points.length ? splitsByKm(a.points) : [],
      externalId: a.externalId,
      name: a.name,
      ...hrMetrics(a.points, maxHr),
    })
    if (a.points.length > 1) {
      const track = await saveTrack(log.id, a.points)
      await db.workoutLogs.put(touch(log, { trackId: track.id }))
    }
    outcome.imported++
  }
  return outcome
}

/** Время в зонах и нагрузка по пульсу, если в точках есть пульс и известен максимум. */
function hrMetrics(
  points: ImportedActivity['points'],
  maxHr: number | null,
): { hrLoad: number | null; timeInZones: number[] | null } {
  if (!maxHr || !points.some((p) => p.hr)) return { hrLoad: null, timeInZones: null }
  const zones = timeInZones(
    points.map((p) => ({ t: p.t, hr: p.hr ?? null })),
    maxHr,
  )
  return { hrLoad: hrLoad(zones), timeInZones: zones }
}

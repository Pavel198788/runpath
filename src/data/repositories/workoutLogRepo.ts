import { db } from '../db'
import type { WorkoutLog } from '../entities'
import type { NewEntity } from '../entities/base'
import { touch, withMeta } from './helpers'

type Optional =
  | 'startTime'
  | 'avgHr'
  | 'elevationGainM'
  | 'splits'
  | 'trackId'
  | 'externalId'
  | 'name'
  | 'shoeId'
  | 'hrLoad'
  | 'timeInZones'
type LogInput = Omit<NewEntity<WorkoutLog>, Optional> & Partial<Pick<WorkoutLog, Optional>>

export async function addWorkoutLog(data: LogInput): Promise<WorkoutLog> {
  const log = withMeta<WorkoutLog>({
    startTime: null,
    avgHr: null,
    elevationGainM: null,
    splits: [],
    trackId: null,
    externalId: null,
    name: null,
    shoeId: null,
    hrLoad: null,
    timeInZones: null,
    ...data,
  })
  await db.transaction('rw', db.workoutLogs, db.workouts, async () => {
    await db.workoutLogs.put(log)
    if (log.workoutId) {
      const w = await db.workouts.get(log.workoutId)
      if (w) {
        // Частично — если сделано меньше 80% запланированного времени.
        const partial = log.durationSec < w.estimatedSeconds * 0.8
        await db.workouts.put(touch(w, { status: partial ? 'partial' : 'done' }))
      }
    }
  })
  return log
}

export async function getWorkoutLog(id: string): Promise<WorkoutLog | undefined> {
  return db.workoutLogs.get(id)
}

export async function allWorkoutLogs(): Promise<WorkoutLog[]> {
  const logs = await db.workoutLogs.filter((l) => l.deletedAt === null).toArray()
  return logs.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export async function logsBetween(from: string, to: string): Promise<WorkoutLog[]> {
  return db.workoutLogs
    .where('date')
    .between(from, to, true, true)
    .filter((l) => l.deletedAt === null)
    .toArray()
}

/** Мягкое удаление: запись остаётся с deletedAt, чтобы удаление доехало при синхронизации. */
export async function deleteWorkoutLog(id: string): Promise<void> {
  const log = await db.workoutLogs.get(id)
  if (!log) return
  await db.transaction('rw', db.workoutLogs, db.workouts, db.tracks, async () => {
    await db.workoutLogs.put(touch(log, { deletedAt: new Date().toISOString() }))
    if (log.trackId) {
      const track = await db.tracks.get(log.trackId)
      if (track) await db.tracks.put(touch(track, { deletedAt: new Date().toISOString() }))
    }
    if (log.workoutId) {
      const w = await db.workouts.get(log.workoutId)
      if (w) await db.workouts.put(touch(w, { status: 'planned' }))
    }
  })
}

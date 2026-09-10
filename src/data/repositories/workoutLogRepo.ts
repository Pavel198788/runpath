import { db } from '../db'
import type { WorkoutLog } from '../entities'
import type { NewEntity } from '../entities/base'
import { touch, withMeta } from './helpers'

export async function addWorkoutLog(data: NewEntity<WorkoutLog>): Promise<WorkoutLog> {
  const log = withMeta<WorkoutLog>(data)
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
  await db.transaction('rw', db.workoutLogs, db.workouts, async () => {
    await db.workoutLogs.put(touch(log, { deletedAt: new Date().toISOString() }))
    if (log.workoutId) {
      const w = await db.workouts.get(log.workoutId)
      if (w) await db.workouts.put(touch(w, { status: 'planned' }))
    }
  })
}

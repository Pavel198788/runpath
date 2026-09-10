import { db } from '../db'
import type { Workout } from '../entities'
import type { WorkoutStatus } from '@/domain/plan/types'
import { touch } from './helpers'

export async function getWorkout(id: string): Promise<Workout | undefined> {
  return db.workouts.get(id)
}

export async function workoutsOfPlan(planId: string): Promise<Workout[]> {
  return db.workouts
    .where('planId')
    .equals(planId)
    .filter((w) => w.deletedAt === null)
    .sortBy('date')
}

export async function workoutsOnDate(planId: string, date: string): Promise<Workout[]> {
  return db.workouts
    .where('date')
    .equals(date)
    .filter((w) => w.planId === planId && w.deletedAt === null)
    .toArray()
}

export async function workoutsBetween(
  planId: string,
  from: string,
  to: string,
): Promise<Workout[]> {
  return db.workouts
    .where('date')
    .between(from, to, true, true)
    .filter((w) => w.planId === planId && w.deletedAt === null)
    .sortBy('date')
}

export async function setWorkoutStatus(id: string, status: WorkoutStatus): Promise<void> {
  const w = await db.workouts.get(id)
  if (!w) return
  await db.workouts.put(touch(w, { status }))
}

/** Перенос на другой день. Исходную дату помним, чтобы показывать «перенесено». */
export async function moveWorkout(id: string, date: string): Promise<void> {
  const w = await db.workouts.get(id)
  if (!w) return
  await db.workouts.put(touch(w, { date, movedFrom: w.movedFrom ?? w.date }))
}

import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { saveGeneratedPlan } from './planRepo'
import { addWorkoutLog, deleteWorkoutLog } from './workoutLogRepo'
import { generatePlan } from '@/domain/plan'

let n = 0
const idGen = () => `id-${++n}`

describe('workoutLogRepo', () => {
  beforeEach(async () => {
    await Promise.all([db.plans.clear(), db.workouts.clear(), db.workoutLogs.clear()])
  })

  it('запись по тренировке отмечает её выполненной, удаление — возвращает в план', async () => {
    const generated = generatePlan(
      {
        activityLevel: 'walk_30',
        goal: 'start_running',
        walkMinutes: 30,
        longestRunKm: null,
        runsPerWeek: null,
        healthFlags: [],
        birthYear: null,
        availableDays: [0, 2, 5],
        targetDate: null,
      },
      { now: new Date(2026, 8, 10), idGen },
    )
    await saveGeneratedPlan(generated)
    const workout = generated.workouts[0]!

    const log = await addWorkoutLog({
      workoutId: workout.id,
      date: workout.date,
      type: workout.type,
      source: 'timer',
      durationSec: workout.estimatedSeconds,
      distanceM: null,
      rpe: 4,
      feeling: 'ok',
      pains: [],
      note: '',
      completedSegments: workout.segments.length,
    })
    expect((await db.workouts.get(workout.id))?.status).toBe('done')

    await deleteWorkoutLog(log.id)
    expect((await db.workouts.get(workout.id))?.status).toBe('planned')
    expect((await db.workoutLogs.get(log.id))?.deletedAt).not.toBeNull()
  })

  it('короткая тренировка засчитывается как частичная', async () => {
    const generated = generatePlan(
      {
        activityLevel: 'walk_30',
        goal: 'start_running',
        walkMinutes: 30,
        longestRunKm: null,
        runsPerWeek: null,
        healthFlags: [],
        birthYear: null,
        availableDays: [0, 2, 5],
        targetDate: null,
      },
      { now: new Date(2026, 8, 10), idGen },
    )
    await saveGeneratedPlan(generated)
    const workout = generated.workouts[0]!
    await addWorkoutLog({
      workoutId: workout.id,
      date: workout.date,
      type: workout.type,
      source: 'manual',
      durationSec: Math.round(workout.estimatedSeconds * 0.5),
      distanceM: null,
      rpe: null,
      feeling: null,
      pains: [],
      note: '',
      completedSegments: null,
    })
    expect((await db.workouts.get(workout.id))?.status).toBe('partial')
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { saveGeneratedPlan, getActivePlan } from '../repositories/planRepo'
import { addWorkoutLog } from '../repositories/workoutLogRepo'
import { upsertWellness } from '../repositories/wellnessRepo'
import { generatePlan } from '@/domain/plan'
import { applyAdjustment, evaluatePlan } from './adaptationService'
import { importActivities } from './importService'

let n = 0
const idGen = () => `id-${++n}`

async function setup() {
  await Promise.all([
    db.plans.clear(),
    db.workouts.clear(),
    db.workoutLogs.clear(),
    db.wellness.clear(),
    db.planAdjustments.clear(),
    db.tracks.clear(),
  ])
  n = 0
  const generated = generatePlan(
    {
      activityLevel: 'walk_30',
      goal: 'start_running',
      walkMinutes: 30,
      healthFlags: [],
      birthYear: 1990,
      availableDays: [0, 2, 5],
      targetDate: null,
    },
    { now: new Date(2026, 8, 10), idGen },
  )
  await saveGeneratedPlan(generated)
  return generated
}

describe('adaptationService', () => {
  beforeEach(setup)

  it('до конца первой недели ничего не предлагает', async () => {
    const plan = (await getActivePlan())!
    expect(await evaluatePlan(plan, '2026-09-16')).toBeNull()
  })

  it('пропущенная первая неделя → предложение повторить, применение удлиняет план', async () => {
    const plan = (await getActivePlan())!
    const before = plan.weeks.length
    const proposal = await evaluatePlan(plan, '2026-09-21')
    expect(proposal?.kind).toBe('repeat_week')
    // Повторный вызов не плодит предложений.
    expect((await evaluatePlan((await getActivePlan())!, '2026-09-21'))?.id).toBe(proposal!.id)

    await applyAdjustment(proposal!, '2026-09-21')
    const after = (await getActivePlan())!
    expect(after.weeks.length).toBe(before + 1)
    expect(after.weeks[1]!.startDate).toBe('2026-09-21')
    expect(after.weeks[1]!.volume).toBe(plan.weeks[0]!.volume)
    const planned = await db.workouts
      .filter((w) => w.deletedAt === null && w.date >= '2026-09-21')
      .toArray()
    expect(planned.every((w) => w.status === 'planned')).toBe(true)
    expect(planned.filter((w) => w.weekIndex === 1 && w.type !== 'strength')).toHaveLength(3)
  })

  it('выполненная неделя не вызывает предложений; болезнь — вызывает восстановительную', async () => {
    const plan = (await getActivePlan())!
    const runs = await db.workouts
      .filter((w) => w.weekIndex === 0 && w.type !== 'strength')
      .toArray()
    for (const w of runs) {
      await addWorkoutLog({
        workoutId: w.id,
        date: w.date,
        type: w.type,
        source: 'timer',
        durationSec: w.estimatedSeconds,
        distanceM: null,
        rpe: 4,
        feeling: 'ok',
        pains: [],
        note: '',
        completedSegments: null,
      })
    }
    expect(await evaluatePlan(plan, '2026-09-21')).toBeNull()

    await upsertWellness('2026-09-22', { sick: true })
    await upsertWellness('2026-09-23', { sick: true })
    await upsertWellness('2026-09-24', { sick: true })
    const p2 = await evaluatePlan((await getActivePlan())!, '2026-09-28')
    expect(p2?.kind).toBe('illness_recovery')
    expect(p2?.firstWeekScale).toBe(0.5)
  })
})

describe('importService', () => {
  beforeEach(setup)

  it('импортирует, привязывает к плану и не дублирует', async () => {
    const planned = await db.workouts
      .filter((w) => w.weekIndex === 0 && w.type !== 'strength')
      .first()
    const activity = {
      externalId: 'strava-1',
      source: 'strava' as const,
      startTime: null,
      date: planned!.date,
      sport: 'running' as const,
      durationSec: 1800,
      distanceM: 4000,
      avgHr: 140,
      elevationGainM: 20,
      points: [],
      name: 'Run',
    }
    const first = await importActivities([activity, { ...activity, sport: 'other' as const }])
    expect(first).toEqual({ imported: 1, duplicates: 0, skipped: 1 })
    expect((await db.workouts.get(planned!.id))?.status).toBe('done')
    const second = await importActivities([activity])
    expect(second.duplicates).toBe(1)
  })

  it('сохраняет трек с точками', async () => {
    const points = [
      { lat: 55, lon: 37, t: 0, alt: null, acc: null },
      { lat: 55.009, lon: 37, t: 300, alt: null, acc: null },
    ]
    await importActivities([
      {
        externalId: null,
        source: 'file',
        startTime: null,
        date: '2026-09-01',
        sport: 'running',
        durationSec: 300,
        distanceM: null,
        avgHr: null,
        elevationGainM: null,
        points,
        name: null,
      },
    ])
    const log = await db.workoutLogs.filter((l) => l.date === '2026-09-01').first()
    expect(log?.trackId).toBeTruthy()
    const track = await db.tracks.get(log!.trackId!)
    expect(track?.points).toHaveLength(2)
    expect(track?.distanceM).toBeGreaterThan(900)
  })
})

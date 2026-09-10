import { describe, expect, it } from 'vitest'
import { decideAdjustment, restructurePlan, reviewWeek, type WeekReview } from './adapt'
import { generatePlan } from './generatePlan'
import { validatePlanSafety } from './validate'
import type { WorkoutCore } from './types'

let n = 0
const idGen = () => `id-${++n}`
const NOW = new Date(2026, 8, 10) // план стартует 14.09.2026

function makePlan() {
  n = 0
  return generatePlan(
    {
      activityLevel: 'walk_30',
      goal: 'half_marathon',
      walkMinutes: 30,
      longestRunKm: null,
      runsPerWeek: null,
      healthFlags: [],
      birthYear: 1990,
      availableDays: [0, 2, 5],
      targetDate: null,
    },
    { now: NOW, idGen },
  )
}

const review = (weekIndex: number, patch: Partial<WeekReview> = {}): WeekReview => ({
  weekIndex,
  plannedRuns: 3,
  doneRuns: 3,
  partialRuns: 0,
  hardRuns: 0,
  sickDays: 0,
  missed: false,
  tooHard: false,
  ...patch,
})

describe('reviewWeek', () => {
  it('считает выполненные, тяжёлые и пропуск', () => {
    const { plan, workouts } = makePlan()
    const week = plan.weeks[1]!
    const runs = workouts.filter((w) => w.weekIndex === 1 && w.type !== 'strength')
    const marked: WorkoutCore[] = workouts.map((w) =>
      w.id === runs[0]!.id
        ? { ...w, status: 'done' }
        : w.id === runs[1]!.id
          ? { ...w, status: 'partial' }
          : w,
    )
    const rpe = new Map([
      [runs[0]!.id, 9],
      [runs[1]!.id, 8],
    ])
    const r = reviewWeek({ week, workouts: marked, rpeByWorkout: rpe, sickDates: new Set() })
    expect(r.doneRuns).toBe(1)
    expect(r.partialRuns).toBe(1)
    expect(r.hardRuns).toBe(2)
    expect(r.tooHard).toBe(true)
    expect(r.missed).toBe(false)

    const missed = reviewWeek({ week, workouts, rpeByWorkout: new Map(), sickDates: new Set() })
    expect(missed.missed).toBe(true)
  })

  it('два больных дня = пропущенная неделя', () => {
    const { plan, workouts } = makePlan()
    const week = plan.weeks[1]!
    const sick = new Set([
      week.startDate,
      `${week.startDate.slice(0, 8)}${String(Number(week.startDate.slice(8)) + 1).padStart(2, '0')}`,
    ])
    const r = reviewWeek({ week, workouts, rpeByWorkout: new Map(), sickDates: sick })
    expect(r.sickDays).toBe(2)
    expect(r.missed).toBe(true)
  })
})

describe('decideAdjustment', () => {
  it('нормальная неделя — без изменений', () => {
    expect(decideAdjustment([review(3)], [])).toBeNull()
  })

  it('пропуск 1 недели — повтор предыдущей', () => {
    const a = decideAdjustment([review(3), review(4, { doneRuns: 0, missed: true })], [])
    expect(a?.kind).toBe('repeat_week')
    expect(a?.sourceWeeks).toEqual([3])
    expect(a?.continueFrom).toBe(4)
  })

  it('пропуск 3 недель — откат на 2', () => {
    const a = decideAdjustment(
      [
        review(5),
        review(6, { missed: true }),
        review(7, { missed: true }),
        review(8, { missed: true }),
      ],
      [],
    )
    expect(a?.kind).toBe('rollback')
    expect(a?.reason).toBe('missed_3_4')
    expect(a?.sourceWeeks).toEqual([4, 5])
    expect(a?.continueFrom).toBe(6)
  })

  it('пропуск > 4 недель — откат на 3 и совет пересобрать', () => {
    const reviews = [review(6), ...[7, 8, 9, 10, 11].map((i) => review(i, { missed: true }))]
    const a = decideAdjustment(reviews, [])
    expect(a?.suggestRebuild).toBe(true)
    expect(a?.sourceWeeks).toEqual([4, 5, 6])
  })

  it('болезнь — восстановительная неделя −50%', () => {
    const a = decideAdjustment([review(3), review(4, { missed: true, sickDays: 3 })], [])
    expect(a?.kind).toBe('illness_recovery')
    expect(a?.firstWeekScale).toBe(0.5)
  })

  it('слишком тяжело — повтор, после двух повторов — откат', () => {
    const first = decideAdjustment([review(5, { tooHard: true, hardRuns: 2 })], [])
    expect(first?.kind).toBe('repeat_week')
    expect(first?.sourceWeeks).toEqual([5])
    const third = decideAdjustment([review(5, { tooHard: true, hardRuns: 2 })], [first!, first!])
    expect(third?.kind).toBe('rollback')
    expect(third?.sourceWeeks).toEqual([4])
  })

  it('пропуск в самом начале — повтор первой недели', () => {
    const a = decideAdjustment([review(0, { missed: true })], [])
    expect(a?.sourceWeeks).toEqual([0])
    expect(a?.continueFrom).toBe(1)
  })
})

describe('restructurePlan', () => {
  it('вставляет повтор недели и сдвигает остаток, не трогая выполненное', () => {
    const { plan, workouts } = makePlan()
    // Неделя 3 (с 05.10) пропущена; сегодня понедельник 12.10 — начало недели 4.
    const doneId = workouts.find((w) => w.weekIndex === 2 && w.type !== 'strength')!.id
    const withDone = workouts.map((w) => (w.id === doneId ? { ...w, status: 'done' as const } : w))
    const adj = decideAdjustment([review(2), review(3, { missed: true })], [])!
    const res = restructurePlan(plan, withDone, adj, '2026-10-12', '2026-10-12', idGen)!

    // +2 недели: повтор недели 2 и заново пропущенная неделя 3.
    expect(res.plan.weeks.length).toBe(plan.weeks.length + 2)
    expect(res.plan.weeks[4]!.startDate).toBe('2026-10-12')
    // Неделя 4 — копия недели 2, неделя 5 — бывшая 3.
    expect(res.plan.weeks[4]!.volume).toBe(plan.weeks[2]!.volume)
    expect(res.plan.weeks[5]!.volume).toBe(plan.weeks[3]!.volume)
    expect(res.plan.weeks.map((w) => w.index)).toEqual(res.plan.weeks.map((_, i) => i))
    // Выполненная осталась, запланированные будущие заменены.
    expect(res.workouts.find((w) => w.id === doneId)?.status).toBe('done')
    expect(res.removedIds.length).toBeGreaterThan(0)
    expect(
      res.workouts.filter((w) => w.date >= '2026-10-12').every((w) => w.status === 'planned'),
    ).toBe(true)
    expect(res.plan.endDate > plan.endDate).toBe(true)
    expect(validatePlanSafety(res.plan)).toEqual([])
  })

  it('после болезни первая неделя вдвое легче и только лёгкий бег', () => {
    const { plan, workouts } = makePlan()
    const adj = decideAdjustment([review(9), review(10, { missed: true, sickDays: 4 })], [])!
    const res = restructurePlan(plan, workouts, adj, '2026-11-30', '2026-11-30', idGen)!
    const week = res.plan.weeks[11]!
    expect(week.isRecovery).toBe(true)
    expect(week.volume).toBeCloseTo(plan.weeks[9]!.volume * 0.5, 1)
    const runs = res.workouts.filter((w) => w.weekIndex === 11 && w.type !== 'strength')
    expect(runs.every((w) => w.type === 'easy' || w.type === 'run_walk' || w.type === 'walk')).toBe(
      true,
    )
  })

  it('не создаёт тренировки на прошедшие дни текущей недели', () => {
    const { plan, workouts } = makePlan()
    const adj = decideAdjustment([review(2), review(3, { missed: true })], [])!
    const res = restructurePlan(plan, workouts, adj, '2026-10-12', '2026-10-15', idGen)!
    expect(
      res.workouts
        .filter((w) => w.status === 'planned')
        .every((w) => w.date >= '2026-10-15' || w.date < '2026-10-12'),
    ).toBe(true)
  })
})

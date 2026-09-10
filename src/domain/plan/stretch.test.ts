import { describe, expect, it } from 'vitest'
import { generatePlan } from './generatePlan'
import { stretchPlanToDate } from './stretch'
import { validatePlanSafety } from './validate'
import { addDaysIso } from '@/domain/dates/dates'

let n = 0
const idGen = () => `s-${++n}`

describe('stretchPlanToDate', () => {
  it('добавляет недели закрепления перед тейпером и сдвигает финиш', () => {
    n = 0
    const g = generatePlan(
      {
        activityLevel: 'run_5k',
        goal: 'half_marathon',
        walkMinutes: null,
        healthFlags: [],
        birthYear: 1990,
        availableDays: [0, 2, 4, 5],
        targetDate: null,
      },
      { now: new Date(2026, 8, 10), idGen },
    )
    const target = addDaysIso(g.plan.endDate, 28)
    const s = stretchPlanToDate(g, target, idGen)
    expect(s.plan.weeks.length).toBe(g.plan.weeks.length + 4)
    expect(s.plan.endDate).toBe(target)
    expect(s.plan.weeks.map((w) => w.index)).toEqual(s.plan.weeks.map((_, i) => i))
    expect(validatePlanSafety(s.plan)).toEqual([])
    // Гонка осталась последней тренировкой.
    expect(s.workouts[s.workouts.length - 1]!.type).toBe('race')
    // Идентификаторы уникальны.
    expect(new Set(s.workouts.map((w) => w.id)).size).toBe(s.workouts.length)
  })
  it('без запаса ничего не меняет', () => {
    const g = generatePlan(
      {
        activityLevel: 'run_5k',
        goal: 'half_marathon',
        walkMinutes: null,
        healthFlags: [],
        birthYear: 1990,
        availableDays: [0, 2, 5],
        targetDate: null,
      },
      { now: new Date(2026, 8, 10), idGen },
    )
    expect(stretchPlanToDate(g, addDaysIso(g.plan.endDate, 3), idGen)).toBe(g)
  })
})

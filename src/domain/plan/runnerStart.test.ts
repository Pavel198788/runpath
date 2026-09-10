import { describe, expect, it } from 'vitest'
import { estimateWeeklyKm, generatePlan, phaseByLongestRun } from './generatePlan'
import { validatePlanSafety } from './validate'
import type { PlanInput } from './types'

let n = 0
const idGen = () => `r-${++n}`
const NOW = new Date(2026, 8, 10)

const base: PlanInput = {
  activityLevel: 'run_5k',
  goal: 'marathon',
  walkMinutes: null,
  longestRunKm: 8,
  runsPerWeek: 1,
  healthFlags: [],
  birthYear: 1990,
  availableDays: [0, 2, 4, 5],
  targetDate: null,
}

function gen(patch: Partial<PlanInput> = {}) {
  n = 0
  return generatePlan({ ...base, ...patch }, { now: NOW, idGen })
}

describe('старт по реальным цифрам бегуна', () => {
  it('фаза выбирается по самой длинной пробежке', () => {
    expect(phaseByLongestRun(1)).toBe('base')
    expect(phaseByLongestRun(3)).toBe('k5')
    expect(phaseByLongestRun(8)).toBe('k10')
    expect(phaseByLongestRun(12)).toBe('half')
    expect(phaseByLongestRun(20)).toBe('marathon')
  })

  it('оценка недельного объёма учитывает частоту', () => {
    expect(estimateWeeklyKm(8, 1)).toBe(8)
    expect(estimateWeeklyKm(5, 3)).toBe(12)
  })

  it('8 км раз в неделю: начинаем с фазы «10 км», а не с «5 км»', () => {
    const { plan } = gen()
    expect(plan.phases[0]!.phase).toBe('k10')
    expect(plan.phases.map((p) => p.phase)).toEqual(['k10', 'half', 'marathon'])
  })

  it('первая неделя не удваивает нагрузку и сохраняет привычную длинную', () => {
    const { plan } = gen()
    const first = plan.weeks[0]!
    // Бегал 8 км в неделю — стартуем в районе 13 км с тремя пробежками, а не с 15+.
    expect(first.volume).toBeLessThanOrEqual(14)
    expect(first.volume).toBeGreaterThanOrEqual(8)
    // Длинная остаётся примерно как была, её не режут вдвое.
    expect(first.longRun).toBeGreaterThanOrEqual(7)
    expect(first.longRun).toBeLessThanOrEqual(8)
    expect(validatePlanSafety(plan)).toEqual([])
  })

  it('тот, кто бегает 3 раза в неделю, стартует с большего объёма', () => {
    const rare = gen({ longestRunKm: 8, runsPerWeek: 1 }).plan.weeks[0]!
    const often = gen({ longestRunKm: 8, runsPerWeek: 3 }).plan.weeks[0]!
    expect(often.volume).toBeGreaterThan(rare.volume)
    expect(validatePlanSafety(gen({ longestRunKm: 8, runsPerWeek: 3 }).plan)).toEqual([])
  })

  it('бегун на 15 км начинает сразу с полумарафонской фазы', () => {
    const { plan } = gen({ longestRunKm: 15, runsPerWeek: 3, activityLevel: 'run_10k' })
    expect(plan.phases[0]!.phase).toBe('half')
    expect(plan.weeks[0]!.longRun).toBeGreaterThanOrEqual(13)
    expect(validatePlanSafety(plan)).toEqual([])
  })

  it('без цифр план строится как раньше', () => {
    const { plan } = gen({ longestRunKm: null, runsPerWeek: null, activityLevel: 'never_ran' })
    expect(plan.phases[0]!.phase).toBe('base')
    expect(validatePlanSafety(plan)).toEqual([])
  })
})

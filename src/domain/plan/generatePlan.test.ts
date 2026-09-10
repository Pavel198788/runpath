import { describe, expect, it } from 'vitest'
import { generatePlan, phaseList } from './generatePlan'
import { validatePlanSafety } from './validate'
import type { PlanInput } from './types'

const NOW = new Date(2026, 8, 10) // четверг 10.09.2026 → старт пн 14.09
const idGen = () => {
  counter += 1
  return `id-${counter}`
}
let counter = 0

const base: PlanInput = {
  activityLevel: 'never_ran',
  goal: 'marathon',
  walkMinutes: 30,
  healthFlags: [],
  birthYear: 1990,
  availableDays: [0, 2, 4, 5],
  targetDate: null,
}

function gen(patch: Partial<PlanInput> = {}) {
  counter = 0
  return generatePlan({ ...base, ...patch }, { now: NOW, idGen })
}

describe('generatePlan — структура', () => {
  it('старт в ближайший понедельник, тренировки отсортированы по дате', () => {
    const { plan, workouts } = gen()
    expect(plan.startDate).toBe('2026-09-14')
    for (let i = 1; i < workouts.length; i++) {
      expect(workouts[i]!.date >= workouts[i - 1]!.date).toBe(true)
    }
  })

  it('нулевой новичок до марафона: все фазы, 44–60 недель', () => {
    const { plan } = gen()
    expect(plan.phases.map((p) => p.phase)).toEqual(['base', 'k5', 'k10', 'half', 'marathon'])
    expect(plan.weeks.length).toBeGreaterThanOrEqual(44)
    expect(plan.weeks.length).toBeLessThanOrEqual(60)
  })

  it('фаза прогулок появляется, если человек не может идти 30 минут', () => {
    expect(phaseList({ ...base, walkMinutes: 15 }, false)[0]).toBe('walk')
    expect(phaseList({ ...base, walkMinutes: 40 }, false)[0]).toBe('base')
  })

  it('«бегаю 5 км» пропускает базу и 5 км', () => {
    const { plan } = gen({ activityLevel: 'run_5k' })
    expect(plan.phases[0]!.phase).toBe('k10')
    expect(plan.weeks.length).toBeLessThan(40)
  })

  it('цель «просто начать бегать» заканчивается на 5 км', () => {
    const { plan, workouts } = gen({ goal: 'start_running' })
    expect(plan.phases.map((p) => p.phase)).toEqual(['base', 'k5'])
    const race = workouts.find((w) => w.type === 'race')
    expect(race?.targetDistanceM).toBe(5000)
    expect(race?.date).toBe(plan.endDate)
  })

  it('последняя тренировка марафонского плана — старт 42,2 км', () => {
    const { plan, workouts } = gen()
    const last = workouts[workouts.length - 1]!
    expect(last.type).toBe('race')
    expect(last.targetDistanceM).toBe(42200)
    expect(last.date).toBe(plan.endDate)
  })

  it('тренировки только в доступные дни', () => {
    const { workouts } = gen({ availableDays: [1, 3, 6] })
    for (const w of workouts) {
      const wd = (new Date(w.date).getDay() + 6) % 7
      expect([1, 3, 6]).toContain(wd)
    }
  })

  it('в базовой фазе 3 беговых дня и 2 ОФП в неделю', () => {
    const { workouts } = gen()
    const week0 = workouts.filter((w) => w.weekIndex === 0)
    expect(week0.filter((w) => w.type === 'run_walk')).toHaveLength(3)
    expect(week0.filter((w) => w.type === 'strength')).toHaveLength(2)
  })

  it('первая неделя базы — 8 × (1 мин бег / 2 мин ходьба) с разминкой и заминкой', () => {
    const { workouts } = gen()
    const w = workouts.find((x) => x.type === 'run_walk')!
    const runs = w.segments.filter((s) => s.kind === 'run')
    expect(runs).toHaveLength(8)
    expect(runs[0]!.seconds).toBe(60)
    expect(w.segments[0]!.kind).toBe('warmup')
    expect(w.segments[w.segments.length - 1]!.kind).toBe('cooldown')
    expect(w.estimatedSeconds).toBe(300 + 8 * 60 + 7 * 120 + 300)
  })
})

describe('generatePlan — правила безопасности', () => {
  it.each([
    ['never_ran → marathon', {}],
    ['never_ran → marathon, осторожный', { healthFlags: ['overweight'], walkMinutes: 15 }],
    ['run_5k → marathon', { activityLevel: 'run_5k' as const }],
    ['run_10k → half', { activityLevel: 'run_10k' as const, goal: 'half_marathon' as const }],
    [
      'walk_30 → half, 3 дня',
      {
        activityLevel: 'walk_30' as const,
        goal: 'half_marathon' as const,
        availableDays: [0, 2, 5],
      },
    ],
    ['never_ran → marathon, 6 дней', { availableDays: [0, 1, 2, 3, 4, 5] }],
  ])('%s: без нарушений', (_name, patch) => {
    const { plan } = gen(patch)
    expect(validatePlanSafety(plan)).toEqual([])
  })

  it('длительная перед марафоном достигает 30–32 км и не больше', () => {
    const { plan } = gen()
    const maxLong = Math.max(
      ...plan.weeks.filter((w) => w.unit === 'km' && !w.isRace).map((w) => w.longRun),
    )
    expect(maxLong).toBeGreaterThanOrEqual(30)
    expect(maxLong).toBeLessThanOrEqual(32)
  })

  it('тейпер: последние 3 недели марафонской фазы убывают по объёму', () => {
    const { plan } = gen()
    const m = plan.weeks.filter((w) => w.phase === 'marathon')
    const taper = m.slice(-3)
    expect(taper.every((w) => w.isTaper)).toBe(true)
    expect(taper[0]!.volume).toBeGreaterThan(taper[1]!.volume)
    expect(taper[1]!.volume).toBeGreaterThan(taper[2]!.volume)
    const peak = Math.max(...m.map((w) => w.volume))
    expect(taper[0]!.volume).toBeLessThanOrEqual(peak * 0.8 + 0.5)
  })

  it('разгрузочные недели легче предыдущих минимум на 20%', () => {
    const { plan } = gen()
    plan.weeks.forEach((w, i) => {
      if (!w.isRecovery) return
      const prev = plan.weeks[i - 1]!
      expect(w.volume).toBeLessThanOrEqual(prev.volume * 0.8 + 0.5)
    })
  })

  it('не больше одной качественной тренировки в неделю до марафонской фазы', () => {
    const { workouts } = gen()
    const byWeek = new Map<number, number>()
    for (const w of workouts) {
      if (w.type === 'tempo' || w.type === 'fartlek')
        byWeek.set(w.weekIndex, (byWeek.get(w.weekIndex) ?? 0) + 1)
    }
    for (const n of byWeek.values()) expect(n).toBeLessThanOrEqual(1)
  })

  it('осторожный режим: удвоенные первые недели базы и предупреждение', () => {
    const normal = gen()
    const careful = gen({ healthFlags: ['joints'] })
    expect(careful.plan.warnings).toContain('conservative')
    const baseNormal = normal.plan.weeks.filter((w) => w.phase === 'base').length
    const baseCareful = careful.plan.weeks.filter((w) => w.phase === 'base').length
    expect(baseCareful).toBe(baseNormal + 7)
  })

  it('слишком ранняя дата старта даёт предупреждение, поздняя — растягивает план', () => {
    const { plan } = gen({ targetDate: '2027-01-01' })
    expect(plan.warnings).toContain('target_date_too_early')
    const base = gen()
    const later = gen({ targetDate: '2028-01-03' })
    expect(later.plan.warnings).not.toContain('target_date_later')
    expect(later.plan.weeks.length).toBeGreaterThan(base.plan.weeks.length + 10)
    expect(validatePlanSafety(later.plan)).toEqual([])
  })

  it('детерминирован: одинаковый вход даёт одинаковый план', () => {
    const a = gen()
    const b = gen()
    expect(a).toEqual(b)
  })
})

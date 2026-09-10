import { describe, expect, it } from 'vitest'
import {
  bmr,
  carbsPerKg,
  dayKind,
  dayTargets,
  workoutKcal,
  type DayContext,
  type NutritionProfile,
} from './targets'
import { carbLoadPlan, fuelingFor, raceDayPlan } from './fueling'

const man: NutritionProfile = {
  sex: 'male',
  weightKg: 80,
  heightCm: 180,
  age: 35,
  weightGoal: 'none',
}
const ctx = (patch: Partial<DayContext> = {}): DayContext => ({
  phase: 'base',
  workouts: [],
  isTaper: false,
  isPeak: false,
  isRaceWeek: false,
  daysToRace: null,
  paceSecPerKm: 480,
  ...patch,
})

describe('BMR / TDEE', () => {
  it('Mifflin-St Jeor', () => {
    expect(bmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 35 })).toBe(1755)
    expect(bmr({ sex: 'female', weightKg: 60, heightCm: 165, age: 30 })).toBe(1320)
  })

  it('энергозатраты тренировки', () => {
    expect(
      workoutKcal(
        { type: 'easy', estimatedSeconds: 600 + 5 * 480, targetDistanceM: 5000 },
        80,
        480,
      ),
    ).toBe(400)
    expect(
      workoutKcal({ type: 'walk', estimatedSeconds: 30 * 60, targetDistanceM: null }, 80, 480),
    ).toBe(Math.round(((30 * 60 - 600) / 480) * 0.5 * 80))
    expect(
      workoutKcal({ type: 'strength', estimatedSeconds: 1200, targetDistanceM: null }, 80, 480),
    ).toBe(112)
  })
})

describe('тип дня и углеводы', () => {
  it('определяет тип дня', () => {
    expect(dayKind(ctx())).toBe('rest')
    expect(
      dayKind(ctx({ workouts: [{ type: 'easy', estimatedSeconds: 1800, targetDistanceM: null }] })),
    ).toBe('easy')
    expect(
      dayKind(ctx({ workouts: [{ type: 'long', estimatedSeconds: 5400, targetDistanceM: null }] })),
    ).toBe('long')
    expect(dayKind(ctx({ daysToRace: 2 }))).toBe('carb_load')
  })

  it('углеводы растут по фазам и по типу дня', () => {
    expect(carbsPerKg('base', 'easy')).toBe(4)
    expect(carbsPerKg('base', 'rest')).toBe(3)
    expect(carbsPerKg('marathon', 'long')).toBe(7)
    expect(carbsPerKg('marathon', 'carb_load')).toBe(9)
  })
})

describe('dayTargets', () => {
  it('день отдыха: калории = BMR × 1,2, макросы сходятся', () => {
    const t = dayTargets(man, ctx())
    expect(t.kind).toBe('rest')
    expect(t.tdee).toBe(Math.round(1755 * 1.2))
    expect(t.proteinG).toBe(128)
    expect(t.carbsG).toBe(240)
    expect(t.calories).toBe(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9)
    expect(t.fatG).toBeGreaterThanOrEqual(64)
  })

  it('день длительной: больше калорий и углеводов', () => {
    const rest = dayTargets(man, ctx())
    const long = dayTargets(
      man,
      ctx({
        phase: 'half',
        workouts: [{ type: 'long', estimatedSeconds: 600 + 15 * 480, targetDistanceM: 15000 }],
      }),
    )
    expect(long.workoutKcal).toBe(1200)
    expect(long.calories).toBeGreaterThan(rest.calories + 800)
    expect(long.carbsPerKg).toBeGreaterThanOrEqual(6.5)
  })

  it('дефицит ≤ 500 и ≤ 15%, не на пике и тейпере', () => {
    const lose = { ...man, weightGoal: 'lose' as const }
    const normal = dayTargets(lose, ctx())
    expect(normal.deficit).toBe(Math.round(Math.min(500, normal.tdee * 0.15)))
    expect(normal.proteinG).toBe(144)
    expect(dayTargets(lose, ctx({ isPeak: true })).deficit).toBe(0)
    expect(dayTargets(lose, ctx({ isPeak: true })).warnings).toContain('no_deficit_peak')
    expect(dayTargets(lose, ctx({ isTaper: true })).warnings).toContain('no_deficit_taper')
  })

  it('минимум калорий и предупреждение о недоедании', () => {
    const small: NutritionProfile = {
      sex: 'female',
      weightKg: 48,
      heightCm: 155,
      age: 40,
      weightGoal: 'lose',
    }
    const t = dayTargets(small, ctx())
    expect(t.calories).toBeGreaterThanOrEqual(1200)
    expect(t.fatG).toBeGreaterThanOrEqual(38)
  })
})

describe('fueling', () => {
  it('короткая тренировка — без еды во время; длительная — 30–60 г/ч и электролиты', () => {
    const short = fuelingFor({ type: 'easy', estimatedSeconds: 2400, targetDistanceM: null }, 70, {
      hot: false,
      marathonPhase: false,
    })
    expect(short.duringCarbsPerHour).toBeNull()
    expect(short.electrolytes).toBe(false)
    const long = fuelingFor({ type: 'long', estimatedSeconds: 6000, targetDistanceM: null }, 70, {
      hot: true,
      marathonPhase: true,
    })
    expect(long.duringCarbsPerHour).toEqual([30, 60])
    expect(long.electrolytes).toBe(true)
    expect(long.gutTraining).toBe(true)
    expect(long.fluidsMlPerHour).toEqual([600, 800])
  })

  it('углеводная загрузка и день старта', () => {
    const plan = carbLoadPlan(70)
    expect(plan.map((d) => d.carbsG)).toEqual([560, 700, 700])
    const race = raceDayPlan(70, 300)
    expect(race[0]!.minutesFromStart).toBe(-180)
    expect(race.filter((s) => s.key === 'during').length).toBeGreaterThan(5)
    expect(race[race.length - 1]!.key).toBe('finish')
  })
})

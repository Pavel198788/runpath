import type { DayWorkout } from './targets'

/** Питание вокруг конкретной тренировки. Числа — docs/PHYSIOLOGY.md §7. */
export interface FuelingAdvice {
  /** За 1–3 часа до: диапазон углеводов, г. */
  beforeCarbsG: [number, number]
  /** Во время: г углеводов в час; null — не нужно (короткая тренировка). */
  duringCarbsPerHour: [number, number] | null
  /** Пить, мл/час. */
  fluidsMlPerHour: [number, number]
  /** Электролиты нужны (длительная > 90 мин или жара). */
  electrolytes: boolean
  /** После: углеводы и белок, г. */
  afterCarbsG: number
  afterProteinG: [number, number]
  /** Тренировать желудок: пробовать гели/еду на этой длительной. */
  gutTraining: boolean
}

export function fuelingFor(
  w: DayWorkout,
  weightKg: number,
  opts: { hot: boolean; marathonPhase: boolean },
): FuelingAdvice {
  const minutes = w.estimatedSeconds / 60
  const long = minutes >= 75
  const veryLong = minutes >= 90
  return {
    beforeCarbsG: [Math.round(weightKg * 1), Math.round(weightKg * (long ? 2.5 : 1.5))],
    duringCarbsPerHour: long
      ? w.type === 'race' && opts.marathonPhase
        ? [60, 90]
        : [30, 60]
      : null,
    fluidsMlPerHour: opts.hot ? [600, 800] : [400, 600],
    electrolytes: veryLong || opts.hot,
    afterCarbsG: Math.round(weightKg * (long ? 1.2 : 1)),
    afterProteinG: [20, 30],
    gutTraining: long && (w.type === 'long' || w.type === 'race') && opts.marathonPhase,
  }
}

export interface CarbLoadDay {
  daysBeforeRace: number
  carbsPerKg: number
  carbsG: number
  tips: string[]
}

/** Углеводная загрузка на 3 дня: 8 → 10 → 10 г/кг, меньше клетчатки и жира, соль и вода. */
export function carbLoadPlan(weightKg: number): CarbLoadDay[] {
  const days = [
    { d: 3, cpk: 8, tips: ['reduce_fiber', 'familiar_food'] },
    { d: 2, cpk: 10, tips: ['small_frequent', 'salt_water'] },
    { d: 1, cpk: 10, tips: ['early_dinner', 'no_new_food'] },
  ]
  return days.map(({ d, cpk, tips }) => ({
    daysBeforeRace: d,
    carbsPerKg: cpk,
    carbsG: Math.round(weightKg * cpk),
    tips,
  }))
}

export interface RaceDayStep {
  /** Минут до старта (отрицательные — после старта). */
  minutesFromStart: number
  key: string
  /** Подстановки для текста. */
  params: Record<string, number>
}

/** План на день старта по часам от времени старта. */
export function raceDayPlan(weightKg: number, raceMinutes: number): RaceDayStep[] {
  const steps: RaceDayStep[] = [
    { minutesFromStart: -180, key: 'breakfast', params: { carbs: Math.round(weightKg * 2) } },
    { minutesFromStart: -90, key: 'sip', params: { ml: 300 } },
    { minutesFromStart: -30, key: 'topup', params: { carbs: 25 } },
    { minutesFromStart: 0, key: 'start', params: {} },
  ]
  for (let m = 40; m < raceMinutes - 15; m += 25) {
    steps.push({ minutesFromStart: m, key: 'during', params: { carbs: 20, ml: 150 } })
  }
  steps.push({
    minutesFromStart: raceMinutes,
    key: 'finish',
    params: { carbs: Math.round(weightKg * 1.2), protein: 25 },
  })
  return steps
}

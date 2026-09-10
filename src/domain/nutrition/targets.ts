import type { Phase, WorkoutType } from '@/domain/plan/types'

/**
 * Расчёт дневных целей по питанию. Правила — docs/PHYSIOLOGY.md §7.
 * Всё детерминировано и без побочных эффектов.
 */
export type Sex = 'male' | 'female' | 'other'
export type WeightGoal = 'lose' | 'maintain' | 'none'

export interface NutritionProfile {
  sex: Sex | null
  weightKg: number
  heightCm: number | null
  age: number | null
  weightGoal: WeightGoal
}

export interface DayWorkout {
  type: WorkoutType
  estimatedSeconds: number
  targetDistanceM: number | null
}

export interface DayContext {
  phase: Phase | null
  workouts: DayWorkout[]
  isTaper: boolean
  /** Одна из двух последних рабочих недель перед тейпером. */
  isPeak: boolean
  isRaceWeek: boolean
  /** До старта 1–3 дня — углеводная загрузка. */
  daysToRace: number | null
  /** Предполагаемый темп, сек/км, для перевода времени в километры. */
  paceSecPerKm: number
}

export type DayKind = 'rest' | 'easy' | 'quality' | 'long' | 'race' | 'carb_load'

export type NutritionWarning =
  'no_deficit_peak' | 'no_deficit_taper' | 'min_calories' | 'red_s' | 'no_weight'

export interface DayTargets {
  kind: DayKind
  bmr: number
  tdee: number
  workoutKcal: number
  calories: number
  carbsG: number
  proteinG: number
  fatG: number
  carbsPerKg: number
  deficit: number
  warnings: NutritionWarning[]
}

/** Mifflin-St Jeor. Для «other» — среднее между формулами. */
export function bmr(p: {
  sex: Sex | null
  weightKg: number
  heightCm: number
  age: number
}): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  if (p.sex === 'male') return Math.round(base + 5)
  if (p.sex === 'female') return Math.round(base - 161)
  return Math.round(base - 78)
}

/** Энергозатраты тренировки: ходьба ≈ 0,5, бег ≈ 1,0 ккал/кг/км; ОФП ≈ 0,07 ккал/кг/мин. */
export function workoutKcal(w: DayWorkout, weightKg: number, paceSecPerKm: number): number {
  if (w.type === 'strength') return Math.round((w.estimatedSeconds / 60) * 0.07 * weightKg)
  const km = w.targetDistanceM
    ? w.targetDistanceM / 1000
    : (w.estimatedSeconds - 600) / paceSecPerKm
  const perKgKm = w.type === 'walk' ? 0.5 : w.type === 'run_walk' ? 0.75 : 1.0
  return Math.round(Math.max(0, km) * perKgKm * weightKg)
}

export function dayKind(ctx: DayContext): DayKind {
  if (ctx.daysToRace !== null && ctx.daysToRace >= 1 && ctx.daysToRace <= 3) return 'carb_load'
  const runs = ctx.workouts.filter((w) => w.type !== 'strength')
  if (runs.some((w) => w.type === 'race')) return 'race'
  if (runs.some((w) => w.type === 'long')) return 'long'
  if (runs.some((w) => w.type === 'tempo' || w.type === 'fartlek')) return 'quality'
  if (runs.length > 0) return 'easy'
  return 'rest'
}

/** Углеводы, г/кг, по фазе и типу дня. */
export function carbsPerKg(phase: Phase | null, kind: DayKind): number {
  if (kind === 'carb_load') return 9
  if (kind === 'race') return 8
  const base: Record<Phase, number> = {
    walk: 3.5,
    base: 4,
    k5: 4.5,
    k10: 5,
    half: 5.5,
    marathon: 6,
  }
  const b = phase ? base[phase] : 4
  if (kind === 'rest') return Math.max(3, b - 1)
  if (kind === 'long') return b + 1
  if (kind === 'quality') return b + 0.5
  return b
}

export function dayTargets(profile: NutritionProfile, ctx: DayContext): DayTargets {
  const warnings: NutritionWarning[] = []
  const kind = dayKind(ctx)
  const weight = profile.weightKg
  const base = bmr({
    sex: profile.sex,
    weightKg: weight,
    heightCm: profile.heightCm ?? 170,
    age: profile.age ?? 35,
  })
  const workout = ctx.workouts.reduce((s, w) => s + workoutKcal(w, weight, ctx.paceSecPerKm), 0)
  const tdee = Math.round(base * 1.2 + workout)

  // Дефицит — только при цели «снизить вес» и не на пике/тейпере/гоночной неделе.
  let deficit = 0
  if (profile.weightGoal === 'lose') {
    if (ctx.isPeak) warnings.push('no_deficit_peak')
    else if (ctx.isTaper || ctx.isRaceWeek || kind === 'carb_load' || kind === 'race')
      warnings.push('no_deficit_taper')
    else deficit = Math.round(Math.min(500, tdee * 0.15))
  }
  let calories = tdee - deficit
  const minCalories = profile.sex === 'female' ? 1200 : 1500
  if (calories < minCalories) {
    calories = minCalories
    deficit = tdee - calories
    warnings.push('min_calories')
  }

  const proteinPerKg = profile.weightGoal === 'lose' ? 1.8 : 1.6
  const proteinG = Math.round(weight * proteinPerKg)
  const cpk = carbsPerKg(ctx.phase, kind)
  let carbsG = Math.round(weight * cpk)
  const minFatG = Math.round(weight * 0.8)
  let fatG = Math.round((calories - proteinG * 4 - carbsG * 4) / 9)
  if (fatG < minFatG) {
    // Жиры ниже минимума — урезаем углеводы, но не ниже 3 г/кг; иначе это уже недоедание.
    fatG = minFatG
    carbsG = Math.round((calories - proteinG * 4 - fatG * 9) / 4)
    const minCarbs = Math.round(weight * 3)
    if (carbsG < minCarbs) {
      carbsG = minCarbs
      warnings.push('red_s')
    }
  }
  // Итоговая калорийность — из макросов, чтобы цифры на экране сходились.
  const finalCalories = proteinG * 4 + carbsG * 4 + fatG * 9

  return {
    kind,
    bmr: base,
    tdee,
    workoutKcal: workout,
    calories: finalCalories,
    carbsG,
    proteinG,
    fatG,
    carbsPerKg: Math.round((carbsG / weight) * 10) / 10,
    deficit,
    warnings,
  }
}

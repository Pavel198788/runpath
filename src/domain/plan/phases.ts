import type { Phase } from './types'

/**
 * Параметры фаз. Числа — из docs/PHYSIOLOGY.md.
 * Доля длительной в марафонской фазе выше 35%: у новичка пиковая неделя ~60–65 км,
 * а длительная 30–32 км — это ~50%. Меньше нельзя (не будет готовности к 42 км),
 * а больше объёма новичку опасно. Это осознанное исключение, см. PHYSIOLOGY §3.
 */
export interface PhaseSpec {
  phase: Phase
  weeks: number
  runDays: number
  unit: 'min' | 'km'
  growth: number
  recoveryEvery: number
  taperWeeks: number
  longShare: number
  longCap: number
  longGrowthCap: number
  peakVolume: number
  quality: 'none' | 'fartlek' | 'tempo'
  qualityFromWeek: number
  raceKm: number | null
}

export const PHASE_SPECS: Record<Exclude<Phase, 'walk' | 'base'>, PhaseSpec> = {
  k5: {
    phase: 'k5',
    weeks: 5,
    runDays: 3,
    unit: 'min',
    growth: 0.1,
    recoveryEvery: 4,
    taperWeeks: 0,
    longShare: 0.35,
    longCap: 45,
    longGrowthCap: 5,
    peakVolume: 120,
    quality: 'none',
    qualityFromWeek: 99,
    raceKm: 5,
  },
  k10: {
    phase: 'k10',
    weeks: 8,
    runDays: 3,
    unit: 'km',
    growth: 0.1,
    recoveryEvery: 4,
    taperWeeks: 1,
    longShare: 0.35,
    longCap: 10,
    longGrowthCap: 1.5,
    peakVolume: 28,
    quality: 'fartlek',
    qualityFromWeek: 3,
    raceKm: 10,
  },
  half: {
    phase: 'half',
    weeks: 12,
    runDays: 4,
    unit: 'km',
    growth: 0.1,
    recoveryEvery: 4,
    taperWeeks: 2,
    longShare: 0.4,
    longCap: 20,
    longGrowthCap: 2,
    peakVolume: 48,
    quality: 'tempo',
    qualityFromWeek: 2,
    raceKm: 21.1,
  },
  marathon: {
    phase: 'marathon',
    weeks: 16,
    runDays: 4,
    unit: 'km',
    growth: 0.1,
    recoveryEvery: 4,
    taperWeeks: 3,
    longShare: 0.5,
    longCap: 32,
    longGrowthCap: 2,
    peakVolume: 64,
    quality: 'tempo',
    qualityFromWeek: 2,
    raceKm: 42.2,
  },
}

/** Интервальная таблица базовой фазы (секунды). run/walk/reps — блок между разминкой и заминкой. */
export interface BaseWeekTemplate {
  run: number
  walk: number
  reps: number
}

export const BASE_WEEKS: BaseWeekTemplate[] = [
  { run: 60, walk: 120, reps: 8 },
  { run: 90, walk: 120, reps: 7 },
  { run: 120, walk: 120, reps: 6 },
  { run: 180, walk: 120, reps: 5 },
  { run: 300, walk: 120, reps: 4 },
  { run: 480, walk: 120, reps: 3 },
  { run: 720, walk: 120, reps: 2 },
  { run: 900, walk: 120, reps: 2 }, // 15 / 2 / 15
  { run: 1200, walk: 120, reps: 1 }, // 20 / 2 / 10 — второй отрезок короче, см. buildBaseSegments
  { run: 1500, walk: 0, reps: 1 },
  { run: 1800, walk: 0, reps: 1 },
  { run: 1800, walk: 0, reps: 1 },
]

/** Уровень «чередую бег и ходьбу» стартует с 5-й недели таблицы. */
export const BASE_START_WEEK_FOR_RUN_WALK = 4

export const WARMUP_SECONDS = 300
export const COOLDOWN_SECONDS = 300
export const STRENGTH_SECONDS = 20 * 60

/** Недели прогулок для «фазы 0» в минутах одной прогулки. */
export function walkPhaseWeeks(walkMinutes: number | null): number[] {
  if (walkMinutes !== null && walkMinutes < 20) return [20, 25, 30, 35]
  return [25, 30, 35]
}

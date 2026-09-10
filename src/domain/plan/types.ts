import type { IsoDate } from '@/domain/dates/dates'

/** Фазы пути. Порядок важен — по нему считаем «откуда до куда». */
export const PHASES = ['walk', 'base', 'k5', 'k10', 'half', 'marathon'] as const
export type Phase = (typeof PHASES)[number]

export type WorkoutType =
  | 'walk' // прогулка
  | 'run_walk' // интервалы ходьба/бег
  | 'easy' // лёгкий бег
  | 'long' // длительная
  | 'tempo' // темповая
  | 'fartlek' // фартлек
  | 'strength' // ОФП
  | 'race' // целевой старт (5/10/21,1/42,2)

export type SegmentKind = 'warmup' | 'walk' | 'run' | 'fast' | 'tempo' | 'cooldown' | 'strength'

/** Отрезок тренировки. Всегда по времени — таймер умеет только считать секунды. */
export interface Segment {
  kind: SegmentKind
  seconds: number
  /** Целевое усилие по шкале ощущений 1–10 (диапазон). */
  rpe: [number, number]
}

export type WorkoutStatus = 'planned' | 'done' | 'partial' | 'skipped'

export interface WorkoutCore {
  id: string
  planId: string
  date: IsoDate
  weekIndex: number
  phase: Phase
  type: WorkoutType
  segments: Segment[]
  /** Общая длительность по сегментам (сек). */
  estimatedSeconds: number
  /** Целевая дистанция, если тренировка «в километрах» (м). */
  targetDistanceM: number | null
  status: WorkoutStatus
}

export interface PlanWeekCore {
  index: number
  phase: Phase
  startDate: IsoDate
  isRecovery: boolean
  isTaper: boolean
  /** Неделя с целевым стартом (5/10/21,1/42,2 км) — длительная заменена гонкой. */
  isRace: boolean
  /** Объём недели: минуты бега (фазы walk/base/k5) или км (дальше). */
  unit: 'min' | 'km'
  volume: number
  longRun: number
}

export type PlanWarning = 'target_date_too_early' | 'target_date_later' | 'conservative'

export interface PlanPhaseRange {
  phase: Phase
  fromWeek: number
  toWeek: number
}

export interface PlanCore {
  id: string
  startDate: IsoDate
  endDate: IsoDate
  goal: 'start_running' | 'half_marathon' | 'marathon'
  weeks: PlanWeekCore[]
  phases: PlanPhaseRange[]
  /** Предполагаемый лёгкий темп (сек/км) для перевода км ↔ минуты. */
  assumedPaceSecPerKm: number
  warnings: PlanWarning[]
  /** Дата, которую хотел пользователь (для сравнения с endDate). */
  targetDate: IsoDate | null
}

export interface GeneratedPlan {
  plan: PlanCore
  workouts: WorkoutCore[]
}

/** Входные данные генератора — подмножество профиля без служебных полей. */
export interface PlanInput {
  activityLevel: 'never_ran' | 'walk_30' | 'run_walk' | 'run_5k' | 'run_10k'
  goal: 'start_running' | 'half_marathon' | 'marathon'
  /** Сколько минут человек может идти быстрым шагом без остановки (если знает). */
  walkMinutes: number | null
  healthFlags: string[]
  birthYear: number | null
  /** Доступные дни: 0 = пн … 6 = вс. Минимум 3. */
  availableDays: number[]
  targetDate: IsoDate | null
}

export interface PlanOptions {
  /** Дата «сегодня» — чтобы тесты были детерминированными. */
  now: Date
  /** Генератор id — в тестах подменяется на предсказуемый. */
  idGen: () => string
}

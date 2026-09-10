import type { WorkoutType } from '@/domain/plan/types'

export interface LogLike {
  date: string
  type: WorkoutType
  durationSec: number
  distanceM: number | null
  workoutId: string | null
}

export type AchievementId =
  | 'first_workout'
  | 'first_30min_run'
  | 'first_5k'
  | 'first_10k'
  | 'first_15k_long'
  | 'first_half'
  | 'first_marathon'
  | 'total_100k'
  | 'total_500k'
  | 'total_1000k'
  | 'workouts_10'
  | 'workouts_50'
  | 'workouts_100'
  | 'streak_4'
  | 'streak_12'
  | 'early_bird'

export interface Unlocked {
  id: AchievementId
  date: string
}

const RUN_TYPES: WorkoutType[] = ['run_walk', 'easy', 'long', 'tempo', 'fartlek', 'race']

/**
 * Достижения считаются заново по всему журналу — так они не зависят от порядка записи
 * и корректно исчезают при удалении записи. Возвращает дату первого выполнения.
 */
export function evaluateAchievements(logs: LogLike[], streakWeeks: number): Unlocked[] {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date))
  const out = new Map<AchievementId, string>()
  const unlock = (id: AchievementId, date: string) => {
    if (!out.has(id)) out.set(id, date)
  }
  let total = 0
  let count = 0
  for (const l of sorted) {
    count++
    total += l.distanceM ?? 0
    unlock('first_workout', l.date)
    const run = RUN_TYPES.includes(l.type)
    const km = (l.distanceM ?? 0) / 1000
    if (run && l.durationSec >= 30 * 60 && l.type !== 'run_walk') unlock('first_30min_run', l.date)
    if (run && km >= 5) unlock('first_5k', l.date)
    if (run && km >= 10) unlock('first_10k', l.date)
    if (run && km >= 15 && (l.type === 'long' || l.type === 'race'))
      unlock('first_15k_long', l.date)
    if (run && km >= 21) unlock('first_half', l.date)
    if (run && km >= 42) unlock('first_marathon', l.date)
    if (total >= 100_000) unlock('total_100k', l.date)
    if (total >= 500_000) unlock('total_500k', l.date)
    if (total >= 1_000_000) unlock('total_1000k', l.date)
    if (count >= 10) unlock('workouts_10', l.date)
    if (count >= 50) unlock('workouts_50', l.date)
    if (count >= 100) unlock('workouts_100', l.date)
  }
  const last = sorted[sorted.length - 1]
  if (last && streakWeeks >= 4) unlock('streak_4', last.date)
  if (last && streakWeeks >= 12) unlock('streak_12', last.date)
  return [...out.entries()].map(([id, date]) => ({ id, date }))
}

export const ALL_ACHIEVEMENTS: AchievementId[] = [
  'first_workout',
  'first_30min_run',
  'first_5k',
  'first_10k',
  'first_15k_long',
  'first_half',
  'first_marathon',
  'total_100k',
  'total_500k',
  'total_1000k',
  'workouts_10',
  'workouts_50',
  'workouts_100',
  'streak_4',
  'streak_12',
]

export type Level = 'walker' | 'jogger' | 'runner' | 'half' | 'marathon'

/** Уровень — по лучшему реально пройденному результату, а не по плану. */
export function levelOf(unlocked: Unlocked[]): Level {
  const has = (id: AchievementId) => unlocked.some((u) => u.id === id)
  if (has('first_marathon')) return 'marathon'
  if (has('first_half')) return 'half'
  if (has('first_10k')) return 'runner'
  if (has('first_30min_run') || has('first_5k')) return 'jogger'
  return 'walker'
}

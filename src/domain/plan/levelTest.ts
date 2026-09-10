import type { PlanInput } from './types'

/**
 * Тест уровня в первую неделю: человек идёт/бежит без остановки сколько может (до 30 минут).
 * По результату уточняем стартовый уровень — план можно пересобрать.
 */
export interface LevelTestResult {
  mode: 'walk' | 'run'
  minutes: number
}

export function levelFromTest(
  r: LevelTestResult,
  current: PlanInput['activityLevel'],
): { level: PlanInput['activityLevel']; walkMinutes: number | null; changed: boolean } {
  let level: PlanInput['activityLevel']
  let walkMinutes: number | null = null
  if (r.mode === 'walk') {
    walkMinutes = r.minutes
    level = r.minutes >= 30 ? 'walk_30' : 'never_ran'
  } else {
    level = r.minutes >= 30 ? 'run_5k' : r.minutes >= 8 ? 'run_walk' : 'walk_30'
  }
  // Не понижаем уровень тех, кто уже бегает 10 км — тест для новичков.
  if (current === 'run_10k') level = current
  return { level, walkMinutes, changed: level !== current }
}

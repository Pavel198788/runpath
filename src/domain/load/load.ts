import type { WorkoutType } from '@/domain/plan/types'
import { addDaysIso } from '@/domain/dates/dates'

/**
 * Нагрузка тренировки по методу Фостера (sRPE): минуты × усилие (1–10).
 * Если человек не указал RPE, берём типичное значение для типа тренировки.
 */
const DEFAULT_RPE: Record<WorkoutType, number> = {
  walk: 2,
  run_walk: 4,
  easy: 4,
  long: 5,
  tempo: 7,
  fartlek: 6,
  strength: 4,
  race: 7,
}

export interface LoadEntry {
  date: string
  durationSec: number
  rpe: number | null
  type: WorkoutType
}

export function sessionLoad(entry: LoadEntry): number {
  const rpe = entry.rpe ?? DEFAULT_RPE[entry.type]
  return Math.round((entry.durationSec / 60) * rpe)
}

/** Нагрузка по дням за период [from, to] включительно (дни без тренировок = 0). */
export function dailyLoads(entries: LoadEntry[], from: string, to: string): number[] {
  const map = new Map<string, number>()
  for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + sessionLoad(e))
  const days: number[] = []
  for (let d = from; d <= to; d = addDaysIso(d, 1)) days.push(map.get(d) ?? 0)
  return days
}

export type AcwrZone = 'insufficient' | 'low' | 'safe' | 'caution' | 'risk'

export interface AcwrResult {
  acute: number
  chronic: number
  ratio: number | null
  zone: AcwrZone
}

/**
 * ACWR — отношение острой нагрузки (среднее за 7 дней) к хронической (среднее за 28).
 * Зоны: <0,8 недогрузка · 0,8–1,3 безопасно · 1,3–1,5 осторожно · >1,5 риск.
 * Считаем только когда первая запись старше 3 недель (иначе 'insufficient').
 */
export function acwr(entries: LoadEntry[], today: string): AcwrResult {
  const from28 = addDaysIso(today, -27)
  const from7 = addDaysIso(today, -6)
  const loads28 = dailyLoads(entries, from28, today)
  const loads7 = dailyLoads(entries, from7, today)
  const acute = avg(loads7)
  const chronic = avg(loads28)
  const firstDate = entries.map((e) => e.date).sort()[0]
  const enoughHistory = firstDate !== undefined && firstDate <= addDaysIso(today, -21)
  if (!enoughHistory || chronic <= 0) return { acute, chronic, ratio: null, zone: 'insufficient' }
  const ratio = acute / chronic
  const zone: AcwrZone =
    ratio < 0.8 ? 'low' : ratio <= 1.3 ? 'safe' : ratio <= 1.5 ? 'caution' : 'risk'
  return { acute, chronic, ratio: Math.round(ratio * 100) / 100, zone }
}

/** Монотонность недели: среднее / стандартное отклонение дневных нагрузок. >2 — «слишком одинаково». */
export function monotony(weekLoads: number[]): number | null {
  if (weekLoads.length < 7) return null
  const mean = avg(weekLoads)
  const sd = Math.sqrt(avg(weekLoads.map((v) => (v - mean) ** 2)))
  if (sd === 0) return mean === 0 ? null : Infinity
  return Math.round((mean / sd) * 100) / 100
}

function avg(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
}

/**
 * Индекс готовности на сегодня (0–100) по сну, стрессу и пульсу покоя.
 * Не диагноз — подсказка «стоит ли сегодня делать тяжёлую тренировку».
 */
export interface ReadinessInput {
  sleepHours: number | null
  /** 1 (спокойно) … 5 (очень напряжённо). */
  stress: number | null
  restingHr: number | null
  /** Средний пульс покоя за последние 2 недели (базовая линия). */
  baselineHr: number | null
  sick: boolean
}

export type ReadinessLevel = 'unknown' | 'low' | 'medium' | 'high'

export interface Readiness {
  score: number | null
  level: ReadinessLevel
  /** Ключи причин для объяснения. */
  reasons: Array<
    'sick' | 'short_sleep' | 'high_stress' | 'elevated_hr' | 'good_sleep' | 'calm' | 'normal_hr'
  >
}

export function readiness(input: ReadinessInput): Readiness {
  if (input.sick) return { score: 0, level: 'low', reasons: ['sick'] }
  const parts: number[] = []
  const reasons: Readiness['reasons'] = []
  if (input.sleepHours !== null) {
    const s =
      input.sleepHours >= 7.5
        ? 100
        : input.sleepHours >= 6.5
          ? 75
          : input.sleepHours >= 5.5
            ? 45
            : 20
    parts.push(s)
    reasons.push(s >= 75 ? 'good_sleep' : 'short_sleep')
  }
  if (input.stress !== null) {
    const s = [100, 85, 65, 40, 20][Math.min(5, Math.max(1, input.stress)) - 1]!
    parts.push(s)
    reasons.push(s >= 65 ? 'calm' : 'high_stress')
  }
  if (input.restingHr !== null && input.baselineHr !== null) {
    const diff = input.restingHr - input.baselineHr
    const s = diff <= 2 ? 100 : diff <= 5 ? 75 : diff <= 8 ? 45 : 20
    parts.push(s)
    reasons.push(s >= 75 ? 'normal_hr' : 'elevated_hr')
  }
  if (parts.length === 0) return { score: null, level: 'unknown', reasons: [] }
  const score = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)
  return { score, level: score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low', reasons }
}

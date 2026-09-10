import type { WorkoutType } from '@/domain/plan/types'

export interface ReportLog {
  date: string
  type: WorkoutType
  durationSec: number
  distanceM: number | null
  rpe: number | null
}

export interface ReportWorkout {
  date: string
  type: WorkoutType
  status: 'planned' | 'done' | 'partial' | 'skipped'
}

export interface WeeklyReport {
  plannedRuns: number
  doneRuns: number
  minutes: number
  km: number
  avgRpe: number | null
  /** Ключ вывода для текста: great / ok / partial / missed / none. */
  verdict: 'great' | 'ok' | 'partial' | 'missed' | 'none'
}

/** Итог недели: сколько сделано из плана и как это ощущалось. */
export function weeklyReport(logs: ReportLog[], workouts: ReportWorkout[]): WeeklyReport {
  const runsPlanned = workouts.filter((w) => w.type !== 'strength')
  const done = runsPlanned.filter((w) => w.status === 'done' || w.status === 'partial').length
  const minutes = Math.round(logs.reduce((a, l) => a + l.durationSec, 0) / 60)
  const km = Math.round(logs.reduce((a, l) => a + (l.distanceM ?? 0), 0) / 100) / 10
  const rpes = logs.map((l) => l.rpe).filter((r): r is number => r !== null)
  const avgRpe = rpes.length
    ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10
    : null
  let verdict: WeeklyReport['verdict'] = 'none'
  if (runsPlanned.length > 0) {
    const ratio = done / runsPlanned.length
    verdict = ratio >= 1 ? 'great' : ratio >= 0.66 ? 'ok' : ratio > 0 ? 'partial' : 'missed'
  } else if (logs.length > 0) verdict = 'ok'
  return { plannedRuns: runsPlanned.length, doneRuns: done, minutes, km, avgRpe, verdict }
}

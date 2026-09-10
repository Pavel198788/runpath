import { addDaysIso, type IsoDate } from '@/domain/dates/dates'
import type { GeneratedPlan, PlanPhaseRange, PlanWeekCore, WorkoutCore } from './types'

/**
 * Растягивает план под более позднюю желаемую дату: перед тейпером последней фазы
 * вставляются недели закрепления (копии двух последних рабочих недель, каждая 4-я — разгрузочная).
 * Объём не растёт — это «плато», безопасное по определению.
 */
export function stretchPlanToDate(
  generated: GeneratedPlan,
  targetDate: IsoDate,
  idGen: () => string,
): GeneratedPlan {
  const { plan, workouts } = generated
  const extra = Math.floor(
    (new Date(targetDate).getTime() - new Date(plan.endDate).getTime()) / (7 * 86_400_000),
  )
  if (extra < 1) return generated

  const lastPhase = plan.phases[plan.phases.length - 1]!
  const phaseWeeks = plan.weeks.filter((w) => w.phase === lastPhase.phase)
  const firstTaper = phaseWeeks.find((w) => w.isTaper)
  const insertAt = firstTaper ? firstTaper.index : plan.weeks.length
  const sources = plan.weeks
    .slice(Math.max(0, insertAt - 2), insertAt)
    .filter((w) => !w.isRecovery && !w.isTaper && !w.isRace)
  if (sources.length === 0) return generated

  const before = plan.weeks.slice(0, insertAt)
  const after = plan.weeks.slice(insertAt)
  const newWeeks: PlanWeekCore[] = []
  const newWorkouts: WorkoutCore[] = []
  // Разгрузка каждую 4-ю рабочую неделю с учётом недель, идущих до вставки.
  let sinceRecovery = 0
  for (let i = before.length - 1; i >= 0 && !before[i]!.isRecovery; i--) sinceRecovery++
  let srcIdx = 0
  for (let i = 0; i < extra; i++) {
    const index = insertAt + i
    const startDate = addDaysIso(plan.startDate, index * 7)
    const recovery = sinceRecovery >= 3
    sinceRecovery = recovery ? 0 : sinceRecovery + 1
    const src = sources[srcIdx % sources.length]!
    if (!recovery) srcIdx++
    const scale = recovery ? 0.75 : 1
    newWeeks.push({
      ...src,
      index,
      startDate,
      isRecovery: recovery,
      volume: round1(src.volume * scale),
      longRun: round1(src.longRun * scale),
    })
    for (const w of workouts.filter((x) => x.weekIndex === src.index)) {
      const offset = Math.round(
        (new Date(w.date).getTime() - new Date(src.startDate).getTime()) / 86_400_000,
      )
      newWorkouts.push({
        ...w,
        id: idGen(),
        weekIndex: index,
        date: addDaysIso(startDate, offset),
        segments:
          recovery && w.type !== 'strength'
            ? w.segments.map((s) =>
                s.kind === 'run' || s.kind === 'tempo' || s.kind === 'fast'
                  ? { ...s, seconds: Math.round(s.seconds * scale) }
                  : s,
              )
            : w.segments,
        estimatedSeconds:
          recovery && w.type !== 'strength'
            ? Math.round(w.estimatedSeconds * scale)
            : w.estimatedSeconds,
        targetDistanceM:
          recovery && w.targetDistanceM ? Math.round(w.targetDistanceM * scale) : w.targetDistanceM,
      })
    }
  }
  const shiftedAfter = after.map((w) => ({
    ...w,
    index: w.index + extra,
    startDate: addDaysIso(w.startDate, extra * 7),
  }))
  const shiftedWorkouts = workouts.map((w) =>
    w.weekIndex >= insertAt
      ? { ...w, weekIndex: w.weekIndex + extra, date: addDaysIso(w.date, extra * 7) }
      : w,
  )
  const allWeeks = [...before, ...newWeeks, ...shiftedAfter]
  const phases: PlanPhaseRange[] = []
  for (const w of allWeeks) {
    const last = phases[phases.length - 1]
    if (last && last.phase === w.phase) last.toWeek = w.index
    else phases.push({ phase: w.phase, fromWeek: w.index, toWeek: w.index })
  }
  const all = [...shiftedWorkouts, ...newWorkouts].sort((a, b) => a.date.localeCompare(b.date))
  return {
    plan: {
      ...plan,
      weeks: allWeeks,
      phases,
      endDate: all[all.length - 1]!.date,
      warnings: plan.warnings.filter((w) => w !== 'target_date_later'),
    },
    workouts: all,
  }
}

function round1(v: number) {
  return Math.round(v * 10) / 10
}

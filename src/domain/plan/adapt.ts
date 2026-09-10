import { differenceInCalendarDays } from 'date-fns'
import { addDaysIso, fromIsoDate, type IsoDate } from '@/domain/dates/dates'
import { buildSegments, totalSeconds } from './segments'
import type { PlanCore, PlanPhaseRange, PlanWeekCore, Segment, WorkoutCore } from './types'

/**
 * Адаптация плана к факту (docs/PHYSIOLOGY.md §4–5). Правила:
 * - пропуск 1 недели → повтор последней выполненной;
 * - пропуск 2 недель → откат на 1 неделю; 3–4 → на 2; больше → на 3 и совет пересобрать;
 * - болезнь → после выздоровления первая неделя −50% и только лёгкий бег;
 * - слишком тяжело (RPE ≥ 8 в двух тренировках или две «частично») → повтор недели,
 *   но не больше двух повторов подряд, затем откат на неделю.
 * Всё это — чистые функции; запись в БД делает слой data.
 */

export interface WeekReview {
  weekIndex: number
  plannedRuns: number
  doneRuns: number
  partialRuns: number
  hardRuns: number
  sickDays: number
  /** Ни одной беговой не выполнено (или болел ≥ 2 дней). */
  missed: boolean
  tooHard: boolean
}

export type AdjustmentReason =
  'missed_1' | 'missed_2' | 'missed_3_4' | 'missed_5' | 'too_hard' | 'illness'
export type AdjustmentKind = 'repeat_week' | 'rollback' | 'illness_recovery'

export interface Adjustment {
  kind: AdjustmentKind
  reason: AdjustmentReason
  /** Неделя (индекс), по итогам которой принято решение. */
  reviewedWeek: number
  /** Какие недели скопировать перед продолжением. */
  sourceWeeks: number[]
  /** С какой недели плана продолжить после вставок. */
  continueFrom: number
  /** Масштаб первой вставленной недели (0.5 после болезни). */
  firstWeekScale: number
  /** Рекомендуем пересобрать план (пропуск > 4 недель). */
  suggestRebuild: boolean
}

interface ReviewInput {
  week: PlanWeekCore
  workouts: WorkoutCore[]
  /** RPE выполненных тренировок этой недели (по workoutId). */
  rpeByWorkout: Map<string, number | null>
  sickDates: Set<IsoDate>
}

export function reviewWeek({ week, workouts, rpeByWorkout, sickDates }: ReviewInput): WeekReview {
  const runs = workouts.filter((w) => w.weekIndex === week.index && w.type !== 'strength')
  const done = runs.filter((w) => w.status === 'done')
  const partial = runs.filter((w) => w.status === 'partial')
  const hard = [...done, ...partial].filter((w) => (rpeByWorkout.get(w.id) ?? 0) >= 8)
  let sickDays = 0
  for (let i = 0; i < 7; i++) if (sickDates.has(addDaysIso(week.startDate, i))) sickDays++
  const missed = (runs.length > 0 && done.length + partial.length === 0) || sickDays >= 2
  const tooHard = !missed && (hard.length >= 2 || partial.length >= 2)
  return {
    weekIndex: week.index,
    plannedRuns: runs.length,
    doneRuns: done.length,
    partialRuns: partial.length,
    hardRuns: hard.length,
    sickDays,
    missed,
    tooHard,
  }
}

/**
 * Решение по последовательности прошедших недель (последняя — только что закончившаяся).
 * previous — уже применённые корректировки (чтобы не повторять неделю бесконечно).
 */
export function decideAdjustment(reviews: WeekReview[], previous: Adjustment[]): Adjustment | null {
  const last = reviews[reviews.length - 1]
  if (!last) return null

  // Сколько подряд пропущенных/больных недель в конце.
  let n = 0
  for (let i = reviews.length - 1; i >= 0 && reviews[i]!.missed; i--) n++

  if (n >= 1) {
    const firstMissed = last.weekIndex - n + 1
    const illness = reviews.slice(-n).some((r) => r.sickDays > 0)
    const rollback = n === 1 ? 1 : n === 2 ? 1 : n <= 4 ? 2 : 3
    const from = Math.max(0, firstMissed - rollback)
    const sourceWeeks = range(from, firstMissed - 1)
    if (sourceWeeks.length === 0) sourceWeeks.push(firstMissed)
    const reason: AdjustmentReason = illness
      ? 'illness'
      : n === 1
        ? 'missed_1'
        : n === 2
          ? 'missed_2'
          : n <= 4
            ? 'missed_3_4'
            : 'missed_5'
    return {
      kind: illness ? 'illness_recovery' : n === 1 ? 'repeat_week' : 'rollback',
      reason,
      reviewedWeek: last.weekIndex,
      sourceWeeks,
      continueFrom:
        sourceWeeks.length === 1 && sourceWeeks[0] === firstMissed ? firstMissed + 1 : firstMissed,
      firstWeekScale: illness ? 0.5 : 1,
      suggestRebuild: n > 4,
    }
  }

  if (last.tooHard) {
    const repeatsOfSame = previous.filter(
      (a) => a.reason === 'too_hard' && a.sourceWeeks[0] === last.weekIndex,
    ).length
    if (repeatsOfSame >= 2 && last.weekIndex > 0) {
      return {
        kind: 'rollback',
        reason: 'too_hard',
        reviewedWeek: last.weekIndex,
        sourceWeeks: [last.weekIndex - 1],
        continueFrom: last.weekIndex,
        firstWeekScale: 1,
        suggestRebuild: false,
      }
    }
    return {
      kind: 'repeat_week',
      reason: 'too_hard',
      reviewedWeek: last.weekIndex,
      sourceWeeks: [last.weekIndex],
      continueFrom: last.weekIndex + 1,
      firstWeekScale: 1,
      suggestRebuild: false,
    }
  }
  return null
}

export interface RestructureResult {
  plan: PlanCore
  /** Полный новый список тренировок: сохранённые + новые. */
  workouts: WorkoutCore[]
  removedIds: string[]
  addedIds: string[]
}

/**
 * Перестраивает план с понедельника fromMonday: вставляет копии недель и сдвигает остаток.
 * Выполненные тренировки не трогаем; запланированные с даты fromMonday заменяем.
 * Новые тренировки на уже прошедшие дни текущей недели не создаём.
 */
export function restructurePlan(
  plan: PlanCore,
  workouts: WorkoutCore[],
  adj: Adjustment,
  fromMonday: IsoDate,
  today: IsoDate,
  idGen: () => string,
): RestructureResult | null {
  const currentIndex = plan.weeks.filter((w) => w.startDate < fromMonday).length
  if (currentIndex > plan.weeks.length) return null

  const prefixWeeks = plan.weeks.slice(0, currentIndex)
  const kept = workouts.filter((w) => w.date < fromMonday || w.status !== 'planned')
  const removedIds = workouts
    .filter((w) => !(w.date < fromMonday || w.status !== 'planned'))
    .map((w) => w.id)

  const sequence: Array<{ week: PlanWeekCore; scale: number }> = []
  adj.sourceWeeks.forEach((idx, i) => {
    const src = plan.weeks[idx]
    if (src) sequence.push({ week: src, scale: i === 0 ? adj.firstWeekScale : 1 })
  })
  for (const w of plan.weeks.slice(adj.continueFrom)) sequence.push({ week: w, scale: 1 })

  const newWeeks: PlanWeekCore[] = []
  const added: WorkoutCore[] = []
  sequence.forEach(({ week, scale }, i) => {
    const index = currentIndex + i
    const startDate = addDaysIso(fromMonday, 7 * i)
    newWeeks.push({
      ...week,
      index,
      startDate,
      isRecovery: week.isRecovery || scale < 1,
      volume: round1(week.volume * scale),
      longRun: round1(week.longRun * scale),
    })
    const source = workouts.filter((w) => w.weekIndex === week.index)
    for (const w of source) {
      const offset = clamp(
        differenceInCalendarDays(fromIsoDate(w.date), fromIsoDate(week.startDate)),
        0,
        6,
      )
      const date = addDaysIso(startDate, offset)
      if (date < today) continue
      const scaled = scale < 1 && w.type !== 'strength' ? scaleWorkout(w, scale) : w
      added.push({
        ...scaled,
        id: idGen(),
        date,
        weekIndex: index,
        status: 'planned',
      })
    }
  })

  const allWeeks = [...prefixWeeks, ...newWeeks]
  const all = [...kept, ...added].sort((a, b) => a.date.localeCompare(b.date))
  const endDate = all.reduce((m, w) => (w.date > m ? w.date : m), plan.startDate)
  return {
    plan: { ...plan, weeks: allWeeks, phases: rebuildPhases(allWeeks), endDate },
    workouts: all,
    removedIds,
    addedIds: added.map((w) => w.id),
  }
}

/** Уменьшенная копия тренировки после болезни: только лёгкий бег, основная часть × scale. */
function scaleWorkout(w: WorkoutCore, scale: number): WorkoutCore {
  const type = w.type === 'walk' || w.type === 'run_walk' ? w.type : 'easy'
  let segments: Segment[]
  if (type === 'run_walk' || type === 'walk') {
    segments = w.segments.map((s) =>
      s.kind === 'run' || s.kind === 'walk'
        ? { ...s, seconds: Math.max(30, Math.round(s.seconds * scale)) }
        : s,
    )
  } else {
    segments = buildSegments('easy', Math.round(w.estimatedSeconds * scale))
  }
  return {
    ...w,
    type,
    segments,
    estimatedSeconds: totalSeconds(segments),
    targetDistanceM: w.targetDistanceM ? Math.round(w.targetDistanceM * scale) : null,
  }
}

function rebuildPhases(weeks: PlanWeekCore[]): PlanPhaseRange[] {
  const ranges: PlanPhaseRange[] = []
  for (const w of weeks) {
    const last = ranges[ranges.length - 1]
    if (last && last.phase === w.phase) last.toWeek = w.index
    else ranges.push({ phase: w.phase, fromWeek: w.index, toWeek: w.index })
  }
  return ranges
}

function range(from: number, to: number): number[] {
  const out: number[] = []
  for (let i = from; i <= to; i++) out.push(i)
  return out
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function round1(v: number) {
  return Math.round(v * 10) / 10
}

import { addDays } from 'date-fns'
import { addDaysIso, nextMonday, toIsoDate, type IsoDate } from '@/domain/dates/dates'
import {
  BASE_START_WEEK_FOR_RUN_WALK,
  BASE_WEEKS,
  PHASE_SPECS,
  STRENGTH_SECONDS,
  walkPhaseWeeks,
  type PhaseSpec,
} from './phases'
import { buildWeekSchedule } from './schedule'
import {
  baseTemplate,
  buildBaseSegments,
  buildSegments,
  strengthSegments,
  totalSeconds,
} from './segments'
import type {
  GeneratedPlan,
  Phase,
  PlanCore,
  PlanInput,
  PlanOptions,
  PlanPhaseRange,
  PlanWarning,
  PlanWeekCore,
  Segment,
  WorkoutCore,
  WorkoutType,
} from './types'
import { PHASES } from './types'
import { buildVolumeWeeks } from './volumes'
import { stretchPlanToDate } from './stretch'

/** Флаги здоровья, при которых план строится максимально осторожно. */
const CONSERVATIVE_FLAGS = ['joints', 'cardio', 'overweight', 'pregnancy', 'diabetes']

/** Предполагаемый лёгкий темп по уровню (сек/км). Уточняется по факту на A2. */
const PACE_BY_LEVEL: Record<PlanInput['activityLevel'], number> = {
  never_ran: 480,
  walk_30: 480,
  run_walk: 450,
  run_5k: 405,
  run_10k: 375,
}

const GOAL_END: Record<PlanInput['goal'], Phase> = {
  start_running: 'k5',
  half_marathon: 'half',
  marathon: 'marathon',
}

const LEVEL_START: Record<PlanInput['activityLevel'], Phase> = {
  never_ran: 'base',
  walk_30: 'base',
  run_walk: 'base',
  run_5k: 'k10',
  run_10k: 'half',
}

/**
 * Стартовая фаза по самой длинной пробежке. Цифры точнее, чем выбор из списка:
 * человек, который бежит 8 км, начинает с фазы «10 км», а не с «5 км».
 */
export function phaseByLongestRun(km: number): Phase {
  if (km < 2) return 'base'
  if (km < 5) return 'k5'
  if (km < 10) return 'k10'
  if (km < 18) return 'half'
  return 'marathon'
}

/**
 * Нынешний недельный объём: длинная пробежка плюс остальные дни (обычно короче).
 * Нужен, чтобы не удваивать нагрузку в первую же неделю тому, кто бегает редко.
 */
export function estimateWeeklyKm(longestRunKm: number, runsPerWeek: number): number {
  return longestRunKm + Math.max(0, runsPerWeek - 1) * longestRunKm * 0.7
}

/**
 * Главная функция: профиль → план по неделям и список тренировок.
 * Чистая и детерминированная (дата и id приходят снаружи), поэтому легко тестируется.
 */
export function generatePlan(input: PlanInput, options: PlanOptions): GeneratedPlan {
  const planId = options.idGen()
  const conservative = isConservative(input)
  const pace = PACE_BY_LEVEL[input.activityLevel]
  const availableDays = normalizeDays(input.availableDays)
  const startDate = toIsoDate(nextMonday(options.now))

  const phases = phaseList(input, conservative)
  const weeks: PlanWeekCore[] = []
  const workouts: WorkoutCore[] = []
  const ranges: PlanPhaseRange[] = []
  const warnings: PlanWarning[] = []
  if (conservative) warnings.push('conservative')

  // «Ручка» перевода между неделями: последний объём и длительная в текущих единицах.
  let carryVolume = 0
  let carryLong = 0
  let carryUnit: 'min' | 'km' = 'min'

  const ctx = { planId, availableDays, pace, conservative, idGen: options.idGen, startDate }

  for (const phase of phases) {
    const fromWeek = weeks.length
    if (phase === 'walk') {
      const result = buildWalkPhase(ctx, weeks.length, input.walkMinutes)
      weeks.push(...result.weeks)
      workouts.push(...result.workouts)
      carryVolume = result.lastVolume
      carryLong = result.lastVolume / 3
    } else if (phase === 'base') {
      const result = buildBasePhase(ctx, weeks.length, input.activityLevel)
      weeks.push(...result.weeks)
      workouts.push(...result.workouts)
      carryVolume = result.lastVolume
      carryLong = result.lastVolume / 3
      carryUnit = 'min'
    } else {
      const spec = PHASE_SPECS[phase]
      if (carryUnit === 'min' && spec.unit === 'km') {
        carryVolume = (carryVolume * 60) / pace
        carryLong = (carryLong * 60) / pace
      }
      const start = startVolumeFor(phase, carryVolume, spec, phase === phases[0] ? input : null)
      const result = buildVolumePhase(
        ctx,
        weeks.length,
        spec,
        start.volume,
        Math.max(carryLong, start.long),
      )
      weeks.push(...result.weeks)
      workouts.push(...result.workouts)
      carryVolume = result.lastVolume
      carryLong = result.lastLong
      carryUnit = spec.unit
    }
    ranges.push({ phase, fromWeek, toWeek: weeks.length - 1 })
  }

  const lastWorkout = workouts.reduce((a, b) => (a.date > b.date ? a : b))
  const endDate = lastWorkout.date
  if (input.targetDate) {
    if (input.targetDate < endDate) warnings.push('target_date_too_early')
    else if (addDaysIso(endDate, 14) < input.targetDate) warnings.push('target_date_later')
  }

  const plan: PlanCore = {
    id: planId,
    startDate,
    endDate,
    goal: input.goal,
    weeks,
    phases: ranges,
    assumedPaceSecPerKm: pace,
    warnings,
    targetDate: input.targetDate,
  }
  const generated = { plan, workouts: workouts.sort((a, b) => a.date.localeCompare(b.date)) }
  // Желаемая дата позже — добавляем недели закрепления перед тейпером (объём не растёт).
  if (input.targetDate && warnings.includes('target_date_later'))
    return stretchPlanToDate(generated, input.targetDate, options.idGen)
  return generated
}

export function isConservative(input: PlanInput): boolean {
  const age = input.birthYear ? new Date().getFullYear() - input.birthYear : null
  return (
    input.healthFlags.some((f) => CONSERVATIVE_FLAGS.includes(f)) || (age !== null && age >= 55)
  )
}

/** Список фаз от стартового уровня до цели. */
export function phaseList(input: PlanInput, conservative: boolean): Phase[] {
  const startPhase =
    input.longestRunKm && input.longestRunKm >= 2
      ? phaseByLongestRun(input.longestRunKm)
      : LEVEL_START[input.activityLevel]
  const endPhase = GOAL_END[input.goal]
  const startIdx = PHASES.indexOf(startPhase)
  const endIdx = Math.max(PHASES.indexOf(endPhase), startIdx)
  const list = PHASES.slice(startIdx, endIdx + 1) as Phase[]

  // Фаза прогулок нужна тем, кто не может идти 30 минут, и всем «осторожным» с нуля.
  const needsWalk =
    (input.activityLevel === 'never_ran' || input.activityLevel === 'walk_30') &&
    ((input.walkMinutes !== null && input.walkMinutes < 30) ||
      (conservative && input.activityLevel === 'never_ran'))
  return needsWalk ? ['walk', ...list] : list
}

function normalizeDays(days: number[]): number[] {
  const unique = [...new Set(days.filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b)
  // Меньше трёх дней — план не построить безопасно; дополняем пн/ср/сб.
  if (unique.length >= 3) return unique
  const fallback = [0, 2, 5]
  for (const d of fallback) if (!unique.includes(d) && unique.length < 3) unique.push(d)
  return unique.sort((a, b) => a - b)
}

interface Ctx {
  planId: string
  availableDays: number[]
  pace: number
  conservative: boolean
  idGen: () => string
  startDate: IsoDate
}

interface PhaseResult {
  weeks: PlanWeekCore[]
  workouts: WorkoutCore[]
  lastVolume: number
  lastLong: number
}

function weekStart(ctx: Ctx, weekIndex: number): IsoDate {
  return addDaysIso(ctx.startDate, weekIndex * 7)
}

function dateFor(ctx: Ctx, weekIndex: number, weekday: number): IsoDate {
  return toIsoDate(addDays(new Date(weekStart(ctx, weekIndex)), weekday))
}

function makeWorkout(
  ctx: Ctx,
  weekIndex: number,
  weekday: number,
  phase: Phase,
  type: WorkoutType,
  segments: Segment[],
  targetDistanceM: number | null = null,
): WorkoutCore {
  return {
    id: ctx.idGen(),
    planId: ctx.planId,
    date: dateFor(ctx, weekIndex, weekday),
    weekIndex,
    phase,
    type,
    segments,
    estimatedSeconds: totalSeconds(segments),
    targetDistanceM,
    status: 'planned',
  }
}

function addStrength(
  ctx: Ctx,
  weekIndex: number,
  phase: Phase,
  days: number[],
  out: WorkoutCore[],
) {
  for (const d of days)
    out.push(makeWorkout(ctx, weekIndex, d, phase, 'strength', strengthSegments()))
}

/** Фаза 0: прогулки, 3 раза в неделю, объём в минутах. */
function buildWalkPhase(ctx: Ctx, from: number, walkMinutes: number | null): PhaseResult {
  const minutes = walkPhaseWeeks(walkMinutes)
  const weeks: PlanWeekCore[] = []
  const workouts: WorkoutCore[] = []
  const schedule = buildWeekSchedule(ctx.availableDays, 3, false, 1)
  minutes.forEach((m, i) => {
    const weekIndex = from + i
    weeks.push({
      index: weekIndex,
      phase: 'walk',
      startDate: weekStart(ctx, weekIndex),
      isRecovery: false,
      isTaper: false,
      isRace: false,
      unit: 'min',
      volume: m * 3,
      longRun: m,
    })
    for (const d of [...schedule.easyDays, schedule.longDay]) {
      workouts.push(makeWorkout(ctx, weekIndex, d, 'walk', 'walk', buildSegments('walk', m * 60)))
    }
    addStrength(ctx, weekIndex, 'walk', schedule.strengthDays, workouts)
  })
  const last = minutes[minutes.length - 1] ?? 30
  return { weeks, workouts, lastVolume: last * 3, lastLong: last }
}

/** Фаза 1: интервалы ходьба/бег по таблице; «осторожным» недели 1–7 удваиваются. */
function buildBasePhase(ctx: Ctx, from: number, level: PlanInput['activityLevel']): PhaseResult {
  const startWeek = level === 'run_walk' ? BASE_START_WEEK_FOR_RUN_WALK : 0
  const templateIndexes: number[] = []
  for (let i = startWeek; i < BASE_WEEKS.length; i++) {
    templateIndexes.push(i)
    if (ctx.conservative && i < 7) templateIndexes.push(i)
  }
  const weeks: PlanWeekCore[] = []
  const workouts: WorkoutCore[] = []
  const schedule = buildWeekSchedule(ctx.availableDays, 3, false, 2)
  let lastVolume = 0
  templateIndexes.forEach((tIdx, i) => {
    const weekIndex = from + i
    const segments = buildBaseSegments(baseTemplate(tIdx))
    const runMinutes =
      segments.filter((s) => s.kind === 'run').reduce((a, s) => a + s.seconds, 0) / 60
    // Объём базовой фазы — минуты бега за неделю (ходьба между отрезками не считается).
    lastVolume = runMinutes * 3
    weeks.push({
      index: weekIndex,
      phase: 'base',
      startDate: weekStart(ctx, weekIndex),
      isRecovery: false,
      isTaper: false,
      isRace: false,
      unit: 'min',
      volume: lastVolume,
      longRun: runMinutes,
    })
    for (const d of [...schedule.easyDays, schedule.longDay]) {
      workouts.push(makeWorkout(ctx, weekIndex, d, 'base', 'run_walk', segments))
    }
    addStrength(ctx, weekIndex, 'base', schedule.strengthDays, workouts)
  })
  return { weeks, workouts, lastVolume, lastLong: lastVolume / 3 }
}

/** Стартовый объём фазы: продолжение предыдущей или разумный минимум для тех, кто начинает с неё. */
function startVolumeFor(
  phase: Phase,
  carry: number,
  spec: PhaseSpec,
  actual: { longestRunKm: number | null; runsPerWeek: number | null } | null,
): { volume: number; long: number } {
  const minimums: Partial<Record<Phase, { volume: number; long: number }>> = {
    k5: { volume: 90, long: 30 },
    k10: { volume: 15, long: 5 },
    half: { volume: 25, long: 9 },
    marathon: { volume: 40, long: 16 },
  }
  const min = minimums[phase] ?? { volume: 0, long: 0 }

  // Человек уже бегает: берём его реальные цифры, а не средний минимум фазы.
  // Тому, кто бегает 8 км раз в неделю, не ставим сразу 15 км: длинную оставляем
  // примерно как есть и добавляем лёгкие дни.
  if (actual?.longestRunKm && spec.unit === 'km' && carry === 0) {
    const runs = Math.max(1, actual.runsPerWeek ?? 3)
    const long = Math.min(actual.longestRunKm, spec.longCap)
    const volume = Math.min(
      Math.max(estimateWeeklyKm(actual.longestRunKm, runs), long / 0.6),
      spec.peakVolume,
    )
    return { volume, long: Math.min(long, volume * 0.6) }
  }

  const volume = Math.min(Math.max(carry, min.volume), spec.peakVolume)
  return { volume, long: Math.min(min.long, spec.longCap) }
}

/** Фазы 5 км и дальше: объём считаем движком, раскладываем по дням. */
function buildVolumePhase(
  ctx: Ctx,
  from: number,
  spec: PhaseSpec,
  startVolume: number,
  startLong: number,
): PhaseResult {
  const recoveryEvery =
    ctx.conservative && (spec.phase === 'half' || spec.phase === 'marathon')
      ? 3
      : spec.recoveryEvery
  const growth = ctx.conservative ? 0.08 : spec.growth
  const runDays = Math.min(spec.runDays, ctx.availableDays.length)
  const volumeWeeks = buildVolumeWeeks(spec, startVolume, startLong, {
    growth,
    recoveryEvery,
    round: (v) => round(v, spec.unit),
  })

  const weeks: PlanWeekCore[] = []
  const workouts: WorkoutCore[] = []
  let lastVolume = startVolume
  let lastLong = startLong

  volumeWeeks.forEach((vw, i) => {
    const weekIndex = from + i
    const schedule = buildWeekSchedule(ctx.availableDays, runDays, vw.hasQuality, 2)
    const longRun = round(vw.longRun, spec.unit)
    const volume = round(vw.volume, spec.unit)
    const others = Math.max(0, volume - longRun)
    const otherDays = schedule.easyDays.length + (schedule.qualityDay !== null ? 1 : 0)
    // На гоночной неделе остальные пробежки — короткие «разминочные», не меньше 3 км / 20 мин.
    const minPerDay = vw.isRaceWeek ? (spec.unit === 'km' ? 3 : 20) : 0
    const perDay = otherDays > 0 ? Math.max(minPerDay, round(others / otherDays, spec.unit)) : 0

    weeks.push({
      index: weekIndex,
      phase: spec.phase,
      startDate: weekStart(ctx, weekIndex),
      isRecovery: vw.isRecovery,
      isTaper: vw.isTaper,
      isRace: vw.isRaceWeek,
      unit: spec.unit,
      volume,
      longRun,
    })

    const toSeconds = (v: number) =>
      spec.unit === 'km' ? Math.round(v * ctx.pace) : Math.round(v * 60)
    const toMeters = (v: number) => (spec.unit === 'km' ? Math.round(v * 1000) : null)

    for (const d of schedule.easyDays) {
      const sec = toSeconds(perDay) + 600 // + разминка/заминка
      workouts.push(
        makeWorkout(
          ctx,
          weekIndex,
          d,
          spec.phase,
          'easy',
          buildSegments('easy', sec),
          toMeters(perDay),
        ),
      )
    }
    if (schedule.qualityDay !== null) {
      const type: WorkoutType = spec.quality === 'tempo' ? 'tempo' : 'fartlek'
      const sec = toSeconds(perDay) + 1200
      workouts.push(
        makeWorkout(
          ctx,
          weekIndex,
          schedule.qualityDay,
          spec.phase,
          type,
          buildSegments(type, sec),
          toMeters(perDay),
        ),
      )
    }
    if (vw.isRaceWeek && spec.raceKm !== null) {
      const raceSec = Math.round(spec.raceKm * ctx.pace)
      workouts.push(
        makeWorkout(
          ctx,
          weekIndex,
          schedule.longDay,
          spec.phase,
          'race',
          buildSegments('race', raceSec + 600),
          Math.round(spec.raceKm * 1000),
        ),
      )
    } else {
      const sec = toSeconds(longRun) + 600
      workouts.push(
        makeWorkout(
          ctx,
          weekIndex,
          schedule.longDay,
          spec.phase,
          'long',
          buildSegments('long', sec),
          toMeters(longRun),
        ),
      )
    }
    // ОФП: на тейпере одна, иначе две; в гоночную неделю — нет.
    const strengthDays = vw.isRaceWeek
      ? []
      : vw.isTaper
        ? schedule.strengthDays.slice(0, 1)
        : schedule.strengthDays
    addStrength(ctx, weekIndex, spec.phase, strengthDays, workouts)

    if (!vw.isRecovery && !vw.isTaper) {
      lastVolume = volume
      lastLong = longRun
    }
  })

  return { weeks, workouts, lastVolume, lastLong }
}

/** Округление: минуты до 5, километры до 0,5. */
function round(value: number, unit: 'min' | 'km'): number {
  return unit === 'min' ? Math.round(value / 5) * 5 : Math.round(value * 2) / 2
}

export { STRENGTH_SECONDS }

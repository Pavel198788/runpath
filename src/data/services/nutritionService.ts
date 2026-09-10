import { differenceInCalendarDays } from 'date-fns'
import { db } from '../db'
import type { Plan, UserProfile } from '../entities'
import { getActivePlan } from '../repositories/planRepo'
import { workoutsOnDate } from '../repositories/workoutRepo'
import { addDaysIso, fromIsoDate } from '@/domain/dates/dates'
import {
  dayTargets,
  type DayContext,
  type DayTargets,
  type NutritionProfile,
} from '@/domain/nutrition/targets'

/** Собирает контекст дня из плана: какие тренировки, фаза, тейпер/пик/гонка. */
export async function dayContextFor(date: string, plan: Plan | null): Promise<DayContext> {
  if (!plan)
    return {
      phase: null,
      workouts: [],
      isTaper: false,
      isPeak: false,
      isRaceWeek: false,
      daysToRace: null,
      paceSecPerKm: 480,
    }
  const workouts = (await workoutsOnDate(plan.id, date)).filter((w) => w.status !== 'skipped')
  const week =
    plan.weeks.find((w) => date >= w.startDate && date < addDaysIso(w.startDate, 7)) ?? null
  // Пиковые — две последние рабочие недели перед тейпером фазы.
  let isPeak = false
  if (week && !week.isTaper) {
    const phaseWeeks = plan.weeks.filter((w) => w.phase === week.phase)
    const firstTaper = phaseWeeks.find((w) => w.isTaper)
    if (firstTaper) isPeak = week.index >= firstTaper.index - 2 && week.index < firstTaper.index
  }
  const race = await db.workouts
    .where('planId')
    .equals(plan.id)
    .filter((w) => w.deletedAt === null && w.type === 'race' && w.date >= date)
    .first()
  const daysToRace = race
    ? differenceInCalendarDays(fromIsoDate(race.date), fromIsoDate(date))
    : null
  return {
    phase: week?.phase ?? null,
    workouts: workouts.map((w) => ({
      type: w.type,
      estimatedSeconds: w.estimatedSeconds,
      targetDistanceM: w.targetDistanceM,
    })),
    isTaper: week?.isTaper ?? false,
    isPeak,
    isRaceWeek: week?.isRace ?? false,
    daysToRace,
    paceSecPerKm: plan.assumedPaceSecPerKm,
  }
}

export function nutritionProfileOf(profile: UserProfile): NutritionProfile | null {
  if (!profile.weightKg) return null
  return {
    sex: profile.sex,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.birthYear ? new Date().getFullYear() - profile.birthYear : null,
    weightGoal: profile.weightGoal ?? 'none',
  }
}

export async function targetsFor(
  date: string,
  profile: UserProfile,
): Promise<{ targets: DayTargets; ctx: DayContext } | null> {
  const np = nutritionProfileOf(profile)
  if (!np) return null
  const plan = (await getActivePlan()) ?? null
  const ctx = await dayContextFor(date, plan)
  return { targets: dayTargets(np, ctx), ctx }
}

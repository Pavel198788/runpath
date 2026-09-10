import { db } from '../db'
import type { Plan, PlanAdjustment, Workout } from '../entities'
import {
  addProposal,
  appliedAdjustments,
  proposedAdjustment,
  setAdjustmentStatus,
} from '../repositories/adjustmentRepo'
import { sickDatesBetween } from '../repositories/wellnessRepo'
import { touch, withMeta } from '../repositories/helpers'
import { decideAdjustment, restructurePlan, reviewWeek, type WeekReview } from '@/domain/plan/adapt'
import { addDaysIso, mondayOf, toIsoDate } from '@/domain/dates/dates'
import { uuid } from '@/domain/ids/uuid'
import { estimateMaxHr, rpeFromAvgHr } from '@/domain/load/hrLoad'
import { getProfile } from '../repositories/profileRepo'

/**
 * Проверяет прошедшие недели активного плана и, если нужно, создаёт предложение
 * о корректировке. Вызывается при открытии «Сегодня». Возвращает текущее предложение.
 */
export async function evaluatePlan(
  plan: Plan,
  today = toIsoDate(new Date()),
): Promise<PlanAdjustment | null> {
  const existing = await proposedAdjustment(plan.id)
  if (existing) return existing

  const thisMonday = toIsoDate(mondayOf(new Date(today)))
  const elapsed = plan.weeks.filter((w) => addDaysIso(w.startDate, 7) <= thisMonday)
  const lastElapsed = elapsed[elapsed.length - 1]
  if (!lastElapsed || lastElapsed.index <= plan.lastEvaluatedWeekIndex) return null

  const workouts = await db.workouts
    .where('planId')
    .equals(plan.id)
    .filter((w) => w.deletedAt === null)
    .toArray()
  const logs = await db.workoutLogs
    .filter((l) => l.deletedAt === null && l.workoutId !== null)
    .toArray()
  // Усилие: ощущения, а если их нет — оценка по среднему пульсу с часов.
  const profile = await getProfile()
  const maxHr =
    profile?.maxHr ??
    (profile?.birthYear ? estimateMaxHr(new Date().getFullYear() - profile.birthYear) : null)
  const rpeByWorkout = new Map<string, number | null>()
  for (const l of logs) {
    if (!l.workoutId) continue
    const byHr = l.avgHr && maxHr ? rpeFromAvgHr(l.avgHr, maxHr) : null
    rpeByWorkout.set(l.workoutId, l.rpe ?? byHr)
  }

  // Смотрим до 6 последних прошедших недель — этого хватает для правил «пропуск > 4».
  const window = elapsed.slice(-6)
  const first = window[0]!
  const sickDates = await sickDatesBetween(first.startDate, addDaysIso(lastElapsed.startDate, 6))
  const reviews: WeekReview[] = window.map((week) =>
    reviewWeek({ week, workouts, rpeByWorkout, sickDates }),
  )

  const previous = await appliedAdjustments(plan.id)
  const adj = decideAdjustment(reviews, previous)

  await db.plans.put(touch(plan, { lastEvaluatedWeekIndex: lastElapsed.index }))
  if (!adj) return null
  return addProposal(plan.id, adj)
}

/** Применяет предложение: перестраивает план с текущего понедельника. */
export async function applyAdjustment(
  adjustment: PlanAdjustment,
  today = toIsoDate(new Date()),
): Promise<void> {
  const plan = await db.plans.get(adjustment.planId)
  if (!plan) return
  const workouts = await db.workouts
    .where('planId')
    .equals(plan.id)
    .filter((w) => w.deletedAt === null)
    .toArray()
  const fromMonday = toIsoDate(mondayOf(new Date(today)))
  const result = restructurePlan(plan, workouts, adjustment, fromMonday, today, uuid)
  if (!result) {
    await setAdjustmentStatus(adjustment.id, 'dismissed')
    return
  }
  const now = new Date().toISOString()
  const added = new Set(result.addedIds)
  await db.transaction('rw', db.plans, db.workouts, db.planAdjustments, async () => {
    for (const id of result.removedIds) {
      const w = await db.workouts.get(id)
      if (w) await db.workouts.put(touch(w, { deletedAt: now }))
    }
    // Сохранённые тренировки могли сменить индекс недели — обновляем; новые — создаём.
    for (const w of result.workouts) {
      if (added.has(w.id)) {
        const { id, ...rest } = w
        await db.workouts.put(withMeta<Workout>({ ...rest, movedFrom: null }, id))
      } else {
        const existing = await db.workouts.get(w.id)
        if (existing && existing.weekIndex !== w.weekIndex)
          await db.workouts.put(touch(existing, { weekIndex: w.weekIndex }))
      }
    }
    await db.plans.put(
      touch(plan, {
        weeks: result.plan.weeks,
        phases: result.plan.phases,
        endDate: result.plan.endDate,
        lastEvaluatedWeekIndex:
          result.plan.weeks.filter((w) => w.startDate < fromMonday).length - 1,
      }),
    )
    await setAdjustmentStatus(adjustment.id, 'applied')
  })
}

export async function dismissAdjustment(adjustment: PlanAdjustment): Promise<void> {
  await setAdjustmentStatus(adjustment.id, 'dismissed')
}

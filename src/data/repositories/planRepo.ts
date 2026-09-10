import { db } from '../db'
import type { Plan, Workout } from '../entities'
import type { GeneratedPlan } from '@/domain/plan/types'
import { touch, withMeta } from './helpers'

export async function getActivePlan(): Promise<Plan | undefined> {
  return db.plans.filter((p) => p.isActive && p.deletedAt === null).first()
}

/** Сохраняет сгенерированный план и его тренировки одной транзакцией; старый план деактивируется. */
export async function saveGeneratedPlan(generated: GeneratedPlan): Promise<Plan> {
  const { id, ...core } = generated.plan
  const plan = withMeta<Plan>({ ...core, isActive: true, lastEvaluatedWeekIndex: -1 }, id)
  const workouts = generated.workouts.map(({ id: wid, ...w }) =>
    withMeta<Workout>({ ...w, movedFrom: null }, wid),
  )

  await db.transaction('rw', db.plans, db.workouts, async () => {
    const old = await db.plans.filter((p) => p.isActive).toArray()
    for (const p of old) await db.plans.put(touch(p, { isActive: false }))
    await db.plans.put(plan)
    await db.workouts.bulkPut(workouts)
  })
  return plan
}

/** Удаляет активный план вместе с тренировками (журнал остаётся). */
export async function deleteActivePlan(): Promise<void> {
  const plan = await getActivePlan()
  if (!plan) return
  await db.transaction('rw', db.plans, db.workouts, async () => {
    await db.workouts.where('planId').equals(plan.id).delete()
    await db.plans.delete(plan.id)
  })
}

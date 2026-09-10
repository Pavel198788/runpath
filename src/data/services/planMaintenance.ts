import { db } from '../db'
import { touch } from '../repositories/helpers'
import { todayIso } from '@/domain/dates/dates'

/**
 * Прошедшие невыполненные тренировки помечаем пропущенными, чтобы они не висели «запланированными».
 * Навёрстывать их не нужно — план продолжается; адаптация смотрит на выполненные.
 */
export async function closePastWorkouts(planId: string, today = todayIso()): Promise<number> {
  const stale = await db.workouts
    .where('planId')
    .equals(planId)
    .filter((w) => w.deletedAt === null && w.status === 'planned' && w.date < today)
    .toArray()
  for (const w of stale) await db.workouts.put(touch(w, { status: 'skipped' }))
  return stale.length
}

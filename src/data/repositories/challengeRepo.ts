import { db } from '../db'
import type { Challenge } from '../entities'
import { addDaysIso, todayIso } from '@/domain/dates/dates'
import { touch, withMeta } from './helpers'

export async function activeChallenge(): Promise<Challenge | undefined> {
  return db.challenges
    .where('status')
    .equals('active')
    .filter((c) => c.deletedAt === null)
    .first()
}

export async function startChallenge(
  templateId: string,
  name: string,
  targetKm: number,
  days: number,
): Promise<Challenge> {
  const start = todayIso()
  const c = withMeta<Challenge>({
    templateId,
    name,
    targetKm,
    startDate: start,
    endDate: addDaysIso(start, days),
    status: 'active',
  })
  await db.challenges.put(c)
  return c
}

export async function setChallengeStatus(id: string, status: Challenge['status']): Promise<void> {
  const c = await db.challenges.get(id)
  if (c) await db.challenges.put(touch(c, { status }))
}

export async function challengeProgressM(c: Challenge): Promise<number> {
  const logs = await db.workoutLogs
    .where('date')
    .between(c.startDate, c.endDate, true, true)
    .filter((l) => l.deletedAt === null)
    .toArray()
  return logs.reduce((a, l) => a + (l.distanceM ?? 0), 0)
}

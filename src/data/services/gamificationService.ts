import { db } from '../db'
import type { Achievement } from '../entities'
import { touch, withMeta } from '../repositories/helpers'
import { allWorkoutLogs } from '../repositories/workoutLogRepo'
import {
  evaluateAchievements,
  levelOf,
  type Level,
  type Unlocked,
} from '@/domain/gamification/achievements'
import { weeklyStreak, type StreakResult } from '@/domain/gamification/streaks'
import { todayIso } from '@/domain/dates/dates'

export interface GamificationState {
  unlocked: Unlocked[]
  fresh: Achievement[]
  level: Level
  streak: StreakResult
  totalM: number
}

/** Пересчитывает достижения по журналу и синхронизирует таблицу (новые помечаются как непросмотренные). */
export async function refreshGamification(): Promise<GamificationState> {
  const logs = await allWorkoutLogs()
  const streak = weeklyStreak(
    logs.map((l) => l.date),
    todayIso(),
  )
  const unlocked = evaluateAchievements(logs, streak.weeks)
  const stored = await db.achievements.filter((a) => a.deletedAt === null).toArray()
  const storedByKey = new Map(stored.map((a) => [a.key, a]))
  const fresh: Achievement[] = []
  await db.transaction('rw', db.achievements, async () => {
    for (const u of unlocked) {
      const existing = storedByKey.get(u.id)
      if (!existing) {
        const row = withMeta<Achievement>({ key: u.id, unlockedOn: u.date, seenAt: null })
        await db.achievements.put(row)
        fresh.push(row)
      } else if (existing.seenAt === null) fresh.push(existing)
    }
    // Достижение могло «исчезнуть» после удаления записи — убираем мягко.
    for (const a of stored)
      if (!unlocked.some((u) => u.id === a.key))
        await db.achievements.put(touch(a, { deletedAt: new Date().toISOString() }))
  })
  return {
    unlocked,
    fresh,
    level: levelOf(unlocked),
    streak,
    totalM: logs.reduce((s, l) => s + (l.distanceM ?? 0), 0),
  }
}

export async function markAchievementsSeen(ids: string[]): Promise<void> {
  const now = new Date().toISOString()
  for (const id of ids) {
    const a = await db.achievements.get(id)
    if (a) await db.achievements.put(touch(a, { seenAt: now }))
  }
}

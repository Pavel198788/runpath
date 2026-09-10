import { db } from '../db'
import type { WellnessEntry } from '../entities'
import { touch, withMeta } from './helpers'

export async function getWellness(date: string): Promise<WellnessEntry | undefined> {
  return db.wellness
    .where('date')
    .equals(date)
    .filter((w) => w.deletedAt === null)
    .first()
}

/** Одна запись на день: создаём или дополняем. */
export async function upsertWellness(
  date: string,
  patch: Partial<Omit<WellnessEntry, 'id' | 'date'>>,
): Promise<WellnessEntry> {
  const existing = await getWellness(date)
  const next: WellnessEntry = existing
    ? touch(existing, patch as Partial<WellnessEntry>)
    : withMeta<WellnessEntry>({
        date,
        sick: false,
        sleepHours: null,
        restingHr: null,
        stress: null,
        note: '',
        ...patch,
      })
  await db.wellness.put(next)
  return next
}

export async function sickDatesBetween(from: string, to: string): Promise<Set<string>> {
  const rows = await db.wellness
    .where('date')
    .between(from, to, true, true)
    .filter((w) => w.deletedAt === null && w.sick)
    .toArray()
  return new Set(rows.map((r) => r.date))
}

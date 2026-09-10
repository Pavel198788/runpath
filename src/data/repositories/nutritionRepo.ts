import { db } from '../db'
import type { LightMark, NutritionDay, NutritionEntry } from '../entities'
import { uuid } from '@/domain/ids/uuid'
import { touch, withMeta } from './helpers'

export async function getNutritionDay(date: string): Promise<NutritionDay | undefined> {
  return db.nutritionDays
    .where('date')
    .equals(date)
    .filter((d) => d.deletedAt === null)
    .first()
}

async function ensureDay(date: string): Promise<NutritionDay> {
  const existing = await getNutritionDay(date)
  if (existing) return existing
  const day = withMeta<NutritionDay>({ date, light: null, entries: [], note: '' })
  await db.nutritionDays.put(day)
  return day
}

export async function setLightMark(date: string, light: LightMark | null): Promise<void> {
  const day = await ensureDay(date)
  await db.nutritionDays.put(touch(day, { light }))
}

export async function addNutritionEntry(
  date: string,
  entry: Omit<NutritionEntry, 'id' | 'at'>,
): Promise<void> {
  const day = await ensureDay(date)
  const full: NutritionEntry = { ...entry, id: uuid(), at: new Date().toISOString() }
  await db.nutritionDays.put(touch(day, { entries: [...day.entries, full] }))
}

export async function removeNutritionEntry(date: string, entryId: string): Promise<void> {
  const day = await getNutritionDay(date)
  if (!day) return
  await db.nutritionDays.put(touch(day, { entries: day.entries.filter((e) => e.id !== entryId) }))
}

export async function nutritionDaysBetween(from: string, to: string): Promise<NutritionDay[]> {
  return db.nutritionDays
    .where('date')
    .between(from, to, true, true)
    .filter((d) => d.deletedAt === null)
    .toArray()
}

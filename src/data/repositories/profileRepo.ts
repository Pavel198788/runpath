import { db } from '../db'
import type { UserProfile } from '../entities/profile'
import type { NewEntity } from '../entities/base'
import { touch, withMeta } from './helpers'

/** В приложении один профиль; берём первый неудалённый. */
export async function getProfile(): Promise<UserProfile | undefined> {
  return db.profiles.filter((p) => p.deletedAt === null).first()
}

export async function createProfile(data: NewEntity<UserProfile>): Promise<UserProfile> {
  const profile = withMeta<UserProfile>(data)
  await db.profiles.put(profile)
  return profile
}

export async function updateProfile(
  id: string,
  patch: Partial<UserProfile>,
): Promise<UserProfile | undefined> {
  const current = await db.profiles.get(id)
  if (!current) return undefined
  const next = touch(current, patch)
  await db.profiles.put(next)
  return next
}

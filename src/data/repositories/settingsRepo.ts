import { db } from '../db'
import { SETTINGS_ID, type Settings } from '../entities/settings'
import type { NewEntity } from '../entities/base'
import { touch, withMeta } from './helpers'

const defaults: NewEntity<Settings> = {
  units: 'metric',
  language: 'ru',
  voiceEnabled: true,
  vibrationEnabled: true,
  telemetryConsent: false,
}

/** Настройки всегда существуют: если записи нет — создаём с дефолтами. */
export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get(SETTINGS_ID)
  if (existing) return existing
  const created = withMeta<Settings>(defaults, SETTINGS_ID)
  await db.settings.put(created)
  return created
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings()
  const next = touch(current, patch)
  await db.settings.put(next)
  return next
}

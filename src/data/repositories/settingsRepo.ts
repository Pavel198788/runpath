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
  gpsEnabled: true,
  autoPause: true,
  remindersEnabled: false,
  reminderTime: '18:00',
}

/** Настройки всегда существуют: если записи нет — создаём с дефолтами. */
export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get(SETTINGS_ID)
  // Новые поля у старых записей заполняем дефолтами (на случай, если миграция их не тронула).
  if (existing) return { ...defaults, ...existing }
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

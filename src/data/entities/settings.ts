import type { BaseEntity } from './base'
import type { UnitSystem } from '@/domain/units/units'

/** Настройки — одна запись с фиксированным id 'settings'. */
export interface Settings extends BaseEntity {
  units: UnitSystem
  language: 'ru'
  voiceEnabled: boolean
  vibrationEnabled: boolean
  /** Явное согласие на отправку ошибок (этап B), по умолчанию выключено. */
  telemetryConsent: boolean
  /** GPS во время тренировки с таймером. */
  gpsEnabled: boolean
  autoPause: boolean
  /** Локальные напоминания (работают только при открытом приложении — см. docs). */
  remindersEnabled: boolean
  /** «HH:MM». */
  reminderTime: string
  /** ИИ-тренер со своим ключом (BYOK). Ключ хранится только на устройстве и не попадает в бэкап. */
  aiProvider: 'anthropic' | 'openai' | null
  aiApiKey: string | null
  /** Базовый URL для OpenAI-совместимых API (пусто = api.openai.com). */
  aiBaseUrl: string
  aiModel: string
}

export const SETTINGS_ID = 'settings'

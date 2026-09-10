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
}

export const SETTINGS_ID = 'settings'

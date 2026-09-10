/**
 * Провайдер импорта тренировок. Файловые импорты (GPX/TCX/FIT/CSV) — этап A2,
 * OAuth (Strava, Garmin) — этап B3. Интерфейс общий, чтобы UI показывал
 * источник тренировки одинаково.
 */
export type IntegrationSource =
  'manual' | 'timer' | 'gps' | 'file' | 'strava' | 'garmin' | 'apple_health'

export interface IntegrationProvider {
  readonly id: IntegrationSource
  readonly requiresServer: boolean
}

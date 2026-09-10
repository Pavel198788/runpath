/**
 * Интерфейс синхронизации. Без сервера работает NoopSync (ничего не делает),
 * с сервером — ServerSync с очередью изменений (outbox) и протоколом «изменения после версии N».
 * UI работает только через этот интерфейс и не знает, есть ли сервер.
 */
export type SyncStatus = 'disabled' | 'signed_out' | 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncState {
  status: SyncStatus
  /** Сколько изменений ждёт отправки. */
  pending: number
  lastSyncAt: string | null
  /** Понятная человеку ошибка, если что-то пошло не так. */
  error: string | null
  email: string | null
}

export interface SyncAdapter {
  readonly state: SyncState
  sync(): Promise<void>
  subscribe(listener: (state: SyncState) => void): () => void
}

/** Коллекции, которые синхронизируются. Должны совпадать со списком на сервере. */
export const SYNCED_COLLECTIONS = [
  'profiles',
  'settings',
  'plans',
  'workouts',
  'workoutLogs',
  'tracks',
  'wellness',
  'planAdjustments',
  'nutritionDays',
  'shoes',
  'achievements',
  'challenges',
] as const

export type SyncedCollection = (typeof SYNCED_COLLECTIONS)[number]

export interface OutboxItem {
  /** Ключ: коллекция + id сущности, чтобы повторные правки не копились. */
  key: string
  collection: SyncedCollection
  entityId: string
  updatedAt: string
  queuedAt: string
}

export interface SyncMeta {
  key: 'meta'
  /** Версия сервера, до которой мы всё скачали. */
  serverVersion: number
  lastSyncAt: string | null
  accessToken: string | null
  refreshToken: string | null
  email: string | null
  userId: string | null
}

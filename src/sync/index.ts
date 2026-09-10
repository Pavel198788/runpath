import { features } from '@/config/features'
import { Api } from './api'
import { NoopSync } from './noopSync'
import { ServerSync } from './serverSync'
import { installOutboxHooks } from './outbox'
import type { SyncAdapter } from './types'

/** Адрес API задаётся при сборке; пустой — сервера нет, работает NoopSync. */
const API_URL = import.meta.env.VITE_API_URL ?? ''

function create(): SyncAdapter {
  if (!features.server || !API_URL) return new NoopSync()
  installOutboxHooks()
  return new ServerSync(new Api(API_URL.replace(/\/$/, '')))
}

export const sync = create()
export const isServerSync = (s: SyncAdapter): s is ServerSync => s instanceof ServerSync
export { Api, ApiError } from './api'
export { ServerSync } from './serverSync'
export type { SyncAdapter, SyncState, SyncStatus } from './types'

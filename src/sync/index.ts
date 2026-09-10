import { features } from '@/config/features'
import { NoopSync } from './noopSync'
import type { SyncAdapter } from './types'

/** Точка подключения серверной синхронизации как плагина. */
export function createSyncAdapter(): SyncAdapter {
  // На этапе B: if (features.server) return new ServerSync(...)
  void features
  return new NoopSync()
}

export const sync = createSyncAdapter()
export type { SyncAdapter, SyncStatus } from './types'

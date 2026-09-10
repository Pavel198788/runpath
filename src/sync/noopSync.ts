import type { SyncAdapter, SyncState } from './types'

/** Заглушка без сервера: приложение полностью автономно, синхронизации нет. */
export class NoopSync implements SyncAdapter {
  readonly state: SyncState = {
    status: 'disabled',
    pending: 0,
    lastSyncAt: null,
    error: null,
    email: null,
  }
  async sync() {}
  subscribe(listener: (state: SyncState) => void) {
    listener(this.state)
    return () => {}
  }
}

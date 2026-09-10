import type { SyncAdapter, SyncStatus } from './types'

/** Заглушка без сервера: статус всегда «отключено». */
export class NoopSync implements SyncAdapter {
  readonly status: SyncStatus = 'disabled'
  async sync() {}
  subscribe() {
    return () => {}
  }
}

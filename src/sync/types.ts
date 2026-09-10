/**
 * Интерфейс синхронизации. На этапе A реализация — NoopSync (ничего не делает).
 * На этапе B появится ServerSync с outbox-очередью и протоколом «изменения после версии N».
 * UI работает только через этот интерфейс и не знает, есть ли сервер.
 */
export type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncAdapter {
  readonly status: SyncStatus
  /** Запустить синхронизацию вручную. Не должен бросать исключения наружу. */
  sync(): Promise<void>
  subscribe(listener: (status: SyncStatus) => void): () => void
}

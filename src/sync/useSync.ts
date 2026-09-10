import { useEffect, useState } from 'react'
import { sync } from './index'
import type { SyncState } from './types'

/** Состояние синхронизации для UI. */
export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>(sync.state)
  useEffect(() => sync.subscribe(setState), [])
  return state
}

/** Автосинхронизация: при открытии приложения, при возврате в него и при появлении сети. */
export function useAutoSync(): void {
  useEffect(() => {
    if (sync.state.status === 'disabled') return
    const run = () => void sync.sync()
    run()
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', run)
    // Периодически, пока приложение открыто.
    const id = setInterval(run, 5 * 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', run)
      clearInterval(id)
    }
  }, [])
}

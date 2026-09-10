import { useEffect, useRef } from 'react'

/**
 * Не даём экрану погаснуть, пока идёт тренировка (Screen Wake Lock API).
 * Блокировка слетает при сворачивании — восстанавливаем при возврате.
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let cancelled = false

    const request = async () => {
      try {
        lockRef.current = await navigator.wakeLock.request('screen')
      } catch {
        /* например, низкий заряд — ОС отказала */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lockRef.current?.release()
      lockRef.current = null
    }
  }, [active])
}

/**
 * «Тихая» аудиодорожка: известный обходной путь, чтобы браузер не усыплял вкладку
 * и голос продолжал звучать в фоне (работает на Android; на iOS частично).
 * Требует жеста пользователя — вызывать из обработчика кнопки.
 */
export function createSilentAudio(): HTMLAudioElement | null {
  try {
    const audio = new Audio(SILENT_WAV)
    audio.loop = true
    audio.volume = 0.01
    return audio
  } catch {
    return null
  }
}

// 1 секунда тишины, 8 кГц, моно, 8 бит — ~8 КБ в base64 было бы много; используем короткий фрагмент 0,1 с.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQADAAA' +
  'A'.repeat(1024)

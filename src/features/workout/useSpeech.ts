import { useCallback, useEffect, useRef } from 'react'

/**
 * Голосовые подсказки через Web Speech API. Русский голос выбираем из доступных;
 * если его нет — браузер прочитает системным. На iOS речь работает только после
 * жеста пользователя (кнопка «Старт») и может замолкать при заблокированном экране.
 */
export function useSpeech(enabled: boolean) {
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)

  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const pick = () => {
      const voices = speechSynthesis.getVoices()
      voiceRef.current =
        voices.find((v) => v.lang.toLowerCase().startsWith('ru') && v.localService) ??
        voices.find((v) => v.lang.toLowerCase().startsWith('ru')) ??
        null
    }
    pick()
    speechSynthesis.addEventListener('voiceschanged', pick)
    return () => speechSynthesis.removeEventListener('voiceschanged', pick)
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!enabled || typeof speechSynthesis === 'undefined') return
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'ru-RU'
      u.rate = 1
      if (voiceRef.current) u.voice = voiceRef.current
      speechSynthesis.cancel()
      speechSynthesis.speak(u)
    },
    [enabled],
  )

  const cancel = useCallback(() => {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  }, [])

  return { speak, cancel, supported: typeof speechSynthesis !== 'undefined' }
}

/** Вибрация (Android/Chrome; iOS Safari не поддерживает — тихо игнорируем). */
export function vibrate(pattern: number | number[], enabled = true) {
  if (!enabled) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* не поддерживается */
  }
}

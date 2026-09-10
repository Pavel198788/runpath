import { lazy } from 'react'

/** Экран приложения — компонент без пропсов. */
type ScreenComponent = () => React.ReactNode
type ScreenModule = { default: ScreenComponent }

/**
 * Ленивая загрузка экрана, устойчивая к устаревшему кэшу.
 *
 * Частая беда установленных PWA: на устройстве осталась старая версия приложения, а файлы с кодом
 * экранов на сервере уже другие. Тогда переход по ссылке молча ничего не делает — экран пустой.
 * Здесь мы ловим такую ошибку, один раз чистим кэш и перезагружаем приложение целиком,
 * чтобы человек получил рабочую свежую версию. Данные тренировок лежат в отдельной базе и не страдают.
 */
export function lazyWithRetry(factory: () => Promise<ScreenModule>) {
  return lazy<ScreenComponent>(async (): Promise<ScreenModule> => {
    try {
      return await factory()
    } catch (error) {
      if (sessionStorage.getItem(RELOAD_FLAG) === '1') throw error
      sessionStorage.setItem(RELOAD_FLAG, '1')
      await refreshApp()
      // Перезагрузка уже началась; эту заглушку никто не увидит.
      return { default: () => null }
    }
  })
}

const RELOAD_FLAG = 'runpath-chunk-reload'

/** Снимает старый service worker, чистит кэши и перезагружает страницу. */
export async function refreshApp(): Promise<void> {
  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(registrations.map((r) => r.unregister()))
    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(names.map((n) => caches.delete(n)))
    }
  } catch {
    // Даже если почистить не вышло, перезагрузка часто помогает.
  }
  window.location.reload()
}

/** После успешного открытия сбрасываем отметку, чтобы следующая поломка снова лечилась. */
export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG)
  } catch {
    /* приватный режим браузера */
  }
}

import { useRegisterSW } from 'virtual:pwa-register/react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/ui'

/** Предложение обновиться, когда service worker скачал новую версию. */
export function UpdatePrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Проверяем обновления при запуске и раз в час, иначе на телефоне можно
    // месяцами сидеть на старой версии и ловить пустые экраны.
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (document.visibilityState === 'visible') void registration.update()
      }
      check()
      setInterval(check, 60 * 60 * 1000)
      document.addEventListener('visibilitychange', check)
    },
  })

  if (!needRefresh) return null
  return (
    <div
      role="dialog"
      aria-live="polite"
      className="bg-surface fixed inset-x-4 bottom-24 z-30 mx-auto max-w-lg rounded-card border border-border p-4 shadow-lg"
    >
      <p className="mb-3 font-medium">{t('pwa.updateAvailable')}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void updateServiceWorker(true)}>
          {t('pwa.reload')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
          {t('pwa.later')}
        </Button>
      </div>
    </div>
  )
}

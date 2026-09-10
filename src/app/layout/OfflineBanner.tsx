import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WifiOff } from 'lucide-react'

/** Тихая плашка «нет сети». Ничего не блокирует — офлайн у нас штатный режим. */
export function OfflineBanner() {
  const { t } = useTranslation()
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (online) return null
  return (
    <div
      role="status"
      className="bg-surface-2 text-muted flex items-center justify-center gap-2 px-4 py-2 text-sm"
    >
      <WifiOff aria-hidden className="size-4" />
      {t('common.offline')}
    </div>
  )
}

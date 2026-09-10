import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomNav } from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { UpdatePrompt } from './UpdatePrompt'
import { useLocalReminders } from '@/app/useLocalReminders'

export function AppShell() {
  const { t } = useTranslation()
  useLocalReminders()
  return (
    <div className="min-h-dvh">
      <OfflineBanner />
      <Suspense fallback={<p className="text-muted p-6 text-center">{t('common.loading')}</p>}>
        <Outlet />
      </Suspense>
      <UpdatePrompt />
      <BottomNav />
    </div>
  )
}

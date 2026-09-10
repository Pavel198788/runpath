import { Suspense, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomNav } from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { UpdatePrompt } from './UpdatePrompt'
import { useLocalReminders } from '@/app/useLocalReminders'
import { useAutoSync } from '@/sync/useSync'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import { clearChunkReloadFlag } from '@/app/lazyWithRetry'

export function AppShell() {
  const { t } = useTranslation()
  useLocalReminders()
  useAutoSync()
  // Приложение открылось нормально — значит кэш в порядке.
  useEffect(clearChunkReloadFlag, [])
  return (
    <div className="min-h-dvh">
      <OfflineBanner />
      <ErrorBoundary>
        <Suspense fallback={<p className="text-muted p-6 text-center">{t('common.loading')}</p>}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
      <UpdatePrompt />
      <BottomNav />
    </div>
  )
}

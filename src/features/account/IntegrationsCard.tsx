import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardText, CardTitle } from '@/ui'
import { Api } from '@/sync'
import { db } from '@/data/db'
import { sync } from '@/sync'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/** Strava через сервер: авторизация, отвязка, ручная синхронизация. Garmin — после одобрения заявки. */
export function IntegrationsCard() {
  const { t } = useTranslation()
  const [list, setList] = useState<Array<{ provider: string; last_sync_at: string | null }>>([])
  const [available, setAvailable] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const meta = await db.syncMeta.get('meta')
    if (!meta?.accessToken) return
    try {
      const res = await new Api(API_URL).integrations(meta.accessToken)
      setList(res.integrations)
      setAvailable(res.available)
    } catch (e) {
      setError(e instanceof Error ? e.message : null)
    }
  }, [])

  useEffect(() => {
    // Состояние приходит из сети, поэтому setState происходит уже после ответа сервера.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const act = async (fn: (api: Api, token: string) => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      const meta = await db.syncMeta.get('meta')
      if (!meta?.accessToken) return
      await fn(new Api(API_URL), meta.accessToken)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  const strava = list.find((i) => i.provider === 'strava')

  return (
    <Card className="space-y-3">
      <CardTitle>{t('account.integrations')}</CardTitle>
      <CardText className="text-sm">{t('account.integrationsHint')}</CardText>
      {available.strava === false && (
        <CardText className="text-muted text-sm">{t('account.stravaNotConfigured')}</CardText>
      )}
      {available.strava && !strava && (
        <Button
          fullWidth
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void act(async (api, token) => {
              const { url } = await api.stravaAuthorize(token)
              window.location.assign(url)
            })
          }
        >
          {t('account.connectStrava')}
        </Button>
      )}
      {strava && (
        <div className="space-y-2">
          <CardText className="text-sm">
            Strava ·{' '}
            {strava.last_sync_at
              ? t('account.lastSync', { date: strava.last_sync_at.slice(0, 10) })
              : t('account.neverSynced')}
          </CardText>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void act(async (api, token) => {
                  await api.syncIntegration(token, 'strava')
                  // Через минуту cron заберёт активности, а мы подтянем их обычной синхронизацией.
                  setTimeout(() => void sync.sync(), 60_000)
                })
              }
            >
              {t('account.syncStrava')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void act((api, token) => api.disconnectIntegration(token, 'strava'))}
            >
              {t('account.disconnect')}
            </Button>
          </div>
        </div>
      )}
      <CardText className="text-muted text-xs">{t('account.garminNote')}</CardText>
      {error && <CardText className="text-danger text-sm">{error}</CardText>}
    </Card>
  )
}

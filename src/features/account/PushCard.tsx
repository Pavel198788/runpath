import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, CardText, CardTitle, Field, Input, Toggle } from '@/ui'
import { Api } from '@/sync'
import { db } from '@/data/db'
import { getSettings, updateSettings } from '@/data/repositories/settingsRepo'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/**
 * Подписка на push. Честные ограничения:
 * на iOS работает только для приложения, установленного на домашний экран (iOS 16.4+).
 */
export function PushCard() {
  const { t } = useTranslation()
  const settings = useLiveQuery(getSettings)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supported =
    typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)

  // Узнаём текущее состояние подписки у браузера (асинхронно, поэтому через эффект).
  useEffect(() => {
    let alive = true
    const check = async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (alive) setSubscribed(Boolean(sub))
      } catch {
        if (alive) setSubscribed(false)
      }
    }
    void check()
    return () => {
      alive = false
    }
  }, [])

  const toggle = async (on: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const meta = await db.syncMeta.get('meta')
      const token = meta?.accessToken
      if (!token) throw new Error(t('account.needLogin'))
      const api = new Api(API_URL)
      const reg = await navigator.serviceWorker.ready
      if (!on) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await api.unsubscribePush(token, sub.endpoint)
          await sub.unsubscribe()
        }
        setSubscribed(false)
        return
      }
      if ((await Notification.requestPermission()) !== 'granted')
        throw new Error(t('reminders.permissionDenied'))
      const { publicKey } = await api.pushKey(token)
      if (!publicKey) throw new Error(t('account.pushNotConfigured'))
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      await api.subscribePush(token, {
        subscription: sub.toJSON(),
        reminderTime: settings?.reminderTime ?? '18:00',
        // Смещение в минутах: сколько прибавить к UTC, чтобы получить местное время.
        timezoneOffset: -new Date().getTimezoneOffset(),
        types: ['reminder', 'evening', 'weekly'],
      })
      setSubscribed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  if (!supported) {
    return (
      <Card>
        <CardTitle>{t('account.push')}</CardTitle>
        <CardText className="text-sm">{t('account.pushUnsupported')}</CardText>
      </Card>
    )
  }

  return (
    <Card className="space-y-3">
      <CardTitle>{t('account.push')}</CardTitle>
      {isIos && !standalone && (
        <CardText className="text-warning text-sm">{t('account.pushIos')}</CardText>
      )}
      <Toggle
        label={t('account.pushEnable')}
        description={t('account.pushHint')}
        checked={subscribed}
        onChange={(v) => void toggle(v)}
      />
      {busy && <CardText className="text-sm">{t('common.loading')}</CardText>}
      {error && <CardText className="text-danger text-sm">{error}</CardText>}
      {subscribed && (
        <Field label={t('reminders.time')}>
          <Input
            type="time"
            value={settings?.reminderTime ?? '18:00'}
            onChange={(e) => {
              void updateSettings({ reminderTime: e.target.value }).then(() => toggle(true))
            }}
          />
        </Field>
      )}
    </Card>
  )
}

/** Ключ VAPID приходит в base64url, а PushManager ждёт бинарный буфер. */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const buffer = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return buffer
}

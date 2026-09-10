import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CloudOff, RefreshCw } from 'lucide-react'
import { Badge, Button, Card, CardText, CardTitle, Field, Input, Page, PageHeader } from '@/ui'
import { isServerSync, sync } from '@/sync'
import { useSyncState } from '@/sync/useSync'
import { PushCard } from './PushCard'
import { IntegrationsCard } from './IntegrationsCard'
import { longDate } from '@/features/workout/workoutText'

/**
 * Аккаунт: вход/регистрация, состояние синхронизации, push, интеграции.
 * Гостевой режим остаётся: без входа приложение работает полностью.
 */
export default function AccountPage() {
  const { t } = useTranslation()
  const state = useSyncState()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (state.status === 'disabled') {
    return (
      <Page className="space-y-4">
        <BackLink />
        <PageHeader title={t('account.title')} />
        <Card>
          <CardText>{t('account.noServer')}</CardText>
        </Card>
      </Page>
    )
  }

  const submit = async () => {
    if (!isServerSync(sync)) return
    setBusy(true)
    setError(null)
    try {
      await sync.signIn(email.trim(), password, mode)
      setPassword('')
      setNotice(mode === 'register' ? t('account.registered') : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  const signedIn = state.status !== 'signed_out'

  return (
    <Page className="space-y-4">
      <BackLink />
      <PageHeader
        title={t('account.title')}
        action={
          signedIn ? (
            <Badge tone={statusTone(state.status)}>{t(`account.status.${state.status}`)}</Badge>
          ) : undefined
        }
      />

      {!signedIn && (
        <Card className="space-y-3">
          <CardTitle>{mode === 'login' ? t('account.login') : t('account.register')}</CardTitle>
          <CardText className="text-sm">{t('account.hint')}</CardText>
          <Field label={t('account.email')}>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field
            label={t('account.password')}
            hint={mode === 'register' ? t('account.passwordHint') : undefined}
          >
            <Input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <CardText className="text-danger text-sm">{error}</CardText>}
          <Button
            fullWidth
            size="lg"
            disabled={busy || !email.includes('@') || password.length < 8}
            onClick={() => void submit()}
          >
            {mode === 'login' ? t('account.login') : t('account.register')}
          </Button>
          <button
            type="button"
            className="text-accent min-h-11 text-sm font-medium"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? t('account.toRegister') : t('account.toLogin')}
          </button>
        </Card>
      )}

      {signedIn && (
        <>
          <Card className="space-y-2">
            <CardTitle>{state.email}</CardTitle>
            {notice && <CardText className="text-success text-sm">{notice}</CardText>}
            <CardText className="text-sm">
              {state.lastSyncAt
                ? t('account.lastSync', { date: longDate(state.lastSyncAt.slice(0, 10)) })
                : t('account.neverSynced')}
              {state.pending > 0 && ` · ${t('account.pending', { count: state.pending })}`}
            </CardText>
            {state.error && <CardText className="text-danger text-sm">{state.error}</CardText>}
            {state.status === 'offline' && (
              <CardText className="text-muted flex items-center gap-1 text-sm">
                <CloudOff className="size-4" aria-hidden /> {t('account.offlineHint')}
              </CardText>
            )}
            <Button
              variant="secondary"
              fullWidth
              disabled={state.status === 'syncing'}
              onClick={() => void sync.sync()}
            >
              <RefreshCw
                className={state.status === 'syncing' ? 'size-4 animate-spin' : 'size-4'}
                aria-hidden
              />{' '}
              {t('account.syncNow')}
            </Button>
          </Card>

          <PushCard />
          <IntegrationsCard />

          <Card className="space-y-2">
            <Button
              variant="outline"
              fullWidth
              onClick={() => void (isServerSync(sync) && sync.signOut())}
            >
              {t('account.logout')}
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={() => {
                if (window.confirm(t('account.deleteConfirm')))
                  void (isServerSync(sync) && sync.deleteAccount())
              }}
            >
              {t('account.deleteAccount')}
            </Button>
            <CardText className="text-xs">{t('account.deleteHint')}</CardText>
          </Card>
        </>
      )}
    </Page>
  )
}

function BackLink() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="text-muted flex items-center gap-1 text-sm"
    >
      <ArrowLeft className="size-4" aria-hidden /> {t('common.back')}
    </button>
  )
}

function statusTone(status: string) {
  return status === 'idle'
    ? 'success'
    : status === 'error'
      ? 'danger'
      : status === 'offline'
        ? 'warning'
        : 'neutral'
}

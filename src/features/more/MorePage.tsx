import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight } from 'lucide-react'
import {
  Button,
  Card,
  CardText,
  CardTitle,
  Field,
  Input,
  Page,
  PageHeader,
  Segmented,
  Toggle,
} from '@/ui'
import { requestNotificationPermission } from '@/app/useLocalReminders'
import { useUiStore, type ThemeMode } from '@/store/uiStore'
import { getSettings, updateSettings } from '@/data/repositories/settingsRepo'
import { deleteActivePlan, getActivePlan } from '@/data/repositories/planRepo'
import { wipeDatabase } from '@/data/db'
import { APP_VERSION } from '@/config/app'
import type { UnitSystem } from '@/domain/units/units'

export default function MorePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const settings = useLiveQuery(getSettings)
  const plan = useLiveQuery(async () => (await getActivePlan()) ?? null)

  const onWipe = async () => {
    if (window.confirm(t('more.deleteAllConfirm'))) {
      await wipeDatabase()
      window.location.assign('/')
    }
  }
  const onRebuild = async () => {
    if (window.confirm(t('more.rebuildPlanConfirm'))) {
      await deleteActivePlan()
      navigate('/onboarding')
    }
  }

  return (
    <Page className="space-y-4">
      <PageHeader title={t('more.title')} subtitle={t('app.version', { version: APP_VERSION })} />

      <Link
        to="/history"
        className="bg-surface flex items-center justify-between rounded-xl border border-border px-4 py-3 font-medium"
      >
        {t('more.history')}
        <ChevronRight className="text-muted size-5" aria-hidden />
      </Link>
      <Link
        to="/profile"
        className="bg-surface flex items-center justify-between rounded-xl border border-border px-4 py-3 font-medium"
      >
        {t('more.profile')}
        <ChevronRight className="text-muted size-5" aria-hidden />
      </Link>
      <Link
        to="/import"
        className="bg-surface flex items-center justify-between rounded-xl border border-border px-4 py-3 font-medium"
      >
        {t('more.import')}
        <ChevronRight className="text-muted size-5" aria-hidden />
      </Link>

      <Card className="space-y-3">
        <CardTitle>{t('more.settings')}</CardTitle>
        <div>
          <p className="text-muted mb-2 text-sm">{t('more.theme')}</p>
          <Segmented<ThemeMode>
            ariaLabel={t('more.theme')}
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'system', label: t('more.themeSystem') },
              { value: 'light', label: t('more.themeLight') },
              { value: 'dark', label: t('more.themeDark') },
            ]}
          />
        </div>
        <div>
          <p className="text-muted mb-2 text-sm">{t('more.units')}</p>
          <Segmented<UnitSystem>
            ariaLabel={t('more.units')}
            value={settings?.units ?? 'metric'}
            onChange={(units) => void updateSettings({ units })}
            options={[
              { value: 'metric', label: t('more.unitsMetric') },
              { value: 'imperial', label: t('more.unitsImperial') },
            ]}
          />
        </div>
        <Toggle
          label={t('more.voice')}
          checked={settings?.voiceEnabled ?? true}
          onChange={(voiceEnabled) => void updateSettings({ voiceEnabled })}
        />
        <Toggle
          label={t('more.vibration')}
          checked={settings?.vibrationEnabled ?? true}
          onChange={(vibrationEnabled) => void updateSettings({ vibrationEnabled })}
        />
      </Card>

      <Card className="space-y-2">
        <CardTitle>{t('more.gps')}</CardTitle>
        <Toggle
          label={t('gps.enable')}
          description={t('gps.enableHint')}
          checked={settings?.gpsEnabled ?? true}
          onChange={(gpsEnabled) => void updateSettings({ gpsEnabled })}
        />
        <Toggle
          label={t('gps.autoPause')}
          checked={settings?.autoPause ?? true}
          onChange={(autoPause) => void updateSettings({ autoPause })}
        />
      </Card>

      <Card className="space-y-3">
        <CardTitle>{t('reminders.title')}</CardTitle>
        <Toggle
          label={t('reminders.enable')}
          description={t('reminders.hint')}
          checked={settings?.remindersEnabled ?? false}
          onChange={(remindersEnabled) => {
            void (async () => {
              if (remindersEnabled && !(await requestNotificationPermission())) {
                window.alert(t('reminders.permissionDenied'))
                return
              }
              await updateSettings({ remindersEnabled })
            })()
          }}
        />
        {settings?.remindersEnabled && (
          <Field label={t('reminders.time')}>
            <Input
              type="time"
              value={settings.reminderTime}
              onChange={(e) => void updateSettings({ reminderTime: e.target.value })}
            />
          </Field>
        )}
      </Card>

      {plan && (
        <Card className="space-y-3">
          <CardTitle>{t('more.plan')}</CardTitle>
          <Button variant="outline" fullWidth onClick={() => void onRebuild()}>
            {t('more.rebuildPlan')}
          </Button>
        </Card>
      )}

      <Card className="space-y-2">
        <CardTitle>{t('disclaimer.title')}</CardTitle>
        <CardText>{t('disclaimer.body')}</CardText>
        <CardText className="text-danger">{t('disclaimer.redFlags')}</CardText>
      </Card>

      <Card className="space-y-3">
        <CardTitle>{t('more.data')}</CardTitle>
        <CardText>{t('more.dataHint')}</CardText>
        <Button variant="danger" fullWidth onClick={() => void onWipe()}>
          {t('more.deleteAll')}
        </Button>
      </Card>
    </Page>
  )
}

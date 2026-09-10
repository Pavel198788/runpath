import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card, CardText, CardTitle, Page, PageHeader, Segmented } from '@/ui'
import { useUiStore, type ThemeMode } from '@/store/uiStore'
import { getSettings, updateSettings } from '@/data/repositories/settingsRepo'
import { wipeDatabase } from '@/data/db'
import { APP_VERSION } from '@/config/app'
import type { UnitSystem } from '@/domain/units/units'

export default function MorePage() {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const settings = useLiveQuery(getSettings)

  const onWipe = async () => {
    if (window.confirm(t('more.deleteAllConfirm'))) {
      await wipeDatabase()
      window.location.assign('/')
    }
  }

  return (
    <Page className="space-y-4">
      <PageHeader title={t('more.title')} subtitle={t('app.version', { version: APP_VERSION })} />

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
      </Card>

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

import { useTranslation } from 'react-i18next'
import { Card, CardText, Page, PageHeader } from '@/ui'

export default function ProgressPage() {
  const { t } = useTranslation()
  return (
    <Page>
      <PageHeader title={t('progress.title')} />
      <Card>
        <CardText>{t('progress.placeholder')}</CardText>
      </Card>
    </Page>
  )
}

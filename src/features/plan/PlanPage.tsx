import { useTranslation } from 'react-i18next'
import { Card, CardText, Page, PageHeader } from '@/ui'

export default function PlanPage() {
  const { t } = useTranslation()
  return (
    <Page>
      <PageHeader title={t('plan.title')} />
      <Card>
        <CardText>{t('plan.placeholder')}</CardText>
      </Card>
    </Page>
  )
}

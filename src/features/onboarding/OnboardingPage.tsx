import { useTranslation } from 'react-i18next'
import { Card, CardText, Page, PageHeader } from '@/ui'

export default function OnboardingPage() {
  const { t } = useTranslation()
  return (
    <Page>
      <PageHeader title={t('onboarding.title')} />
      <Card>
        <CardText>{t('onboarding.placeholder')}</CardText>
      </Card>
    </Page>
  )
}

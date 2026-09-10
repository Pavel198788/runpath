import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card, CardText, CardTitle, Page, PageHeader } from '@/ui'
import { getProfile } from '@/data/repositories/profileRepo'

export default function TodayPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const profile = useLiveQuery(getProfile)

  return (
    <Page>
      <PageHeader title={t('today.title')} />
      {profile?.onboardingCompletedAt ? (
        <Card>
          <CardText>{t('today.placeholder')}</CardText>
        </Card>
      ) : (
        <Card>
          <CardTitle>{t('today.noPlan')}</CardTitle>
          <CardText className="mt-2 mb-4">{t('today.noPlanHint')}</CardText>
          <Button fullWidth size="lg" onClick={() => navigate('/onboarding')}>
            {t('today.startOnboarding')}
          </Button>
        </Card>
      )}
    </Page>
  )
}

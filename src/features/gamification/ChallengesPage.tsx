import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { Button, Card, CardText, CardTitle, Page, PageHeader, ProgressBar } from '@/ui'
import { CHALLENGES } from '@content/index'
import {
  activeChallenge,
  challengeProgressM,
  setChallengeStatus,
  startChallenge,
} from '@/data/repositories/challengeRepo'
import { todayIso } from '@/domain/dates/dates'
import { differenceInCalendarDays } from 'date-fns'

export default function ChallengesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const active = useLiveQuery(async () => {
    const c = await activeChallenge()
    if (!c) return null
    return { c, progressM: await challengeProgressM(c) }
  })

  if (active === undefined) return <Page>{t('common.loading')}</Page>

  const today = todayIso()
  if (active) {
    const done = active.progressM / 1000 >= active.c.targetKm
    const expired = today > active.c.endDate
    if (done) void setChallengeStatus(active.c.id, 'done')
    else if (expired) void setChallengeStatus(active.c.id, 'failed')
  }
  const daysLeft = active
    ? Math.max(0, differenceInCalendarDays(new Date(active.c.endDate), new Date(today)))
    : 0

  return (
    <Page className="space-y-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-muted flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t('common.back')}
      </button>
      <PageHeader title={t('gamification.challenges')} />
      <CardText className="text-sm">{t('gamification.challengesHint')}</CardText>

      {active && (
        <Card className="border-accent space-y-2">
          <p className="text-muted text-xs">{t('gamification.active')}</p>
          <CardTitle>{active.c.name}</CardTitle>
          <ProgressBar value={active.progressM / 1000 / active.c.targetKm} label={active.c.name} />
          <CardText className="text-sm">
            {t('gamification.progress', {
              done: Math.round(active.progressM / 100) / 10,
              target: active.c.targetKm,
            })}{' '}
            · {t('gamification.daysLeft', { count: daysLeft })}
          </CardText>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void setChallengeStatus(active.c.id, 'cancelled')}
          >
            {t('gamification.cancel')}
          </Button>
        </Card>
      )}

      {!active &&
        CHALLENGES.map((c) => (
          <Card key={c.id} className="space-y-2">
            <CardTitle>{c.name}</CardTitle>
            <CardText className="text-sm">{c.text}</CardText>
            <Button size="sm" onClick={() => void startChallenge(c.id, c.name, c.km, c.days)}>
              {t('gamification.start')}
            </Button>
          </Card>
        ))}
    </Page>
  )
}

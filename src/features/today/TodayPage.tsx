import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play, PenLine } from 'lucide-react'
import { Badge, Button, Card, CardText, CardTitle, Page, PageHeader } from '@/ui'
import { getProfile } from '@/data/repositories/profileRepo'
import { getActivePlan } from '@/data/repositories/planRepo'
import { db } from '@/data/db'
import { todayIso } from '@/domain/dates/dates'
import type { Workout } from '@/data/entities'
import {
  humanDate,
  longDate,
  minutesOf,
  workoutTitle,
  workoutWhy,
} from '@/features/workout/workoutText'
import { WorkoutRow } from '@/features/plan/WorkoutRow'
import { formatDistance } from '@/domain/units/units'
import { AdaptationCard } from './AdaptationCard'
import { CheckinCard } from './CheckinCard'
import { lessonOfWeek } from '@/features/learn/lessonOfWeek'
import { Toggle } from '@/ui'
import { getWellness, upsertWellness } from '@/data/repositories/wellnessRepo'
import { allWorkoutLogs } from '@/data/repositories/workoutLogRepo'
import { acwr } from '@/domain/load/load'

export default function TodayPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const profile = useLiveQuery(async () => (await getProfile()) ?? null)
  const plan = useLiveQuery(async () => (await getActivePlan()) ?? null)
  const today = todayIso()
  const wellness = useLiveQuery(async () => (await getWellness(today)) ?? null, [today])
  const load = useLiveQuery(async () => {
    const logs = await allWorkoutLogs()
    return acwr(
      logs.map((l) => ({ date: l.date, durationSec: l.durationSec, rpe: l.rpe, type: l.type })),
      today,
    )
  }, [today])

  // Сегодняшние и ближайшие будущие тренировки одним запросом.
  const upcoming = useLiveQuery(
    () =>
      plan
        ? db.workouts
            .where('date')
            .aboveOrEqual(today)
            .filter((w) => w.planId === plan.id && w.deletedAt === null)
            .limit(12)
            .sortBy('date')
        : Promise.resolve([] as Workout[]),
    [plan?.id, today],
  )

  if (profile === undefined || plan === undefined) return <Page>{t('common.loading')}</Page>

  if (!profile?.onboardingCompletedAt || !plan) {
    return (
      <Page>
        <PageHeader title={t('today.title')} />
        <Card>
          <CardTitle>{t('today.noPlan')}</CardTitle>
          <CardText className="mt-2 mb-4">{t('today.noPlanHint')}</CardText>
          <Button fullWidth size="lg" onClick={() => navigate('/onboarding')}>
            {t('today.startOnboarding')}
          </Button>
        </Card>
      </Page>
    )
  }

  const todays = (upcoming ?? []).filter((w) => w.date === today)
  const pending = todays.filter((w) => w.status === 'planned')
  // Главная карточка — беговая тренировка, ОФП показываем второй.
  const main = pending.find((w) => w.type !== 'strength') ?? pending[0] ?? null
  const others = todays.filter((w) => w.id !== main?.id)
  const nextFuture = (upcoming ?? []).find((w) => w.date > today && w.status === 'planned') ?? null
  const week = plan.weeks.find((w) => today >= w.startDate && today < shift(w.startDate, 7))
  const planNotStarted = today < plan.startDate

  return (
    <Page className="space-y-4">
      <PageHeader
        title={t('today.title')}
        subtitle={
          week ? t('today.week', { n: week.index + 1, total: plan.weeks.length }) : undefined
        }
        action={
          week?.isRecovery ? (
            <Badge tone="success">{t('today.recoveryWeek')}</Badge>
          ) : week?.isTaper ? (
            <Badge tone="warning">{t('today.taperWeek')}</Badge>
          ) : undefined
        }
      />

      <AdaptationCard plan={plan} />

      {load?.zone === 'risk' && (
        <Card className="border-warning">
          <CardText className="text-warning">{t('load.riskToday', { ratio: load.ratio })}</CardText>
        </Card>
      )}

      {wellness?.sick && (
        <Card>
          <CardText>{t('wellness.sickOn')}</CardText>
        </Card>
      )}

      {planNotStarted && (
        <Card>
          <CardTitle>{t('today.planStarts', { date: longDate(plan.startDate) })}</CardTitle>
          <CardText className="mt-2">{t('today.planStartsHint')}</CardText>
        </Card>
      )}

      {!planNotStarted && main && !wellness?.sick && <MainWorkoutCard workout={main} />}

      {!planNotStarted && <CheckinCard date={today} mainWorkout={main} />}

      {!planNotStarted && !main && (
        <Card>
          <CardTitle>{todays.length ? t('today.done') : t('today.rest')}</CardTitle>
          <CardText className="mt-2">
            {todays.length ? t('today.doneHint') : t('today.restHint')}
          </CardText>
        </Card>
      )}

      {others.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-muted text-sm font-medium">{t('today.alsoToday')}</h2>
          {others.map((w) => (
            <WorkoutRow key={w.id} workout={w} showDate={false} />
          ))}
        </section>
      )}

      {nextFuture && (!main || planNotStarted) && (
        <section className="space-y-2">
          <h2 className="text-muted text-sm font-medium">{t('today.nextWorkout')}</h2>
          <WorkoutRow workout={nextFuture} />
        </section>
      )}

      {week && (
        <Link
          to={`/learn/${lessonOfWeek(week.phase, week.index - (plan.phases.find((p) => p.phase === week.phase)?.fromWeek ?? 0))?.id ?? ''}`}
          className="bg-surface block rounded-xl border border-border px-4 py-3 text-sm font-medium"
        >
          {t('today.lessonLink', {
            title:
              lessonOfWeek(
                week.phase,
                week.index - (plan.phases.find((p) => p.phase === week.phase)?.fromWeek ?? 0),
              )?.title ?? '',
          })}
        </Link>
      )}

      <div className="flex flex-col items-center gap-2">
        <Link to="/run" className="text-accent text-sm font-medium">
          {t('today.freeRun')}
        </Link>
        <Link to="/log/new" className="text-accent text-sm font-medium">
          {t('workout.logManual')}
        </Link>
      </div>

      <Card>
        <Toggle
          label={t('wellness.sickToday')}
          description={t('wellness.sickHint')}
          checked={wellness?.sick ?? false}
          onChange={(sick) => void upsertWellness(today, { sick })}
        />
      </Card>
    </Page>
  )
}

function MainWorkoutCard({ workout }: { workout: Workout }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <Card className="space-y-4">
      <div>
        <p className="text-muted text-sm">{humanDate(workout.date, t)}</p>
        <CardTitle className="text-2xl">{workoutTitle(workout, t)}</CardTitle>
        <p className="text-muted mt-1">
          {t('workout.estimated', { minutes: minutesOf(workout.estimatedSeconds) })}
          {workout.targetDistanceM
            ? ` · ${t('workout.target', { distance: formatDistance(workout.targetDistanceM, 'metric') })}`
            : ''}
        </p>
      </div>
      <CardText>{workoutWhy(workout.type, t)}</CardText>
      {workout.type !== 'strength' && (
        <Link
          to={`/exercises?routine=${workout.type === 'tempo' || workout.type === 'fartlek' ? 'warmup_quality' : 'warmup_basic'}`}
          className="text-accent text-sm font-medium"
        >
          {t('today.warmupLink')}
        </Link>
      )}
      {workout.type === 'strength' && (
        <Link to="/exercises?routine=strength_a" className="text-accent text-sm font-medium">
          {t('exercises.openStrength')}
        </Link>
      )}
      <div className="flex flex-col gap-2">
        <Button size="lg" fullWidth onClick={() => navigate(`/workout/${workout.id}/timer`)}>
          <Play className="size-5" aria-hidden /> {t('workout.start')}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => navigate(`/log/new?workoutId=${workout.id}`)}
          >
            <PenLine className="size-4" aria-hidden /> {t('workout.logManual')}
          </Button>
          <Button variant="ghost" onClick={() => navigate(`/workout/${workout.id}`)}>
            {t('workout.segments')}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function shift(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

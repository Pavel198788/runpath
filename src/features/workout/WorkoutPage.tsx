import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Play, PenLine } from 'lucide-react'
import { Badge, Button, Card, CardText, CardTitle, Field, Input, Page, PageHeader } from '@/ui'
import { getWorkout, moveWorkout, setWorkoutStatus } from '@/data/repositories/workoutRepo'
import { formatMinSec, formatDistance } from '@/domain/units/units'
import { humanDate, minutesOf, segmentLabel, workoutTitle, workoutWhy } from './workoutText'
import { RoutineList } from '@/features/exercises/RoutineList'
import { strengthRoutineFor, warmupRoutineFor } from '@/features/exercises/routines'
import { workoutsBetween } from '@/data/repositories/workoutRepo'
import { addDaysIso } from '@/domain/dates/dates'

export default function WorkoutPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const workout = useLiveQuery(async () => (await getWorkout(id)) ?? null, [id])
  // Комплекс ОФП чередуется, поэтому смотрим, какой это по счёту силовой день недели.
  const strengthIndex = useLiveQuery(async () => {
    if (!workout || workout.type !== 'strength') return 0
    const weekStart = addDaysIso(workout.date, -6)
    const week = await workoutsBetween(workout.planId, weekStart, addDaysIso(workout.date, 6))
    const sameWeek = week.filter((w) => w.weekIndex === workout.weekIndex && w.type === 'strength')
    return Math.max(
      0,
      sameWeek.findIndex((w) => w.id === workout.id),
    )
  }, [workout?.id, workout?.type])
  const [moving, setMoving] = useState(false)
  const [newDate, setNewDate] = useState('')

  if (workout === undefined) return <Page>{t('common.loading')}</Page>
  if (!workout) return <Page>{t('common.notFound')}</Page>

  const skip = async () => {
    if (window.confirm(t('workout.skipConfirm'))) await setWorkoutStatus(workout.id, 'skipped')
  }
  const move = async () => {
    if (!newDate) return
    await moveWorkout(workout.id, newDate)
    setMoving(false)
  }

  return (
    <Page className="space-y-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-muted flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t('common.back')}
      </button>
      <PageHeader
        title={workoutTitle(workout, t)}
        subtitle={`${humanDate(workout.date, t)} · ${t('workout.estimated', { minutes: minutesOf(workout.estimatedSeconds) })}${
          workout.targetDistanceM ? ` · ${formatDistance(workout.targetDistanceM, 'metric')}` : ''
        }`}
        action={
          workout.status !== 'planned' ? (
            <Badge tone={workout.status === 'done' ? 'success' : 'neutral'}>
              {t(`workout.status.${workout.status}`)}
            </Badge>
          ) : undefined
        }
      />
      {workout.movedFrom && (
        <p className="text-muted text-sm">
          {t('workout.moved', { date: humanDate(workout.movedFrom, t) })}
        </p>
      )}

      <Card>
        <CardText>{workoutWhy(workout.type, t)}</CardText>
      </Card>

      {workout.type === 'strength' && (
        <Card className="space-y-2">
          <CardTitle>{t('exercises.whatToDo')}</CardTitle>
          <RoutineList routine={strengthRoutineFor(workout.weekIndex, strengthIndex ?? 0)} />
        </Card>
      )}

      {workout.type !== 'strength' && (
        <Card className="space-y-2">
          <CardTitle>{t('exercises.warmupBefore')}</CardTitle>
          <RoutineList routine={warmupRoutineFor(workout.type)} />
        </Card>
      )}

      <Card className="space-y-2">
        <CardTitle>{t('workout.segments')}</CardTitle>
        <ol className="divide-border divide-y">
          {workout.segments.map((s, i) => (
            <li key={i} className="flex items-center justify-between py-2">
              <span>
                <span className="block">{segmentLabel(s.kind, t)}</span>
                <span className="text-muted block text-xs">
                  {t('workout.rpeHint', { from: s.rpe[0], to: s.rpe[1] })} —{' '}
                  {t(`workout.rpe.${s.rpe[1]}`)}
                </span>
              </span>
              <span className="font-mono font-medium">{formatMinSec(s.seconds)}</span>
            </li>
          ))}
        </ol>
      </Card>

      {workout.type !== 'strength' && (
        <Card className="space-y-2">
          <CardTitle>{t('exercises.cooldownAfter')}</CardTitle>
          <RoutineList routine="cooldown" />
        </Card>
      )}

      {workout.status === 'planned' && (
        <div className="space-y-2">
          <Button size="lg" fullWidth onClick={() => navigate(`/workout/${workout.id}/timer`)}>
            <Play className="size-5" aria-hidden /> {t('workout.start')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => navigate(`/log/new?workoutId=${workout.id}`)}
          >
            <PenLine className="size-4" aria-hidden /> {t('workout.logManual')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" fullWidth onClick={() => setMoving((m) => !m)}>
              {t('workout.move')}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => void skip()}>
              {t('workout.skip')}
            </Button>
          </div>
          {moving && (
            <Card className="space-y-3">
              <Field label={t('workout.moveTitle')}>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </Field>
              <Button fullWidth disabled={!newDate} onClick={() => void move()}>
                {t('common.save')}
              </Button>
            </Card>
          )}
        </div>
      )}
      {workout.status === 'skipped' && (
        <Button
          variant="secondary"
          fullWidth
          onClick={() => void setWorkoutStatus(workout.id, 'planned')}
        >
          {t('workout.unskip')}
        </Button>
      )}
    </Page>
  )
}

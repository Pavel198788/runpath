import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, CardTitle, Page, PageHeader, ProgressBar, Stat } from '@/ui'
import { allWorkoutLogs } from '@/data/repositories/workoutLogRepo'
import { getActivePlan } from '@/data/repositories/planRepo'
import { addDaysIso, mondayOf, toIsoDate, todayIso } from '@/domain/dates/dates'
import { formatDistance, formatDuration } from '@/domain/units/units'
import type { Phase } from '@/domain/plan/types'
import { shortDate } from '@/features/workout/workoutText'

const LEVEL_BY_PHASE: Record<Phase, string> = {
  walk: 'walker',
  base: 'walker',
  k5: 'jogger',
  k10: 'runner',
  half: 'half',
  marathon: 'marathon',
}

export default function ProgressPage() {
  const { t } = useTranslation()
  const logs = useLiveQuery(allWorkoutLogs)
  const plan = useLiveQuery(async () => (await getActivePlan()) ?? null)

  if (logs === undefined || plan === undefined) return <Page>{t('common.loading')}</Page>

  const today = todayIso()
  const totalDistance = logs.reduce((a, l) => a + (l.distanceM ?? 0), 0)
  const totalTime = logs.reduce((a, l) => a + l.durationSec, 0)

  // Недели: 8 последних, по понедельникам. Считаем минуты в движении — они есть у любой записи.
  const thisMonday = toIsoDate(mondayOf(new Date()))
  const weeks = Array.from({ length: 8 }, (_, i) => addDaysIso(thisMonday, -7 * (7 - i)))
  const weekly = weeks.map((start) => {
    const end = addDaysIso(start, 6)
    const minutes =
      logs.filter((l) => l.date >= start && l.date <= end).reduce((a, l) => a + l.durationSec, 0) /
      60
    return { start, minutes: Math.round(minutes) }
  })
  const maxMinutes = Math.max(30, ...weekly.map((w) => w.minutes))

  const currentWeek = plan?.weeks.find(
    (w) => today >= w.startDate && today < addDaysIso(w.startDate, 7),
  )
  const weeksDone = plan ? plan.weeks.filter((w) => addDaysIso(w.startDate, 7) <= today).length : 0
  const phase = currentWeek?.phase ?? plan?.phases[0]?.phase ?? 'walk'
  const level = plan ? LEVEL_BY_PHASE[phase] : 'walker'

  return (
    <Page className="space-y-4">
      <PageHeader
        title={t('progress.title')}
        subtitle={`${t('progress.level')}: ${t(`progress.levels.${level}`)}`}
      />

      {plan && (
        <Card className="space-y-2">
          <CardTitle>{t('progress.planProgress')}</CardTitle>
          <ProgressBar value={weeksDone / plan.weeks.length} label={t('progress.planProgress')} />
          <p className="text-muted text-sm">
            {t('progress.weeksDone', { done: weeksDone, total: plan.weeks.length })} ·{' '}
            {t(`phase.${phase}`)}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat label={t('progress.totalWorkouts')} value={String(logs.length)} />
        <Stat label={t('progress.totalDistance')} value={formatDistance(totalDistance, 'metric')} />
        <Stat label={t('progress.totalTime')} value={formatDuration(totalTime)} />
      </div>

      <Card>
        <CardTitle>{t('progress.weekly')}</CardTitle>
        <p className="text-muted mb-3 text-sm">{t('progress.weeklyHint')}</p>
        <div className="flex h-36 items-end gap-1.5" role="img" aria-label={t('progress.weekly')}>
          {weekly.map((w, i) => (
            <div key={w.start} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-muted text-[10px]">{w.minutes || ''}</span>
              <div
                className={
                  i === weekly.length - 1
                    ? 'bg-accent w-full rounded-t-md'
                    : 'bg-accent/50 w-full rounded-t-md'
                }
                style={{ height: `${Math.max(2, (w.minutes / maxMinutes) * 100)}px` }}
              />
              <span className="text-muted text-[10px]">{shortDate(w.start)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Link to="/history" className="text-accent block text-center text-sm font-medium">
        {t('progress.history')}
      </Link>
      {logs.length === 0 && <p className="text-muted text-center text-sm">{t('progress.empty')}</p>}
    </Page>
  )
}

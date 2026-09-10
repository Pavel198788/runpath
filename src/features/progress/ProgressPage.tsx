import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Award, Share2 } from 'lucide-react'
import { Badge, Button, Card, CardText, CardTitle, Page, PageHeader, ProgressBar, Stat } from '@/ui'
import { allWorkoutLogs } from '@/data/repositories/workoutLogRepo'
import { getActivePlan } from '@/data/repositories/planRepo'
import { workoutsBetween } from '@/data/repositories/workoutRepo'
import {
  markAchievementsSeen,
  refreshGamification,
  type GamificationState,
} from '@/data/services/gamificationService'
import { addDaysIso, mondayOf, toIsoDate, todayIso } from '@/domain/dates/dates'
import { formatDistance, formatDuration } from '@/domain/units/units'
import { acwr, dailyLoads, monotony } from '@/domain/load/load'
import { weeklyReport } from '@/domain/gamification/weeklyReport'
import { ALL_ACHIEVEMENTS } from '@/domain/gamification/achievements'
import { MILESTONES } from '@content/index'
import { MARATHON_DISTANCE_KM } from '@/config/app'
import { shortDate } from '@/features/workout/workoutText'
import { renderShareCard, shareOrDownload } from '@/features/gamification/ShareCard'
import { cn } from '@/lib/cn'

export default function ProgressPage() {
  const { t } = useTranslation()
  const logs = useLiveQuery(allWorkoutLogs)
  const plan = useLiveQuery(async () => (await getActivePlan()) ?? null)
  const [game, setGame] = useState<GamificationState | null>(null)

  const today = todayIso()
  const thisMonday = toIsoDate(mondayOf(new Date()))
  const lastMonday = addDaysIso(thisMonday, -7)
  const lastWeekWorkouts = useLiveQuery(
    () =>
      plan ? workoutsBetween(plan.id, lastMonday, addDaysIso(lastMonday, 6)) : Promise.resolve([]),
    [plan?.id, lastMonday],
  )

  // Достижения пересчитываем при изменении журнала.
  useEffect(() => {
    if (!logs) return
    let alive = true
    void refreshGamification().then((g) => {
      if (alive) setGame(g)
    })
    return () => {
      alive = false
    }
  }, [logs])

  if (logs === undefined || plan === undefined) return <Page>{t('common.loading')}</Page>

  const totalDistance = logs.reduce((a, l) => a + (l.distanceM ?? 0), 0)
  const totalTime = logs.reduce((a, l) => a + l.durationSec, 0)
  const bestM = Math.max(
    0,
    ...logs.filter((l) => l.type !== 'strength' && l.type !== 'walk').map((l) => l.distanceM ?? 0),
  )
  const totalKm = totalDistance / 1000
  const milestone = [...MILESTONES].reverse().find((m) => totalKm >= m.km) ?? null
  const nextMilestone = MILESTONES.find((m) => totalKm < m.km) ?? null

  const weeks = Array.from({ length: 8 }, (_, i) => addDaysIso(thisMonday, -7 * (7 - i)))
  const weekly = weeks.map((start) => {
    const end = addDaysIso(start, 6)
    const minutes =
      logs.filter((l) => l.date >= start && l.date <= end).reduce((a, l) => a + l.durationSec, 0) /
      60
    return { start, minutes: Math.round(minutes) }
  })
  const maxMinutes = Math.max(30, ...weekly.map((w) => w.minutes))

  const entries = logs.map((l) => ({
    date: l.date,
    durationSec: l.durationSec,
    rpe: l.rpe,
    type: l.type,
  }))
  const load = acwr(entries, today)
  const mono = monotony(dailyLoads(entries, addDaysIso(today, -6), today))
  const zoneTone =
    load.zone === 'safe'
      ? 'success'
      : load.zone === 'caution'
        ? 'warning'
        : load.zone === 'risk'
          ? 'danger'
          : 'neutral'

  const currentWeek = plan?.weeks.find(
    (w) => today >= w.startDate && today < addDaysIso(w.startDate, 7),
  )
  const weeksDone = plan ? plan.weeks.filter((w) => addDaysIso(w.startDate, 7) <= today).length : 0
  const phase = currentWeek?.phase ?? plan?.phases[0]?.phase ?? 'walk'
  const report = weeklyReport(
    logs
      .filter((l) => l.date >= lastMonday && l.date < thisMonday)
      .map((l) => ({
        date: l.date,
        type: l.type,
        durationSec: l.durationSec,
        distanceM: l.distanceM,
        rpe: l.rpe,
      })),
    (lastWeekWorkouts ?? []).map((w) => ({ date: w.date, type: w.type, status: w.status })),
  )
  const level = game?.level ?? 'walker'

  const share = async () => {
    const blob = await renderShareCard({
      title: t('gamification.shareTitle'),
      level: t(`progress.levels.${level}`),
      totalKm,
      streakWeeks: game?.streak.weeks ?? 0,
      bestKm: bestM / 1000,
      appName: 'RunPath',
    })
    await shareOrDownload(blob, 'runpath.png', t('gamification.shareTitle'))
  }

  return (
    <Page className="space-y-4">
      <PageHeader
        title={t('progress.title')}
        subtitle={`${t('progress.level')}: ${t(`progress.levels.${level}`)}`}
      />

      {game && game.fresh.length > 0 && (
        <Card className="border-accent space-y-2">
          <CardTitle className="flex items-center gap-2">
            <Award className="text-accent size-5" aria-hidden /> {t('gamification.newAchievement')}
          </CardTitle>
          {game.fresh.map((a) => (
            <CardText key={a.id}>{t(`gamification.a.${a.key}`)}</CardText>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              void markAchievementsSeen(game.fresh.map((a) => a.id)).then(() =>
                setGame({ ...game, fresh: [] }),
              )
            }
          >
            {t('common.done')}
          </Button>
        </Card>
      )}

      <Card className="space-y-2">
        <CardTitle>{t('gamification.path')}</CardTitle>
        <ProgressBar value={bestM / 1000 / MARATHON_DISTANCE_KM} label={t('gamification.path')} />
        <div className="text-muted flex justify-between text-xs">
          <span>0</span>
          <span>5</span>
          <span>10</span>
          <span>21,1</span>
          <span>42,2</span>
        </div>
        <CardText className="text-sm">
          {t('gamification.pathHint', { best: formatDistance(bestM, 'metric') })}
        </CardText>
        {milestone && (
          <CardText className="text-sm">
            {t('gamification.milestone', { km: Math.round(totalKm), text: milestone.text })}
          </CardText>
        )}
        {nextMilestone && (
          <CardText className="text-muted text-xs">
            {t('gamification.milestoneNext', {
              text: nextMilestone.text,
              km: Math.ceil(nextMilestone.km - totalKm),
            })}
          </CardText>
        )}
      </Card>

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

      {game && (
        <Card className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle>{t('gamification.streak')}</CardTitle>
            <Badge tone={game.streak.weeks > 0 ? 'accent' : 'neutral'}>
              {t('gamification.streakWeeks', { count: game.streak.weeks })}
            </Badge>
          </div>
          <CardText className="text-xs">
            {t('gamification.streakHint')}
            {game.streak.frozenUsed > 0 && ` · ${t('gamification.frozen')}`}
          </CardText>
        </Card>
      )}

      <Card className="space-y-2">
        <CardTitle>{t('gamification.report')}</CardTitle>
        <CardText className="text-sm">
          {t('gamification.reportDone', { done: report.doneRuns, planned: report.plannedRuns })} ·{' '}
          {t('gamification.reportStats', {
            minutes: report.minutes,
            km: String(report.km).replace('.', ','),
          })}
          {report.avgRpe !== null &&
            ` · ${t('gamification.reportRpe', { rpe: String(report.avgRpe).replace('.', ',') })}`}
        </CardText>
        <CardText className="text-sm">{t(`gamification.verdict.${report.verdict}`)}</CardText>
      </Card>

      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle>{t('load.title')}</CardTitle>
          <Badge tone={zoneTone}>{t(`load.zone.${load.zone}`)}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label={t('load.acwr')}
            value={load.ratio !== null ? String(load.ratio).replace('.', ',') : '—'}
          />
          <Stat label={t('load.acute')} value={String(Math.round(load.acute))} />
          <Stat label={t('load.chronic')} value={String(Math.round(load.chronic))} />
        </div>
        <p className="text-muted text-sm">{t(`load.zoneHint.${load.zone}`)}</p>
        {mono !== null && Number.isFinite(mono) && mono > 2 && (
          <p className="text-warning text-sm">
            {t('load.monotony')} {String(mono).replace('.', ',')} — {t('load.monotonyHint')}
          </p>
        )}
      </Card>

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

      {game && (
        <Card>
          <CardTitle className="mb-2">{t('gamification.achievements')}</CardTitle>
          <ul className="grid grid-cols-3 gap-2">
            {ALL_ACHIEVEMENTS.map((id) => {
              const u = game.unlocked.find((x) => x.id === id)
              return (
                <li
                  key={id}
                  className={cn(
                    'rounded-xl border p-2 text-center text-xs',
                    u ? 'border-accent bg-accent/10' : 'border-border opacity-50',
                  )}
                >
                  <Award
                    className={cn('mx-auto mb-1 size-6', u ? 'text-accent' : 'text-muted')}
                    aria-hidden
                  />
                  {t(`gamification.a.${id}`)}
                  {u && <span className="text-muted block">{shortDate(u.date)}</span>}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <div className="flex flex-col items-center gap-2">
        <Button variant="outline" onClick={() => void share()}>
          <Share2 className="size-4" aria-hidden /> {t('gamification.share')}
        </Button>
        <Link to="/challenges" className="text-accent text-sm font-medium">
          {t('gamification.challenges')}
        </Link>
        <Link to="/history" className="text-accent text-sm font-medium">
          {t('progress.history')}
        </Link>
      </div>
    </Page>
  )
}

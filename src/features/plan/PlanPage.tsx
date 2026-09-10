import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown } from 'lucide-react'
import { Badge, Button, Card, CardText, Page, PageHeader } from '@/ui'
import { getActivePlan } from '@/data/repositories/planRepo'
import { workoutsOfPlan } from '@/data/repositories/workoutRepo'
import { todayIso } from '@/domain/dates/dates'
import { cn } from '@/lib/cn'
import { longDate, shortDate } from '@/features/workout/workoutText'
import { WorkoutRow } from './WorkoutRow'
import { useNavigate } from 'react-router-dom'

export default function PlanPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const plan = useLiveQuery(async () => (await getActivePlan()) ?? null)
  const workouts = useLiveQuery(
    () => (plan ? workoutsOfPlan(plan.id) : Promise.resolve([])),
    [plan?.id],
  )
  const [open, setOpen] = useState<number | null>(null)

  if (plan === undefined) return <Page>{t('common.loading')}</Page>
  if (!plan) {
    return (
      <Page>
        <PageHeader title={t('plan.title')} />
        <Card className="space-y-3">
          <CardText>{t('plan.noPlan')}</CardText>
          <Button onClick={() => navigate('/onboarding')}>{t('today.startOnboarding')}</Button>
        </Card>
      </Page>
    )
  }

  const today = todayIso()
  const currentWeek =
    plan.weeks.find((w) => today >= w.startDate && today < addWeek(w.startDate)) ?? plan.weeks[0]
  const opened = open ?? currentWeek?.index ?? 0

  return (
    <Page className="space-y-3">
      <PageHeader
        title={t('plan.title')}
        subtitle={t('plan.subtitle', {
          weeks: t('common.weeks', { count: plan.weeks.length }),
          date: longDate(plan.endDate),
        })}
      />
      {plan.warnings.map((w) => (
        <p key={w} className="text-warning text-sm">
          {t(`plan.warnings.${w}`, { date: longDate(plan.endDate) })}
        </p>
      ))}

      {plan.phases.map((phase) => (
        <section key={phase.phase} className="space-y-2">
          <h2 className="mt-4 text-lg font-semibold">{t(`phase.${phase.phase}`)}</h2>
          <p className="text-muted text-sm">{t(`phase.hint.${phase.phase}`)}</p>
          {plan.weeks.slice(phase.fromWeek, phase.toWeek + 1).map((week) => {
            const isOpen = opened === week.index
            const isCurrent = currentWeek?.index === week.index
            const items = (workouts ?? []).filter((w) => w.weekIndex === week.index)
            const unit = week.unit === 'min' ? t('plan.unitMin') : t('plan.unitKm')
            return (
              <div
                key={week.index}
                className={cn('rounded-card border border-border', isCurrent && 'border-accent')}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : week.index)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {t('today.week', { n: week.index + 1, total: plan.weeks.length })}
                      {isCurrent && <Badge tone="accent">{t('plan.currentWeek')}</Badge>}
                      {week.isRecovery && <Badge tone="success">{t('today.recoveryWeek')}</Badge>}
                      {week.isTaper && <Badge tone="warning">{t('today.taperWeek')}</Badge>}
                    </span>
                    <span className="text-muted block text-sm">
                      {shortDate(week.startDate)} ·{' '}
                      {t('plan.volume', { value: fmt(week.volume), unit })} ·{' '}
                      {t('plan.longRun', { value: fmt(week.longRun), unit })}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn('text-muted size-5 transition-transform', isOpen && 'rotate-180')}
                    aria-hidden
                  />
                </button>
                {isOpen && (
                  <div className="space-y-2 px-3 pb-3">
                    {items.map((w) => (
                      <WorkoutRow key={w.id} workout={w} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}
    </Page>
  )
}

function addWeek(iso: string): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

function fmt(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',')
}

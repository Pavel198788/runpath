import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { Card, CardText, CardTitle, Field, Input, Page, PageHeader } from '@/ui'
import { getProfile } from '@/data/repositories/profileRepo'
import { getActivePlan } from '@/data/repositories/planRepo'
import { db } from '@/data/db'
import { carbLoadPlan, raceDayPlan } from '@/domain/nutrition/fueling'
import { todayIso } from '@/domain/dates/dates'
import { longDate, workoutTitle } from '@/features/workout/workoutText'

export default function RaceDayPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const profile = useLiveQuery(async () => (await getProfile()) ?? null)
  const race = useLiveQuery(async () => {
    const plan = await getActivePlan()
    if (!plan) return null
    const today = todayIso()
    return (
      (await db.workouts
        .where('planId')
        .equals(plan.id)
        .filter((w) => w.deletedAt === null && w.type === 'race' && w.date >= today)
        .first()) ?? null
    )
  })
  const [weight, setWeight] = useState('')
  const [minutes, setMinutes] = useState('')

  if (profile === undefined || race === undefined) return <Page>{t('common.loading')}</Page>

  const w = Number(weight) || profile?.weightKg || 70
  const dur = Number(minutes) || (race ? Math.round(race.estimatedSeconds / 60) : 300)
  const load = carbLoadPlan(w)
  const steps = raceDayPlan(w, dur)

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
        title={t('nutrition.raceTitle')}
        subtitle={
          race ? `${workoutTitle(race, t)} · ${longDate(race.date)}` : t('nutrition.raceNoRace')
        }
      />

      <Card className="grid grid-cols-2 gap-3">
        <Field label={t('nutrition.raceWeight')}>
          <Input
            type="number"
            inputMode="decimal"
            placeholder={String(w)}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </Field>
        <Field label={t('nutrition.raceDuration')}>
          <Input
            type="number"
            inputMode="numeric"
            placeholder={String(dur)}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </Field>
      </Card>

      <Card className="space-y-3">
        <CardTitle>{t('nutrition.carbLoad')}</CardTitle>
        <CardText className="text-sm">{t('nutrition.kindHint.carb_load')}</CardText>
        {load.map((d) => (
          <div key={d.daysBeforeRace} className="bg-surface-2 rounded-xl p-3 text-sm">
            <p className="font-medium">
              {t('nutrition.carbLoadDay', { days: d.daysBeforeRace })} —{' '}
              {t('nutrition.carbLoadTarget', { grams: d.carbsG, perKg: d.carbsPerKg })}
            </p>
            <ul className="text-muted mt-1 list-disc pl-5">
              {d.tips.map((tip) => (
                <li key={tip}>{t(`nutrition.carbTips.${tip}`)}</li>
              ))}
            </ul>
          </div>
        ))}
      </Card>

      <Card className="space-y-2">
        <CardTitle>{t('nutrition.raceDayTitle')}</CardTitle>
        <ol className="space-y-2 text-sm">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-muted w-24 shrink-0 font-mono text-xs">
                {s.minutesFromStart < 0
                  ? t('nutrition.minutesBefore', { minutes: -s.minutesFromStart })
                  : s.minutesFromStart === 0
                    ? t('nutrition.atStart')
                    : t('nutrition.minutesAfter', { minutes: s.minutesFromStart })}
              </span>
              <span>{t(`nutrition.raceSteps.${s.key}`, s.params)}</span>
            </li>
          ))}
        </ol>
      </Card>
    </Page>
  )
}

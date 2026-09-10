import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardText,
  CardTitle,
  Page,
  PageHeader,
  ProgressBar,
  Toggle,
} from '@/ui'
import { getProfile } from '@/data/repositories/profileRepo'
import {
  getNutritionDay,
  removeNutritionEntry,
  setLightMark,
} from '@/data/repositories/nutritionRepo'
import { targetsFor } from '@/data/services/nutritionService'
import { addDaysIso, todayIso } from '@/domain/dates/dates'
import { totalsOf } from '@/domain/nutrition/totals'
import { fuelingFor } from '@/domain/nutrition/fueling'
import { reviewEating, type EatingDay } from '@/domain/nutrition/eatingReview'
import { nutritionDaysBetween } from '@/data/repositories/nutritionRepo'
import { dayContextFor } from '@/data/services/nutritionService'
import { dayKind } from '@/domain/nutrition/targets'
import { getActivePlan } from '@/data/repositories/planRepo'
import type { LightMark } from '@/data/entities'
import { humanDate, workoutTitle } from '@/features/workout/workoutText'
import { cn } from '@/lib/cn'
import { FoodPicker } from './FoodPicker'
import { FOODS } from '@content/nutrition'

const LIGHT: LightMark[] = ['normal', 'little', 'over']

export default function NutritionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [date, setDate] = useState(todayIso())
  const [picking, setPicking] = useState(false)
  const [hot, setHot] = useState(false)
  const profile = useLiveQuery(async () => (await getProfile()) ?? null)
  const day = useLiveQuery(async () => (await getNutritionDay(date)) ?? null, [date])
  // Картина недели по быстрым отметкам: ради неё эти кнопки и нужны.
  const eating = useLiveQuery(async () => {
    const from = addDaysIso(date, -6)
    const plan = (await getActivePlan()) ?? null
    const days = await nutritionDaysBetween(from, date)
    const byDate = new Map(days.map((d) => [d.date, d.light]))
    const week: EatingDay[] = []
    for (let i = 6; i >= 0; i--) {
      const d = addDaysIso(date, -i)
      week.push({
        date: d,
        mark: byDate.get(d) ?? null,
        kind: dayKind(await dayContextFor(d, plan)),
      })
    }
    const tomorrow = dayKind(await dayContextFor(addDaysIso(date, 1), plan))
    return { week, review: reviewEating(week, tomorrow) }
  }, [date])

  const calc = useLiveQuery(
    async () => (profile ? await targetsFor(date, profile) : null),
    [date, profile?.id, profile?.weightKg, profile?.weightGoal],
  )

  if (profile === undefined || day === undefined || calc === undefined)
    return <Page>{t('common.loading')}</Page>

  const totals = totalsOf(day?.entries ?? [])
  const targets = calc?.targets ?? null
  const mainWorkout = calc?.ctx.workouts.find((w) => w.type !== 'strength') ?? null
  const fueling =
    mainWorkout && profile?.weightKg
      ? fuelingFor(mainWorkout, profile.weightKg, {
          hot,
          marathonPhase: calc?.ctx.phase === 'marathon',
        })
      : null
  const daysToRace = calc?.ctx.daysToRace ?? null

  return (
    <Page className="space-y-4">
      <PageHeader
        title={t('nutrition.title')}
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t('common.back')}
              onClick={() => setDate(addDaysIso(date, -1))}
              className="p-2"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <span className="text-sm font-medium">{humanDate(date, t)}</span>
            <button
              type="button"
              aria-label={t('common.continue')}
              onClick={() => setDate(addDaysIso(date, 1))}
              className="p-2"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>
        }
      />

      {!targets && (
        <Card className="space-y-3">
          <CardText>{t('nutrition.noWeight')}</CardText>
          <Button onClick={() => navigate('/profile')}>{t('nutrition.toProfile')}</Button>
        </Card>
      )}

      {targets && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle>{t('nutrition.targetsTitle')}</CardTitle>
            <Badge
              tone={
                targets.kind === 'rest'
                  ? 'neutral'
                  : targets.kind === 'carb_load' || targets.kind === 'race'
                    ? 'warning'
                    : 'accent'
              }
            >
              {t(`nutrition.kind.${targets.kind}`)}
            </Badge>
          </div>
          <CardText className="text-sm">{t(`nutrition.kindHint.${targets.kind}`)}</CardText>
          <Macro
            label={t('nutrition.calories')}
            value={totals.kcal}
            target={targets.calories}
            unit=""
          />
          <Macro
            label={t('nutrition.carbs')}
            value={totals.carbs}
            target={targets.carbsG}
            unit="г"
            hint={t('nutrition.why.carbs', { perKg: targets.carbsPerKg })}
          />
          <Macro
            label={t('nutrition.protein')}
            value={totals.protein}
            target={targets.proteinG}
            unit="г"
            hint={t('nutrition.why.protein')}
          />
          <Macro
            label={t('nutrition.fat')}
            value={totals.fat}
            target={targets.fatG}
            unit="г"
            hint={t('nutrition.why.fat')}
          />
          {targets.deficit > 0 && (
            <CardText className="text-sm">
              {t('nutrition.deficit', { value: targets.deficit })}
            </CardText>
          )}
          {targets.warnings.map((w) => (
            <CardText
              key={w}
              className={cn('text-sm', w === 'red_s' ? 'text-danger' : 'text-warning')}
            >
              {t(`nutrition.warnings.${w}`)}
            </CardText>
          ))}
        </Card>
      )}

      {daysToRace !== null && daysToRace <= 7 && daysToRace >= 0 && (
        <Link
          to="/nutrition/race"
          className="bg-accent/10 border-accent block rounded-xl border px-4 py-3 font-medium"
        >
          {t('nutrition.raceDayShort', { days: daysToRace })}
        </Link>
      )}

      {fueling && mainWorkout && (
        <Card className="space-y-2">
          <CardTitle>
            {t('nutrition.fueling.title', {
              workout: workoutTitle(
                { type: mainWorkout.type, targetDistanceM: mainWorkout.targetDistanceM },
                t,
              ),
            })}
          </CardTitle>
          <Toggle
            label={t('nutrition.hot')}
            description={t('nutrition.hotHint')}
            checked={hot}
            onChange={setHot}
          />
          <Step
            title={t('nutrition.fueling.before')}
            text={t('nutrition.fueling.beforeText', {
              from: fueling.beforeCarbsG[0],
              to: fueling.beforeCarbsG[1],
            })}
          />
          <Step
            title={t('nutrition.fueling.during')}
            text={
              fueling.duringCarbsPerHour
                ? t('nutrition.fueling.duringText', {
                    from: fueling.duringCarbsPerHour[0],
                    to: fueling.duringCarbsPerHour[1],
                  })
                : t('nutrition.fueling.duringNone')
            }
          />
          <Step
            title="💧"
            text={t('nutrition.fueling.fluids', {
              from: fueling.fluidsMlPerHour[0],
              to: fueling.fluidsMlPerHour[1],
              electrolytes: fueling.electrolytes
                ? t('nutrition.fueling.electrolytesYes')
                : t('nutrition.fueling.electrolytesNo'),
            })}
          />
          <Step
            title={t('nutrition.fueling.after')}
            text={t('nutrition.fueling.afterText', {
              carbs: fueling.afterCarbsG,
              pfrom: fueling.afterProteinG[0],
              pto: fueling.afterProteinG[1],
            })}
          />
          {fueling.gutTraining && (
            <CardText className="text-accent text-sm">{t('nutrition.fueling.gut')}</CardText>
          )}
        </Card>
      )}

      <Card className="space-y-3">
        <CardTitle>{t('nutrition.diary')}</CardTitle>
        <p className="text-sm font-medium">{t('nutrition.light')}</p>
        <div className="grid grid-cols-3 gap-2">
          {LIGHT.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={day?.light === m}
              onClick={() => void setLightMark(date, day?.light === m ? null : m)}
              className={cn(
                'min-h-11 rounded-xl border text-sm font-medium',
                day?.light === m ? 'border-accent bg-accent/10' : 'border-border bg-surface',
              )}
            >
              {t(`nutrition.lightOptions.${m}`)}
            </button>
          ))}
        </div>
        <p className="text-muted text-xs">{t('nutrition.lightHint')}</p>

        {eating && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('nutrition.week')}</p>
            <div className="flex gap-1">
              {eating.week.map((d) => (
                <div key={d.date} className="flex-1 text-center">
                  <div
                    className={cn(
                      'h-8 rounded-md border',
                      d.mark === 'normal'
                        ? 'bg-success/25 border-success/40'
                        : d.mark === 'little'
                          ? 'bg-warning/25 border-warning/40'
                          : d.mark === 'over'
                            ? 'bg-info/25 border-info/40'
                            : 'bg-surface-2 border-border',
                    )}
                    title={d.mark ? t(`nutrition.marksLegend.${d.mark}`) : ''}
                  />
                  <span className="text-muted text-[10px]">{d.date.slice(8)}</span>
                </div>
              ))}
            </div>
            <p
              className={cn(
                'text-sm',
                eating.review.verdict === 'under_hard_days' ||
                  eating.review.verdict === 'under_often'
                  ? 'text-danger'
                  : eating.review.verdict === 'before_long' ||
                      eating.review.verdict === 'over_often'
                    ? 'text-warning'
                    : 'text-muted',
              )}
            >
              {t(`nutrition.verdict.${eating.review.verdict}`)}
            </p>
          </div>
        )}
        <p className="text-muted text-xs">{t('nutrition.dbSource', { count: FOODS.length })}</p>

        {picking ? (
          <FoodPicker date={date} onClose={() => setPicking(false)} />
        ) : (
          <Button variant="secondary" fullWidth onClick={() => setPicking(true)}>
            <Plus className="size-4" aria-hidden /> {t('nutrition.addFood')}
          </Button>
        )}

        {day && day.entries.length > 0 && (
          <ul className="divide-border divide-y">
            {day.entries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{e.name}</span>
                  <span className="text-muted">
                    {e.amount} {e.recipeId ? t('nutrition.servings') : ''} · {e.kcal}{' '}
                    {t('nutrition.calories')} · У {e.carbs} Б {e.protein} Ж {e.fat}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={t('common.delete')}
                  onClick={() => void removeNutritionEntry(date, e.id)}
                  className="text-muted p-2"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-col items-center gap-2">
        <Link to="/nutrition/recipes" className="text-accent text-sm font-medium">
          {t('nutrition.recipes')}
        </Link>
        <Link to="/nutrition/race" className="text-accent text-sm font-medium">
          {t('nutrition.raceDay')}
        </Link>
      </div>
    </Page>
  )
}

function Macro({
  label,
  value,
  target,
  unit,
  hint,
}: {
  label: string
  value: number
  target: number
  unit: string
  hint?: string
}) {
  const { t } = useTranslation()
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted">
          {t('nutrition.eaten', {
            value: `${Math.round(value)}${unit}`,
            target: `${target}${unit}`,
          })}
        </span>
      </div>
      <ProgressBar value={target ? value / target : 0} className="mt-1 h-2" label={label} />
      {hint && <p className="text-muted mt-1 text-xs">{hint}</p>}
    </div>
  )
}

function Step({ title, text }: { title: string; text: string }) {
  return (
    <div className="text-sm">
      <span className="font-medium">{title}. </span>
      <span className="text-muted">{text}</span>
    </div>
  )
}

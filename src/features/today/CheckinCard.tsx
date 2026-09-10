import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Badge, Button, Card, CardText, CardTitle, Field, Input } from '@/ui'
import { getWellness, upsertWellness } from '@/data/repositories/wellnessRepo'
import { db } from '@/data/db'
import { readiness } from '@/domain/readiness/readiness'
import { addDaysIso } from '@/domain/dates/dates'
import type { Workout } from '@/data/entities'
import { buildSegments } from '@/domain/plan/segments'
import { touch } from '@/data/repositories/helpers'
import { cn } from '@/lib/cn'

/** Утренний чек-ин: сон, стресс, пульс покоя → готовность и совет. */
export function CheckinCard({ date, mainWorkout }: { date: string; mainWorkout: Workout | null }) {
  const { t } = useTranslation()
  const entry = useLiveQuery(async () => (await getWellness(date)) ?? null, [date])
  const baseline = useLiveQuery(async () => {
    const rows = await db.wellness
      .where('date')
      .between(addDaysIso(date, -14), addDaysIso(date, -1), true, true)
      .filter((w) => w.deletedAt === null && w.restingHr !== null)
      .toArray()
    if (rows.length < 3) return null
    return rows.reduce((a, r) => a + (r.restingHr ?? 0), 0) / rows.length
  }, [date])

  if (entry === undefined || baseline === undefined) return null
  const r = readiness({
    sleepHours: entry?.sleepHours ?? null,
    stress: entry?.stress ?? null,
    restingHr: entry?.restingHr ?? null,
    baselineHr: baseline,
    sick: entry?.sick ?? false,
  })
  const canSwap =
    mainWorkout &&
    (mainWorkout.type === 'tempo' ||
      mainWorkout.type === 'fartlek' ||
      mainWorkout.type === 'long') &&
    mainWorkout.status === 'planned'

  const swapToEasy = async () => {
    if (!mainWorkout) return
    const segments = buildSegments('easy', Math.round(mainWorkout.estimatedSeconds * 0.7))
    await db.workouts.put(
      touch(mainWorkout, {
        type: 'easy',
        segments,
        estimatedSeconds: segments.reduce((a, s) => a + s.seconds, 0),
        targetDistanceM: mainWorkout.targetDistanceM
          ? Math.round(mainWorkout.targetDistanceM * 0.7)
          : null,
      }),
    )
  }
  const levelTone =
    r.level === 'high'
      ? 'success'
      : r.level === 'medium'
        ? 'warning'
        : r.level === 'low'
          ? 'danger'
          : 'neutral'

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <CardTitle>{t('wellness.checkin')}</CardTitle>
        <Badge tone={levelTone}>
          {t('wellness.readiness')}: {r.score !== null ? `${r.score} · ` : ''}
          {t(`wellness.readinessLevel.${r.level}`)}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label={t('wellness.sleep')}>
          <Input
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            max={14}
            value={entry?.sleepHours ?? ''}
            onChange={(e) =>
              void upsertWellness(date, {
                sleepHours: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </Field>
        <Field label={t('wellness.restingHr')}>
          <Input
            type="number"
            inputMode="numeric"
            min={30}
            max={120}
            value={entry?.restingHr ?? ''}
            onChange={(e) =>
              void upsertWellness(date, {
                restingHr: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium">{t('wellness.stress')}</span>
          <div className="flex gap-1" role="radiogroup" aria-label={t('wellness.stress')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={entry?.stress === n}
                aria-label={(t('wellness.stressLevels', { returnObjects: true }) as string[])[n]}
                onClick={() =>
                  void upsertWellness(date, { stress: entry?.stress === n ? null : n })
                }
                className={cn(
                  'min-h-12 flex-1 rounded-lg border text-sm',
                  entry?.stress === n ? 'border-accent bg-accent/10 font-bold' : 'border-border',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
      {r.reasons.length > 0 && (
        <CardText className="text-xs">
          {r.reasons.map((x) => t(`wellness.reasons.${x}`)).join(' · ')}
        </CardText>
      )}
      {r.level === 'low' && !entry?.sick && (
        <>
          <CardText className="text-warning text-sm">{t('wellness.lowHint')}</CardText>
          {canSwap && (
            <Button variant="outline" fullWidth onClick={() => void swapToEasy()}>
              {t('wellness.swapToEasy')}
            </Button>
          )}
        </>
      )}
      {r.level === 'unknown' && (
        <CardText className="text-xs">{t('wellness.checkinHint')}</CardText>
      )}
    </Card>
  )
}

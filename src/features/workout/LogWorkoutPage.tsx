import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Button,
  Card,
  CardText,
  Field,
  Input,
  MultiChoice,
  Page,
  PageHeader,
  Select,
  Textarea,
} from '@/ui'
import { getWorkout } from '@/data/repositories/workoutRepo'
import { addWorkoutLog } from '@/data/repositories/workoutLogRepo'
import type { Feeling, PainArea } from '@/data/entities'
import type { WorkoutType } from '@/domain/plan/types'
import { todayIso } from '@/domain/dates/dates'
import { cn } from '@/lib/cn'
import { workoutTitle } from './workoutText'
import type { TimerResult } from './TimerPage'
import { usePendingTrack } from '@/features/tracking/pendingTrackStore'
import { saveTrack } from '@/data/repositories/trackRepo'
import { db } from '@/data/db'
import { touch } from '@/data/repositories/helpers'
import { elevationGainM, splitsByKm } from '@/domain/geo/geo'
import { formatDistance } from '@/domain/units/units'
import { allShoes } from '@/data/repositories/shoeRepo'

const TYPES: WorkoutType[] = [
  'walk',
  'run_walk',
  'easy',
  'long',
  'tempo',
  'fartlek',
  'strength',
  'race',
]
const FEELINGS: Feeling[] = ['great', 'ok', 'hard', 'bad']
const PAINS: PainArea[] = [
  'foot',
  'achilles',
  'shin',
  'calf',
  'knee',
  'hip',
  'back',
  'chest',
  'other',
]

/** Запись тренировки: после таймера (данные приходят через state) или вручную. */
export default function LogWorkoutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const timerResult = (location.state as TimerResult | null) ?? null
  const workoutId = timerResult?.workoutId ?? params.get('workoutId')
  const workout = useLiveQuery(
    async () => (workoutId ? ((await getWorkout(workoutId)) ?? null) : null),
    [workoutId],
  )
  const shoes = useLiveQuery(async () => (await allShoes()).filter((s) => !s.retiredAt))
  const [shoeId, setShoeId] = useState<string | null | undefined>(undefined)
  const pending = usePendingTrack((s) => s.pending)
  const setPending = usePendingTrack((s) => s.setPending)

  const [date, setDate] = useState(todayIso())
  const [type, setType] = useState<WorkoutType | null>(null)
  const [minutes, setMinutes] = useState(
    timerResult
      ? String(Math.max(1, Math.round(timerResult.durationSec / 60)))
      : pending
        ? String(Math.max(1, Math.round(pending.movingSec / 60)))
        : '',
  )
  const [distance, setDistance] = useState(
    pending && pending.distanceM > 50
      ? (pending.distanceM / 1000).toFixed(2).replace('.', ',')
      : '',
  )
  const [rpe, setRpe] = useState<number | null>(null)
  const [feeling, setFeeling] = useState<Feeling | null>(null)
  const [pains, setPains] = useState<PainArea[]>([])
  const [note, setNote] = useState('')
  const [link, setLink] = useState(true)
  const [saving, setSaving] = useState(false)

  const effectiveType: WorkoutType = type ?? workout?.type ?? 'easy'
  const durationSec = timerResult?.durationSec ?? Math.round(Number(minutes || 0) * 60)
  const canSave = durationSec > 0 && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    const log = await addWorkoutLog({
      workoutId: link && workout ? workout.id : null,
      date: link && workout ? workout.date : date,
      type: effectiveType,
      source: timerResult ? 'timer' : 'manual',
      durationSec,
      distanceM: distance.trim() ? Math.round(Number(distance.replace(',', '.')) * 1000) : null,
      rpe,
      feeling,
      pains,
      note: note.trim(),
      completedSegments: timerResult?.completedSegments ?? null,
      startTime:
        pending?.startTime ??
        (timerResult ? new Date(Date.now() - timerResult.durationSec * 1000).toISOString() : null),
      elevationGainM: pending ? elevationGainM(pending.points) : null,
      shoeId: shoeId === undefined ? (shoes?.find((s) => s.isDefault)?.id ?? null) : shoeId,
      splits: pending ? splitsByKm(pending.points) : [],
    })
    if (pending && pending.points.length > 1) {
      const track = await saveTrack(log.id, pending.points)
      await db.workoutLogs.put(touch(log, { trackId: track.id }))
      setPending(null)
    }
    navigate(`/history/${log.id}`, { replace: true })
  }

  return (
    <Page className="space-y-4">
      <PageHeader title={timerResult ? t('log.title') : t('log.titleManual')} />

      {timerResult && (
        <Card>
          <CardText>
            {t('log.completedOf', {
              done: timerResult.completedSegments,
              total: timerResult.totalSegments,
            })}
          </CardText>
          {pending && pending.distanceM > 50 && (
            <CardText className="text-success">
              {t('log.gpsSaved', { distance: formatDistance(pending.distanceM, 'metric') })}
            </CardText>
          )}
        </Card>
      )}

      {workout && (
        <Card className="space-y-2">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="accent-accent size-5"
              checked={link}
              onChange={(e) => setLink(e.target.checked)}
            />
            <span>{t('log.linkedTo', { title: workoutTitle(workout, t) })}</span>
          </label>
        </Card>
      )}

      <Card className="space-y-4">
        {!(link && workout) && (
          <Field label={t('log.date')}>
            <Input
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        )}
        <Field label={t('log.type')}>
          <Select value={effectiveType} onChange={(e) => setType(e.target.value as WorkoutType)}>
            {TYPES.map((v) => (
              <option key={v} value={v}>
                {t(`workout.type.${v}`)}
              </option>
            ))}
          </Select>
        </Field>
        {!timerResult && (
          <Field label={`${t('log.duration')}, ${t('log.durationMin')}`}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </Field>
        )}
        {shoes && shoes.length > 0 && effectiveType !== 'strength' && (
          <Field label={t('log.shoe')}>
            <Select
              value={
                shoeId === undefined ? (shoes.find((s) => s.isDefault)?.id ?? '') : (shoeId ?? '')
              }
              onChange={(e) => setShoeId(e.target.value || null)}
            >
              <option value="">{t('log.noShoe')}</option>
              {shoes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t('log.distance')} hint={t('log.distanceHint')}>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="5,2"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          />
        </Field>
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">{t('log.rpe')}</p>
          <div role="radiogroup" aria-label={t('log.rpe')} className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rpe === n}
                onClick={() => setRpe(n)}
                className={cn(
                  'min-h-12 rounded-xl border font-semibold',
                  rpe === n ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface',
                )}
              >
                {n}
              </button>
            ))}
          </div>
          {rpe && <p className="text-muted mt-2 text-sm">{t(`workout.rpe.${rpe}`)}</p>}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">{t('log.feeling')}</p>
          <div className="grid grid-cols-4 gap-2">
            {FEELINGS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={feeling === f}
                onClick={() => setFeeling(f)}
                className={cn(
                  'min-h-12 rounded-xl border text-sm font-medium',
                  feeling === f ? 'border-accent bg-accent/10' : 'border-border bg-surface',
                )}
              >
                {t(`log.feelingOptions.${f}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">{t('log.pains')}</p>
          <MultiChoice<PainArea>
            compact
            ariaLabel={t('log.pains')}
            values={pains}
            onChange={setPains}
            options={PAINS.map((p) => ({ value: p, label: t(`log.painOptions.${p}`) }))}
          />
          {pains.includes('chest') && (
            <p className="text-danger mt-2 text-sm">{t('log.painWarning')}</p>
          )}
        </div>
        <Field label={`${t('log.note')} (${t('common.optional')})`}>
          <Textarea
            value={note}
            placeholder={t('log.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </Card>

      <Button size="lg" fullWidth disabled={!canSave} onClick={() => void save()}>
        {t('log.save')}
      </Button>
    </Page>
  )
}

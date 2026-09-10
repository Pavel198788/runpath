import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Play, Square } from 'lucide-react'
import { Button, Card, CardText, CardTitle, Page, PageHeader } from '@/ui'
import { getProfile, updateProfile } from '@/data/repositories/profileRepo'
import { saveGeneratedPlan } from '@/data/repositories/planRepo'
import { generatePlan, levelFromTest } from '@/domain/plan'
import { uuid } from '@/domain/ids/uuid'
import { formatDuration } from '@/domain/units/units'
import { useWakeLock } from '@/features/workout/useWakeLock'
import { cn } from '@/lib/cn'

/** Тест уровня: секундомер до 30 минут; в конце — «шёл» или «бежал» и пересборка плана. */
export default function LevelTestPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const profile = useLiveQuery(async () => (await getProfile()) ?? null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [finished, setFinished] = useState(false)
  const [mode, setMode] = useState<'walk' | 'run'>('run')
  const [rebuilding, setRebuilding] = useState(false)
  useWakeLock(startedAt !== null && !finished)

  useEffect(() => {
    if (startedAt === null || finished) return
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 500)
    return () => clearInterval(id)
  }, [startedAt, finished])

  if (profile === undefined) return <Page>{t('common.loading')}</Page>
  if (!profile) return <Page>{t('today.noPlanHint')}</Page>

  const minutes = Math.max(1, Math.round(elapsed / 60))
  const result = levelFromTest({ mode, minutes }, profile.activityLevel)

  const rebuild = async () => {
    setRebuilding(true)
    await updateProfile(profile.id, { activityLevel: result.level })
    const generated = generatePlan(
      {
        activityLevel: result.level,
        goal: profile.goal,
        walkMinutes: result.walkMinutes ?? 30,
        healthFlags: profile.healthFlags,
        birthYear: profile.birthYear,
        availableDays: profile.availableDays,
        targetDate: profile.targetDate,
      },
      { now: new Date(), idGen: uuid },
    )
    await saveGeneratedPlan(generated)
    navigate('/today', { replace: true })
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
      <PageHeader title={t('leveltest.title')} />
      <Card className="space-y-3">
        <CardText>{t('leveltest.hint')}</CardText>
        <p className="text-center font-mono text-6xl font-bold tabular-nums">
          {formatDuration(elapsed)}
        </p>
        {startedAt === null && (
          <Button size="lg" fullWidth onClick={() => setStartedAt(Date.now())}>
            <Play className="size-5" aria-hidden /> {t('run.start')}
          </Button>
        )}
        {startedAt !== null && !finished && (
          <Button size="lg" variant="danger" fullWidth onClick={() => setFinished(true)}>
            <Square className="size-5" aria-hidden /> {t('leveltest.stop')}
          </Button>
        )}
      </Card>
      {finished && (
        <Card className="space-y-3">
          <CardTitle>{t('leveltest.how')}</CardTitle>
          <div className="grid grid-cols-2 gap-2">
            {(['walk', 'run'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'min-h-12 rounded-xl border font-medium',
                  mode === m ? 'border-accent bg-accent/10' : 'border-border',
                )}
              >
                {t(`leveltest.mode.${m}`)}
              </button>
            ))}
          </div>
          <CardText>
            {t('leveltest.result', {
              minutes,
              level: t(`onboarding.level.options.${result.level}`),
            })}
          </CardText>
          {result.changed ? (
            <Button fullWidth disabled={rebuilding} onClick={() => void rebuild()}>
              {t('leveltest.rebuild')}
            </Button>
          ) : (
            <CardText className="text-success">{t('leveltest.same')}</CardText>
          )}
        </Card>
      )}
    </Page>
  )
}

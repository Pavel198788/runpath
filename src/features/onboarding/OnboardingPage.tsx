import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  CardText,
  CardTitle,
  ChoiceList,
  Field,
  Input,
  MultiChoice,
  Page,
  PageHeader,
  ProgressBar,
  Segmented,
} from '@/ui'
import type { ActivityLevel, Goal, HealthFlag, Sex, Weekday } from '@/data/entities'
import { createProfile, getProfile, updateProfile } from '@/data/repositories/profileRepo'
import { saveGeneratedPlan } from '@/data/repositories/planRepo'
import { generatePlan, type GeneratedPlan } from '@/domain/plan'
import { uuid } from '@/domain/ids/uuid'
import { longDate } from '@/features/workout/workoutText'

const STEPS = ['welcome', 'about', 'level', 'health', 'goal', 'days', 'summary'] as const
type Step = (typeof STEPS)[number]

interface Draft {
  disclaimer: boolean
  birthYear: string
  sex: Sex | null
  heightCm: string
  weightKg: string
  activityLevel: ActivityLevel | null
  walkMinutes: string
  healthFlags: HealthFlag[]
  goal: Goal | null
  targetDate: string
  availableDays: Weekday[]
  preferredTime: 'morning' | 'day' | 'evening' | null
}

const initial: Draft = {
  disclaimer: false,
  birthYear: '',
  sex: null,
  heightCm: '',
  weightKg: '',
  activityLevel: null,
  walkMinutes: '30',
  healthFlags: [],
  goal: null,
  targetDate: '',
  availableDays: [0, 2, 5],
  preferredTime: null,
}

const num = (s: string): number | null =>
  s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s)

/** Онбординг: 7 коротких шагов, в конце генерируем план и сохраняем профиль. */
export default function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState<Draft>(initial)
  const [generated, setGenerated] = useState<GeneratedPlan | null>(null)
  const [saving, setSaving] = useState(false)

  const step: Step = STEPS[stepIndex] ?? 'welcome'
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))

  const canContinue = (): boolean => {
    switch (step) {
      case 'welcome':
        return draft.disclaimer
      case 'level':
        return draft.activityLevel !== null
      case 'goal':
        return draft.goal !== null
      case 'days':
        return draft.availableDays.length >= 3
      default:
        return true
    }
  }

  const next = async () => {
    if (step === 'days') {
      // Строим план прямо здесь: это чистая функция, занимает миллисекунды.
      const plan = generatePlan(
        {
          activityLevel: draft.activityLevel ?? 'never_ran',
          goal: draft.goal ?? 'marathon',
          walkMinutes: num(draft.walkMinutes),
          healthFlags: draft.healthFlags,
          birthYear: num(draft.birthYear),
          availableDays: draft.availableDays,
          targetDate: draft.targetDate || null,
        },
        { now: new Date(), idGen: uuid },
      )
      setGenerated(plan)
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }

  const finish = async () => {
    if (!generated || saving) return
    setSaving(true)
    const now = new Date().toISOString()
    const data = {
      birthYear: num(draft.birthYear),
      sex: draft.sex,
      heightCm: num(draft.heightCm),
      weightKg: num(draft.weightKg),
      activityLevel: draft.activityLevel ?? 'never_ran',
      goal: draft.goal ?? 'marathon',
      targetDate: draft.targetDate || null,
      healthFlags: draft.healthFlags,
      availableDays: draft.availableDays,
      preferredTime: draft.preferredTime,
      weightGoal: 'none' as const,
      maxHr: null,
      disclaimerAcceptedAt: now,
      onboardingCompletedAt: now,
    }
    const existing = await getProfile()
    if (existing) await updateProfile(existing.id, data)
    else await createProfile(data)
    await saveGeneratedPlan(generated)
    navigate('/today', { replace: true })
  }

  const weekdays = t('weekday.short', { returnObjects: true }) as string[]

  return (
    <Page className="space-y-4">
      <PageHeader
        title={t('onboarding.title')}
        subtitle={t('onboarding.step', { n: stepIndex + 1, total: STEPS.length })}
      />
      <ProgressBar
        value={(stepIndex + 1) / STEPS.length}
        label={t('onboarding.step', { n: stepIndex + 1, total: STEPS.length })}
      />

      {step === 'welcome' && (
        <Card className="space-y-4">
          <CardTitle>{t('onboarding.welcome.title')}</CardTitle>
          <CardText>{t('onboarding.welcome.body')}</CardText>
          <div className="bg-surface-2 space-y-2 rounded-xl p-3 text-sm">
            <p className="font-medium">{t('disclaimer.title')}</p>
            <p className="text-muted">{t('disclaimer.body')}</p>
            <p className="text-danger">{t('disclaimer.redFlags')}</p>
          </div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="accent-accent mt-1 size-5"
              checked={draft.disclaimer}
              onChange={(e) => patch({ disclaimer: e.target.checked })}
            />
            <span className="text-sm">{t('onboarding.welcome.acceptDisclaimer')}</span>
          </label>
        </Card>
      )}

      {step === 'about' && (
        <Card className="space-y-4">
          <CardTitle>{t('onboarding.about.title')}</CardTitle>
          <CardText className="text-sm">{t('onboarding.about.hint')}</CardText>
          <Field label={t('onboarding.about.birthYear')}>
            <Input
              type="number"
              inputMode="numeric"
              min={1930}
              max={2012}
              value={draft.birthYear}
              onChange={(e) => patch({ birthYear: e.target.value })}
            />
          </Field>
          <Field label={t('onboarding.about.sex')}>
            <Segmented<Sex>
              ariaLabel={t('onboarding.about.sex')}
              value={draft.sex ?? ('' as Sex)}
              onChange={(sex) => patch({ sex })}
              options={[
                { value: 'male', label: t('onboarding.about.sexOptions.male') },
                { value: 'female', label: t('onboarding.about.sexOptions.female') },
                { value: 'other', label: t('onboarding.about.sexOptions.other') },
              ]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('onboarding.about.height')}>
              <Input
                type="number"
                inputMode="numeric"
                min={120}
                max={230}
                value={draft.heightCm}
                onChange={(e) => patch({ heightCm: e.target.value })}
              />
            </Field>
            <Field label={t('onboarding.about.weight')}>
              <Input
                type="number"
                inputMode="decimal"
                min={35}
                max={250}
                value={draft.weightKg}
                onChange={(e) => patch({ weightKg: e.target.value })}
              />
            </Field>
          </div>
        </Card>
      )}

      {step === 'level' && (
        <Card className="space-y-4">
          <CardTitle>{t('onboarding.level.title')}</CardTitle>
          <ChoiceList<ActivityLevel>
            ariaLabel={t('onboarding.level.title')}
            value={draft.activityLevel}
            onChange={(activityLevel) => patch({ activityLevel })}
            options={(['never_ran', 'walk_30', 'run_walk', 'run_5k', 'run_10k'] as const).map(
              (v) => ({
                value: v,
                label: t(`onboarding.level.options.${v}`),
              }),
            )}
          />
          {(draft.activityLevel === 'never_ran' || draft.activityLevel === 'walk_30') && (
            <Field
              label={t('onboarding.level.walkMinutes')}
              hint={t('onboarding.level.walkMinutesHint')}
            >
              <Input
                type="number"
                inputMode="numeric"
                min={5}
                max={180}
                value={draft.walkMinutes}
                onChange={(e) => patch({ walkMinutes: e.target.value })}
              />
            </Field>
          )}
        </Card>
      )}

      {step === 'health' && (
        <Card className="space-y-4">
          <CardTitle>{t('onboarding.health.title')}</CardTitle>
          <CardText className="text-sm">{t('onboarding.health.hint')}</CardText>
          <MultiChoice<HealthFlag>
            ariaLabel={t('onboarding.health.title')}
            values={draft.healthFlags}
            onChange={(healthFlags) => patch({ healthFlags })}
            options={(
              [
                'joints',
                'back',
                'cardio',
                'overweight',
                'pregnancy',
                'diabetes',
                'asthma',
                'other',
              ] as const
            ).map((v) => ({
              value: v,
              label: t(`onboarding.health.options.${v}`),
            }))}
          />
          {draft.healthFlags.length > 0 && (
            <p className="text-warning text-sm">{t('onboarding.health.seeDoctor')}</p>
          )}
        </Card>
      )}

      {step === 'goal' && (
        <Card className="space-y-4">
          <CardTitle>{t('onboarding.goal.title')}</CardTitle>
          <ChoiceList<Goal>
            ariaLabel={t('onboarding.goal.title')}
            value={draft.goal}
            onChange={(goal) => patch({ goal })}
            options={(['start_running', 'half_marathon', 'marathon'] as const).map((v) => ({
              value: v,
              label: t(`onboarding.goal.options.${v}`),
            }))}
          />
          <Field
            label={`${t('onboarding.goal.targetDate')} (${t('common.optional')})`}
            hint={t('onboarding.goal.targetDateHint')}
          >
            <Input
              type="date"
              value={draft.targetDate}
              onChange={(e) => patch({ targetDate: e.target.value })}
            />
          </Field>
        </Card>
      )}

      {step === 'days' && (
        <Card className="space-y-4">
          <CardTitle>{t('onboarding.days.title')}</CardTitle>
          <CardText className="text-sm">{t('onboarding.days.hint')}</CardText>
          <MultiChoice<`${Weekday}`>
            compact
            ariaLabel={t('onboarding.days.title')}
            values={draft.availableDays.map((d) => `${d}` as `${Weekday}`)}
            onChange={(vals) =>
              patch({ availableDays: vals.map((v) => Number(v) as Weekday).sort((a, b) => a - b) })
            }
            options={weekdays.map((label, i) => ({ value: `${i}` as `${Weekday}`, label }))}
          />
          {draft.availableDays.length < 3 && (
            <p className="text-danger text-sm">{t('onboarding.days.tooFew')}</p>
          )}
          <Field label={`${t('onboarding.days.preferredTime')} (${t('common.optional')})`}>
            <Segmented<'morning' | 'day' | 'evening'>
              ariaLabel={t('onboarding.days.preferredTime')}
              value={draft.preferredTime ?? ('' as 'morning')}
              onChange={(preferredTime) => patch({ preferredTime })}
              options={[
                { value: 'morning', label: t('onboarding.days.timeOptions.morning') },
                { value: 'day', label: t('onboarding.days.timeOptions.day') },
                { value: 'evening', label: t('onboarding.days.timeOptions.evening') },
              ]}
            />
          </Field>
        </Card>
      )}

      {step === 'summary' && generated && (
        <Card className="space-y-4">
          <CardTitle>{t('onboarding.summary.title')}</CardTitle>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <p className="text-lg font-semibold">
              {t('onboarding.summary.weeks', {
                weeks: t('common.weeks', { count: generated.plan.weeks.length }),
              })}
            </p>
            <p className="text-muted">
              {t('onboarding.summary.start', { date: longDate(generated.plan.startDate) })}
            </p>
            <p className="text-muted">
              {t('onboarding.summary.finish', { date: longDate(generated.plan.endDate) })}
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t('onboarding.summary.phases')}</p>
            <ol className="space-y-2">
              {generated.plan.phases.map((p) => (
                <li key={p.phase} className="bg-surface-2 rounded-xl px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t(`phase.${p.phase}`)}</span>
                    <span className="text-muted text-sm">
                      {t('common.weeks', { count: p.toWeek - p.fromWeek + 1 })}
                    </span>
                  </div>
                  <p className="text-muted text-sm">{t(`phase.hint.${p.phase}`)}</p>
                </li>
              ))}
            </ol>
          </div>
          {generated.plan.warnings.map((w) => (
            <p key={w} className="text-warning text-sm">
              {t(`plan.warnings.${w}`, { date: longDate(generated.plan.endDate) })}
            </p>
          ))}
        </Card>
      )}

      <div className="flex gap-2">
        {stepIndex > 0 && (
          <Button variant="secondary" onClick={() => setStepIndex((i) => i - 1)}>
            {t('common.back')}
          </Button>
        )}
        {step !== 'summary' ? (
          <Button fullWidth size="lg" disabled={!canContinue()} onClick={() => void next()}>
            {t('common.continue')}
          </Button>
        ) : (
          <Button fullWidth size="lg" disabled={saving} onClick={() => void finish()}>
            {saving ? t('onboarding.summary.building') : t('onboarding.summary.go')}
          </Button>
        )}
      </div>
    </Page>
  )
}

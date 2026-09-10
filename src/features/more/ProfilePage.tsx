import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { Button, Card, ChoiceList, Field, Input, Page, PageHeader, Segmented } from '@/ui'
import { getProfile, updateProfile } from '@/data/repositories/profileRepo'
import type { Sex, UserProfile } from '@/data/entities'

type Goal = 'lose' | 'maintain' | 'none'

/** Правка веса, роста, года рождения и цели по весу — то, что нужно для питания. */
export default function ProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const profile = useLiveQuery(async () => (await getProfile()) ?? null)

  if (profile === undefined) return <Page>{t('common.loading')}</Page>
  if (!profile) return <Page>{t('today.noPlanHint')}</Page>

  return (
    <Page className="space-y-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-muted flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t('common.back')}
      </button>
      <PageHeader title={t('profile.title')} />
      {/* key: при смене записи форма пересоздаётся с новыми начальными значениями */}
      <ProfileForm key={profile.id} profile={profile} />
    </Page>
  )
}

function ProfileForm({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(() => ({
    weightKg: profile.weightKg?.toString() ?? '',
    heightCm: profile.heightCm?.toString() ?? '',
    birthYear: profile.birthYear?.toString() ?? '',
    sex: profile.sex,
    weightGoal: (profile.weightGoal ?? 'none') as Goal,
  }))
  const [saved, setSaved] = useState(false)

  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
  const save = async () => {
    await updateProfile(profile.id, {
      weightKg: num(form.weightKg),
      heightCm: num(form.heightCm),
      birthYear: num(form.birthYear),
      sex: form.sex,
      weightGoal: form.weightGoal,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <Card className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('onboarding.about.weight')}>
          <Input
            type="number"
            inputMode="decimal"
            value={form.weightKg}
            onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
          />
        </Field>
        <Field label={t('onboarding.about.height')}>
          <Input
            type="number"
            inputMode="numeric"
            value={form.heightCm}
            onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
          />
        </Field>
      </div>
      <Field label={t('onboarding.about.birthYear')}>
        <Input
          type="number"
          inputMode="numeric"
          value={form.birthYear}
          onChange={(e) => setForm({ ...form, birthYear: e.target.value })}
        />
      </Field>
      <Field label={t('onboarding.about.sex')}>
        <Segmented<Sex>
          ariaLabel={t('onboarding.about.sex')}
          value={form.sex ?? ('' as Sex)}
          onChange={(sex) => setForm({ ...form, sex })}
          options={[
            { value: 'male', label: t('onboarding.about.sexOptions.male') },
            { value: 'female', label: t('onboarding.about.sexOptions.female') },
            { value: 'other', label: t('onboarding.about.sexOptions.other') },
          ]}
        />
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-medium">{t('profile.weightGoal')}</p>
        <ChoiceList<Goal>
          ariaLabel={t('profile.weightGoal')}
          value={form.weightGoal}
          onChange={(weightGoal) => setForm({ ...form, weightGoal })}
          options={(['none', 'maintain', 'lose'] as Goal[]).map((v) => ({
            value: v,
            label: t(`profile.weightGoalOptions.${v}`),
          }))}
        />
        <p className="text-muted mt-1 text-xs">{t('profile.weightGoalHint')}</p>
      </div>
      <Button fullWidth onClick={() => void save()}>
        {saved ? t('profile.saved') : t('common.save')}
      </Button>
    </Card>
  )
}

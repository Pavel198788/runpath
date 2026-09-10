import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, CardText, CardTitle, Field, Input, Page, PageHeader, Select } from '@/ui'
import {
  DISTANCES_M,
  estimateMaxHr,
  hrZones,
  marathonTargetPace,
  paceForTime,
  riegel,
  timeForDistance,
} from '@/domain/calc/calculators'
import { formatDuration, formatMinSec } from '@/domain/units/units'

/** «5:30» или «1:05:30» → секунды; NaN, если не разобрать. */
function parseTime(s: string): number {
  const parts = s
    .trim()
    .split(':')
    .map((p) => Number(p))
  if (parts.some((p) => Number.isNaN(p)) || parts.length === 0 || parts.length > 3) return NaN
  return parts.reduce((a, b) => a * 60 + b, 0)
}

export default function CalculatorsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [pace, setPace] = useState('7:00')
  const [dist, setDist] = useState('5k')
  const [time, setTime] = useState('35:00')
  const [knownDist, setKnownDist] = useState('5k')
  const [knownTime, setKnownTime] = useState('30:00')
  const [age, setAge] = useState('35')
  const [maxHr, setMaxHr] = useState('')

  const paceSec = parseTime(pace)
  const distM = DISTANCES_M[dist] ?? 5000
  const timeSec = parseTime(time)
  const knownSec = parseTime(knownTime)
  const knownM = DISTANCES_M[knownDist] ?? 5000
  const hrMax = Number(maxHr) || estimateMaxHr(Number(age) || 35)
  const marathon =
    Number.isFinite(knownSec) && knownSec > 0 ? marathonTargetPace(knownSec, knownM) : null

  const distOptions = Object.keys(DISTANCES_M).map((k) => (
    <option key={k} value={k}>
      {t(`calc.distances.${k}`)}
    </option>
  ))

  return (
    <Page className="space-y-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-muted flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t('common.back')}
      </button>
      <PageHeader title={t('calc.title')} />

      <Card className="space-y-3">
        <CardTitle>{t('calc.paceTime')}</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('calc.pace')}>
            <Input value={pace} onChange={(e) => setPace(e.target.value)} placeholder="6:30" />
          </Field>
          <Field label={t('calc.distance')}>
            <Select value={dist} onChange={(e) => setDist(e.target.value)}>
              {distOptions}
            </Select>
          </Field>
        </div>
        <CardText>
          {t('calc.time')}:{' '}
          <b>
            {Number.isFinite(paceSec) && paceSec > 0
              ? formatDuration(timeForDistance(paceSec, distM))
              : '—'}
          </b>
        </CardText>
        <Field label={`${t('calc.time')} (${t('calc.timeHint')})`}>
          <Input value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <CardText>
          {t('calc.pace')}:{' '}
          <b>
            {Number.isFinite(timeSec) && timeSec > 0
              ? formatMinSec(paceForTime(timeSec, distM))
              : '—'}
          </b>
        </CardText>
      </Card>

      <Card className="space-y-3">
        <CardTitle>{t('calc.riegel')}</CardTitle>
        <CardText className="text-sm">{t('calc.riegelHint')}</CardText>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('calc.known')}>
            <Select value={knownDist} onChange={(e) => setKnownDist(e.target.value)}>
              {distOptions}
            </Select>
          </Field>
          <Field label={t('calc.time')}>
            <Input value={knownTime} onChange={(e) => setKnownTime(e.target.value)} />
          </Field>
        </div>
        {Number.isFinite(knownSec) && knownSec > 0 && (
          <ul className="text-sm">
            {Object.entries(DISTANCES_M)
              .filter(([k]) => k !== knownDist)
              .map(([k, m]) => (
                <li key={k} className="flex justify-between py-1">
                  <span>{t(`calc.distances.${k}`)}</span>
                  <span className="font-mono">
                    {formatDuration(riegel(knownSec, knownM, m))} ·{' '}
                    {formatMinSec(paceForTime(riegel(knownSec, knownM, m), m))}/км
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <CardTitle>{t('calc.marathon')}</CardTitle>
        <CardText className="text-sm">{t('calc.marathonHint')}</CardText>
        {marathon && (
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="bg-surface-2 rounded-xl p-2">
              <div className="font-mono text-lg font-bold">{formatMinSec(marathon.pace)}</div>
              <div className="text-muted text-xs">{t('calc.target')}</div>
            </div>
            <div className="bg-surface-2 rounded-xl p-2">
              <div className="font-mono text-lg font-bold">
                {formatMinSec(marathon.firstHalfPace)}
              </div>
              <div className="text-muted text-xs">{t('calc.firstHalf')}</div>
            </div>
            <div className="bg-surface-2 rounded-xl p-2">
              <div className="font-mono text-lg font-bold">{formatDuration(marathon.finish)}</div>
              <div className="text-muted text-xs">{t('calc.finish')}</div>
            </div>
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <CardTitle>{t('calc.zones')}</CardTitle>
        <CardText className="text-sm">{t('calc.maxHrHint')}</CardText>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('onboarding.about.birthYear').replace('Год рождения', 'Возраст')}>
            <Input
              type="number"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </Field>
          <Field label={t('calc.maxHr')}>
            <Input
              type="number"
              inputMode="numeric"
              placeholder={String(hrMax)}
              value={maxHr}
              onChange={(e) => setMaxHr(e.target.value)}
            />
          </Field>
        </div>
        <ul className="text-sm">
          {hrZones(hrMax).map((z) => (
            <li key={z.zone} className="flex justify-between py-1">
              <span>
                {t('calc.zone', { n: z.zone })} · {t(`calc.zoneNames.${z.zone}`)}
              </span>
              <span className="font-mono">
                {z.from}–{z.to}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </Page>
  )
}

import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { Button, Card, CardText, Page, PageHeader, Stat } from '@/ui'
import { deleteWorkoutLog, getWorkoutLog } from '@/data/repositories/workoutLogRepo'
import {
  formatDistance,
  formatDuration,
  formatMinSec,
  paceSecondsPerUnit,
} from '@/domain/units/units'
import { longDate } from '@/features/workout/workoutText'

export default function LogDetailPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const log = useLiveQuery(async () => (await getWorkoutLog(id)) ?? null, [id])

  if (log === undefined) return <Page>{t('common.loading')}</Page>
  if (!log || log.deletedAt) return <Page>{t('common.notFound')}</Page>

  const remove = async () => {
    if (!window.confirm(t('history.deleteConfirm'))) return
    await deleteWorkoutLog(log.id)
    navigate('/history', { replace: true })
  }

  const pace = log.distanceM ? paceSecondsPerUnit(log.distanceM, log.durationSec, 'metric') : 0

  return (
    <Page className="space-y-4">
      <button
        type="button"
        onClick={() => navigate('/history')}
        className="text-muted flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t('history.title')}
      </button>
      <PageHeader
        title={t(`workout.type.${log.type}`)}
        subtitle={`${longDate(log.date)} · ${t(`history.source.${log.source}`)}`}
      />
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t('log.duration')} value={formatDuration(log.durationSec)} />
        <Stat
          label={t('common.km')}
          value={log.distanceM ? formatDistance(log.distanceM, 'metric').replace(' км', '') : '—'}
        />
        <Stat label="мин/км" value={pace ? formatMinSec(pace) : '—'} />
      </div>
      <Card className="space-y-2">
        {log.rpe && (
          <CardText>
            RPE {log.rpe} — {t(`workout.rpe.${log.rpe}`)}
          </CardText>
        )}
        {log.feeling && (
          <CardText>
            {t('log.feeling')}: {t(`log.feelingOptions.${log.feeling}`)}
          </CardText>
        )}
        {log.pains.length > 0 && (
          <CardText className="text-warning">
            {t('log.pains')} {log.pains.map((p) => t(`log.painOptions.${p}`)).join(', ')}
          </CardText>
        )}
        {log.note && <CardText>{log.note}</CardText>}
      </Card>
      <Button variant="ghost" onClick={() => void remove()}>
        {t('common.delete')}
      </Button>
    </Page>
  )
}

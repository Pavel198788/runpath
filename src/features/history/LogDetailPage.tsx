import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Download } from 'lucide-react'
import { Button, Card, CardText, CardTitle, Page, PageHeader, Stat } from '@/ui'
import { deleteWorkoutLog, getWorkoutLog } from '@/data/repositories/workoutLogRepo'
import { getTrack } from '@/data/repositories/trackRepo'
import {
  formatDistance,
  formatDuration,
  formatMinSec,
  paceSecondsPerUnit,
} from '@/domain/units/units'
import { toGpx } from '@/domain/import/gpxExport'
import { longDate } from '@/features/workout/workoutText'

const TrackMap = lazy(() => import('@/features/tracking/TrackMap'))

export default function LogDetailPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const log = useLiveQuery(async () => (await getWorkoutLog(id)) ?? null, [id])
  const track = useLiveQuery(
    async () => (log?.trackId ? ((await getTrack(log.trackId)) ?? null) : null),
    [log?.trackId],
  )

  if (log === undefined) return <Page>{t('common.loading')}</Page>
  if (!log || log.deletedAt) return <Page>{t('common.notFound')}</Page>

  const remove = async () => {
    if (!window.confirm(t('history.deleteConfirm'))) return
    await deleteWorkoutLog(log.id)
    navigate('/history', { replace: true })
  }

  const exportGpx = () => {
    if (!track) return
    const xml = toGpx({
      name: log.name ?? t(`workout.type.${log.type}`),
      startTime: log.startTime,
      points: track.points,
    })
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/gpx+xml' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `runpath-${log.date}.gpx`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const pace = log.distanceM ? paceSecondsPerUnit(log.distanceM, log.durationSec, 'metric') : 0
  const splits = log.splits.length ? log.splits : (track?.splits ?? [])
  const maxSplit = Math.max(...splits.map((s) => s.seconds / (s.meters / 1000)), 1)

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
        title={log.name ?? t(`workout.type.${log.type}`)}
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
      {(log.avgHr || log.elevationGainM) && (
        <div className="grid grid-cols-2 gap-2">
          {log.avgHr && <Stat label={t('gps.avgHr')} value={`${log.avgHr}`} />}
          {log.elevationGainM !== null && (
            <Stat label={t('gps.elevation')} value={`${log.elevationGainM} м`} />
          )}
        </div>
      )}

      {track && track.points.length > 1 && (
        <Card className="space-y-3">
          <CardTitle>{t('gps.map')}</CardTitle>
          <Suspense fallback={<div className="bg-surface-2 h-64 rounded-xl" />}>
            <TrackMap points={track.points} />
          </Suspense>
          <Button variant="outline" size="sm" onClick={exportGpx}>
            <Download className="size-4" aria-hidden /> {t('gps.exportGpx')}
          </Button>
        </Card>
      )}

      {log.timeInZones && log.timeInZones.some((z) => z > 0) && (
        <Card>
          <CardTitle className="mb-2">{t('gps.zones')}</CardTitle>
          <ol className="space-y-1">
            {log.timeInZones.map((sec, zone) =>
              zone === 0 ? null : (
                <li key={zone} className="flex items-center gap-2 text-sm">
                  <span className="text-muted w-8">{t('gps.zone', { n: zone })}</span>
                  <span className="bg-surface-2 h-5 flex-1 overflow-hidden rounded">
                    <span
                      className={
                        ['bg-info', 'bg-success', 'bg-warning', 'bg-accent', 'bg-danger'][
                          zone - 1
                        ]! + ' block h-full rounded'
                      }
                      style={{ width: `${(sec / Math.max(1, ...log.timeInZones!)) * 100}%` }}
                    />
                  </span>
                  <span className="w-14 text-right font-mono">{formatMinSec(sec)}</span>
                </li>
              ),
            )}
          </ol>
          {log.hrLoad !== null && (
            <CardText className="mt-2 text-xs">
              {t('gps.hrLoad')}: {log.hrLoad}
            </CardText>
          )}
        </Card>
      )}

      {splits.length > 0 && (
        <Card>
          <CardTitle className="mb-2">{t('gps.splits')}</CardTitle>
          <ol className="space-y-1">
            {splits.map((s) => {
              const pacePerKm = s.seconds / (s.meters / 1000)
              return (
                <li key={s.km} className="flex items-center gap-2 text-sm">
                  <span className="text-muted w-12">{t('gps.split', { n: s.km })}</span>
                  <span className="bg-surface-2 h-5 flex-1 overflow-hidden rounded">
                    <span
                      className="bg-accent block h-full rounded"
                      style={{ width: `${(pacePerKm / maxSplit) * 100}%` }}
                    />
                  </span>
                  <span className="w-14 text-right font-mono">{formatMinSec(pacePerKm)}</span>
                </li>
              )
            })}
          </ol>
        </Card>
      )}

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

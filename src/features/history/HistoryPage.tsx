import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight } from 'lucide-react'
import { Card, CardText, Page, PageHeader } from '@/ui'
import { allWorkoutLogs } from '@/data/repositories/workoutLogRepo'
import { formatDistance, formatDuration } from '@/domain/units/units'
import { humanDate } from '@/features/workout/workoutText'

export default function HistoryPage() {
  const { t } = useTranslation()
  const logs = useLiveQuery(allWorkoutLogs)

  return (
    <Page className="space-y-3">
      <PageHeader title={t('history.title')} />
      {logs && logs.length === 0 && (
        <Card>
          <CardText>{t('history.empty')}</CardText>
        </Card>
      )}
      {logs?.map((log) => (
        <Link
          key={log.id}
          to={`/history/${log.id}`}
          className="bg-surface flex items-center gap-3 rounded-xl border border-border px-3 py-3"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{t(`workout.type.${log.type}`)}</span>
            <span className="text-muted block text-sm">
              {humanDate(log.date, t)} · {formatDuration(log.durationSec)}
              {log.distanceM ? ` · ${formatDistance(log.distanceM, 'metric')}` : ''}
              {log.rpe ? ` · RPE ${log.rpe}` : ''}
            </span>
          </span>
          <ChevronRight className="text-muted size-5" aria-hidden />
        </Link>
      ))}
    </Page>
  )
}

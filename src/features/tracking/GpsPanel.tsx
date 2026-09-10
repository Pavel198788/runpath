import { useTranslation } from 'react-i18next'
import { Satellite } from 'lucide-react'
import { formatDistance, formatMinSec } from '@/domain/units/units'
import type { GpsState } from './useGpsTracker'
import { cn } from '@/lib/cn'

/** Компактная панель GPS: дистанция, темп, статус сигнала. */
export function GpsPanel({ gps }: { gps: GpsState }) {
  const { t } = useTranslation()
  const signal =
    gps.status === 'denied' || gps.status === 'unsupported'
      ? 'bad'
      : gps.status === 'acquiring' || (gps.accuracyM !== null && gps.accuracyM > 30)
        ? 'weak'
        : 'good'
  return (
    <div className="bg-surface-2 w-full max-w-sm rounded-xl p-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-2xl font-bold tabular-nums">
            {formatDistance(gps.distanceM, 'metric').replace(' км', '')}
          </div>
          <div className="text-muted text-xs">{t('gps.distance')}</div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums">
            {gps.currentPace ? formatMinSec(gps.currentPace) : '—'}
          </div>
          <div className="text-muted text-xs">{t('gps.pace')}</div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums">
            {gps.avgPace ? formatMinSec(gps.avgPace) : '—'}
          </div>
          <div className="text-muted text-xs">{t('gps.avgPace')}</div>
        </div>
      </div>
      <div
        className={cn(
          'mt-2 flex items-center justify-center gap-1 text-xs',
          signal === 'good' ? 'text-success' : signal === 'weak' ? 'text-warning' : 'text-danger',
        )}
      >
        <Satellite className="size-3.5" aria-hidden />
        {t(`gps.status.${gps.status}`)}
        {gps.accuracyM !== null && gps.status !== 'denied' && ` · ±${Math.round(gps.accuracyM)} м`}
      </div>
    </div>
  )
}

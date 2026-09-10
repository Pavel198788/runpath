import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight, Minus, X } from 'lucide-react'
import type { Workout } from '@/data/entities'
import { cn } from '@/lib/cn'
import { humanDate, minutesOf, workoutTitle } from '@/features/workout/workoutText'
import { formatDistance } from '@/domain/units/units'

const statusIcon = {
  planned: null,
  done: <Check className="text-success size-5" aria-hidden />,
  partial: <Minus className="text-warning size-5" aria-hidden />,
  skipped: <X className="text-muted size-5" aria-hidden />,
}

/** Строка тренировки в списках плана. */
export function WorkoutRow({ workout, showDate = true }: { workout: Workout; showDate?: boolean }) {
  const { t } = useTranslation()
  const isPast = workout.status !== 'planned'
  return (
    <Link
      to={`/workout/${workout.id}`}
      className={cn(
        'bg-surface flex items-center gap-3 rounded-xl border border-border px-3 py-3',
        workout.status === 'skipped' && 'opacity-60',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          workout.type === 'strength' ? 'bg-info/15 text-info' : 'bg-accent/15 text-accent',
        )}
      >
        {statusIcon[workout.status] ?? t(`workout.type.${workout.type}`).slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{workoutTitle(workout, t)}</span>
        <span className="text-muted block text-sm">
          {showDate && `${humanDate(workout.date, t)} · `}
          {t('workout.estimated', { minutes: minutesOf(workout.estimatedSeconds) })}
          {workout.targetDistanceM ? ` · ${formatDistance(workout.targetDistanceM, 'metric')}` : ''}
          {isPast && ` · ${t(`workout.status.${workout.status}`)}`}
        </span>
      </span>
      <ChevronRight className="text-muted size-5 shrink-0" aria-hidden />
    </Link>
  )
}

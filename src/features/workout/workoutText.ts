import { format, isToday, isTomorrow, isYesterday } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { TFunction } from 'i18next'
import type { SegmentKind, WorkoutType } from '@/domain/plan/types'
import { fromIsoDate } from '@/domain/dates/dates'

interface TitleSource {
  type: WorkoutType
  targetDistanceM: number | null
}

export function workoutTitle(w: TitleSource, t: TFunction): string {
  if (w.type === 'race' && w.targetDistanceM) {
    const key = `workout.race.${w.targetDistanceM}`
    const text = t(key)
    if (text !== key) return text
  }
  return t(`workout.type.${w.type}`)
}

export function workoutWhy(type: WorkoutType, t: TFunction): string {
  return t(`workout.why.${type}`)
}

export function segmentLabel(kind: SegmentKind, t: TFunction): string {
  return t(`segment.${kind}`)
}

/** «сегодня» / «завтра» / «пн, 14 сент.» */
export function humanDate(iso: string, t: TFunction): string {
  const d = fromIsoDate(iso)
  if (isToday(d)) return t('common.today')
  if (isTomorrow(d)) return t('common.tomorrow')
  if (isYesterday(d)) return t('common.yesterday')
  return format(d, 'EEEEEE, d MMM', { locale: ru })
}

export function longDate(iso: string): string {
  return format(fromIsoDate(iso), 'd MMMM yyyy', { locale: ru })
}

export function shortDate(iso: string): string {
  return format(fromIsoDate(iso), 'd MMM', { locale: ru })
}

export function minutesOf(seconds: number): number {
  return Math.round(seconds / 60)
}

/** Ключ и число для голосовой фразы сегмента: минуты, если делится на 60, иначе секунды. */
export function sayKeyFor(kind: SegmentKind, seconds: number): { key: string; count: number } {
  const wholeMinutes = seconds >= 60 && seconds % 60 === 0
  const useMinutes = wholeMinutes || seconds >= 120
  const count = useMinutes ? Math.round(seconds / 60) : seconds
  const unit = useMinutes ? 'min' : 'sec'
  // Для разминки/заминки/темпа/ОФП секундных вариантов нет — округляем до минут.
  const onlyMinutes: SegmentKind[] = ['warmup', 'cooldown', 'tempo', 'strength']
  if (onlyMinutes.includes(kind))
    return { key: `say.${kind}_min`, count: Math.max(1, Math.round(seconds / 60)) }
  return { key: `say.${kind}_${unit}`, count }
}

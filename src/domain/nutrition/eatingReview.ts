import type { DayKind } from './targets'

/** Быстрая отметка за день: как поел, без взвешивания еды. */
export type LightMark = 'normal' | 'little' | 'over'

export interface EatingDay {
  date: string
  mark: LightMark | null
  /** Что было в этот день по плану — недоедать в тяжёлые дни опаснее всего. */
  kind: DayKind
}

export type EatingVerdict =
  'no_data' | 'ok' | 'under_hard_days' | 'under_often' | 'over_often' | 'before_long'

export interface EatingReview {
  verdict: EatingVerdict
  little: number
  normal: number
  over: number
  filled: number
}

const HARD: DayKind[] = ['long', 'quality', 'race']

/**
 * Смысл быстрых отметок: не считать граммы, но видеть картину недели.
 * Регулярное «мало» на фоне растущих тренировок — это недовосстановление и риск для здоровья,
 * а «мало» накануне длительной почти всегда означает тяжёлую тренировку на пустом баке.
 */
export function reviewEating(days: EatingDay[], tomorrowKind: DayKind | null = null): EatingReview {
  const marks = days.map((d) => d.mark)
  const little = marks.filter((m) => m === 'little').length
  const normal = marks.filter((m) => m === 'normal').length
  const over = marks.filter((m) => m === 'over').length
  const filled = marks.filter((m) => m !== null).length

  const lastMark = days[days.length - 1]?.mark ?? null
  const littleOnHardDays = days.filter((d) => d.mark === 'little' && HARD.includes(d.kind)).length

  let verdict: EatingVerdict = 'ok'
  if (filled === 0) verdict = 'no_data'
  else if (lastMark === 'little' && tomorrowKind !== null && HARD.includes(tomorrowKind))
    verdict = 'before_long'
  else if (littleOnHardDays >= 2) verdict = 'under_hard_days'
  else if (little >= 3) verdict = 'under_often'
  else if (over >= 4) verdict = 'over_often'

  return { verdict, little, normal, over, filled }
}

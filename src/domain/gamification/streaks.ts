import { addDaysIso, mondayOf, toIsoDate } from '@/domain/dates/dates'

/**
 * Стрик — число недель подряд (до текущей включительно), в которые была хотя бы одна тренировка.
 * «Заморозка»: одна пустая неделя на каждые 4 недели стрика прощается — один пропуск не обнуляет серию.
 * Текущая незавершённая неделя без тренировок стрик не ломает.
 */
export interface StreakResult {
  weeks: number
  frozenUsed: number
  currentWeekDone: boolean
}

export function weeklyStreak(dates: string[], today: string): StreakResult {
  const set = new Set(dates)
  const thisMonday = toIsoDate(mondayOf(new Date(today)))
  const hasWeek = (monday: string) => {
    for (let i = 0; i < 7; i++) if (set.has(addDaysIso(monday, i))) return true
    return false
  }
  const currentWeekDone = hasWeek(thisMonday)
  let weeks = currentWeekDone ? 1 : 0
  let frozenUsed = 0
  const earliest = dates.length ? [...dates].sort()[0]! : thisMonday
  let monday = addDaysIso(thisMonday, -7)
  // Идём назад по неделям, пока не исчерпаем заморозки или не дойдём до первой записи.
  for (let guard = 0; guard < 520 && addDaysIso(monday, 6) >= earliest; guard++) {
    if (hasWeek(monday)) weeks++
    else {
      const allowed = Math.floor(weeks / 4)
      if (frozenUsed < allowed) frozenUsed++
      else break
    }
    monday = addDaysIso(monday, -7)
  }
  return { weeks, frozenUsed, currentWeekDone }
}

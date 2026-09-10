import { addDays, format, getDay, parseISO, startOfWeek } from 'date-fns'

/** Дата без времени в формате yyyy-MM-dd — так храним даты тренировок. */
export type IsoDate = string

export function toIsoDate(date: Date): IsoDate {
  return format(date, 'yyyy-MM-dd')
}

export function fromIsoDate(iso: IsoDate): Date {
  return parseISO(iso)
}

export function todayIso(now: Date = new Date()): IsoDate {
  return toIsoDate(now)
}

export function addDaysIso(iso: IsoDate, days: number): IsoDate {
  return toIsoDate(addDays(fromIsoDate(iso), days))
}

/** 0 = понедельник … 6 = воскресенье (date-fns считает с воскресенья). */
export function weekdayMondayBased(date: Date): number {
  return (getDay(date) + 6) % 7
}

/** Понедельник недели, в которую попадает дата. */
export function mondayOf(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

/** Ближайший понедельник, начиная с сегодняшнего дня (если сегодня понедельник — сегодня). */
export function nextMonday(now: Date = new Date()): Date {
  const wd = weekdayMondayBased(now)
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return wd === 0 ? base : addDays(base, 7 - wd)
}

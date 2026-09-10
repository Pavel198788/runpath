import { describe, expect, it } from 'vitest'
import { reviewEating, type EatingDay } from './eatingReview'

const day = (
  date: string,
  mark: EatingDay['mark'],
  kind: EatingDay['kind'] = 'easy',
): EatingDay => ({ date, mark, kind })

describe('быстрые отметки о еде', () => {
  it('без отметок — нечего показывать', () => {
    expect(reviewEating([day('2026-09-01', null)]).verdict).toBe('no_data')
  })

  it('нормальная неделя', () => {
    const week = ['01', '02', '03', '04', '05'].map((d) => day(`2026-09-${d}`, 'normal'))
    expect(reviewEating(week).verdict).toBe('ok')
  })

  it('мало ел в тяжёлые дни — предупреждаем', () => {
    const week = [
      day('2026-09-01', 'little', 'long'),
      day('2026-09-04', 'little', 'quality'),
      day('2026-09-05', 'normal'),
    ]
    expect(reviewEating(week).verdict).toBe('under_hard_days')
  })

  it('часто мало — риск недоедания', () => {
    const week = [
      day('2026-09-01', 'little'),
      day('2026-09-02', 'little'),
      day('2026-09-03', 'little'),
      day('2026-09-04', 'normal'),
    ]
    expect(reviewEating(week).verdict).toBe('under_often')
  })

  it('накануне длительной поел мало — отдельная подсказка', () => {
    const week = [day('2026-09-01', 'normal'), day('2026-09-02', 'little')]
    expect(reviewEating(week, 'long').verdict).toBe('before_long')
  })

  it('часто переедание — мягкая подсказка', () => {
    const week = ['01', '02', '03', '04'].map((d) => day(`2026-09-${d}`, 'over'))
    expect(reviewEating(week).verdict).toBe('over_often')
    expect(reviewEating(week).over).toBe(4)
  })
})

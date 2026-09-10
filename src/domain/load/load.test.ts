import { describe, expect, it } from 'vitest'
import { acwr, dailyLoads, monotony, sessionLoad, type LoadEntry } from './load'
import { addDaysIso } from '@/domain/dates/dates'

const entry = (date: string, min: number, rpe: number | null = 5): LoadEntry => ({
  date,
  durationSec: min * 60,
  rpe,
  type: 'easy',
})

describe('load', () => {
  it('sRPE = минуты × усилие, дефолт по типу', () => {
    expect(sessionLoad(entry('2026-09-01', 30, 6))).toBe(180)
    expect(sessionLoad(entry('2026-09-01', 30, null))).toBe(120)
  })

  it('дневные нагрузки заполняют пропуски нулями', () => {
    expect(dailyLoads([entry('2026-09-02', 10)], '2026-09-01', '2026-09-03')).toEqual([0, 50, 0])
  })

  it('ACWR требует 28 дней истории', () => {
    const today = '2026-09-28'
    const short = [entry('2026-09-20', 30), entry('2026-09-25', 30)]
    expect(acwr(short, today).zone).toBe('insufficient')
  })

  it('ACWR: ровная нагрузка ≈ 1 (безопасно), резкий рост — риск', () => {
    const today = '2026-09-28'
    const even: LoadEntry[] = []
    for (let i = 0; i < 28; i++) if (i % 2 === 0) even.push(entry(addDaysIso(today, -i), 30))
    const r = acwr(even, today)
    expect(r.zone).toBe('safe')
    expect(r.ratio).toBeGreaterThan(0.8)
    expect(r.ratio).toBeLessThan(1.3)

    const spike = [
      ...even,
      entry(addDaysIso(today, -1), 120, 8),
      entry(addDaysIso(today, -2), 120, 8),
    ]
    expect(acwr(spike, today).zone).toBe('risk')
  })

  it('монотонность', () => {
    expect(monotony([100, 100, 100, 100, 100, 100, 100])).toBe(Infinity)
    expect(monotony([100, 0, 100, 0, 100, 0, 0])).toBeLessThan(2)
    expect(monotony([1, 2, 3])).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { evaluateAchievements, levelOf } from './achievements'
import { weeklyStreak } from './streaks'
import { addDaysIso } from '@/domain/dates/dates'

describe('achievements', () => {
  it('открывает первые вехи и считает суммарные километры', () => {
    const logs = [
      {
        date: '2026-09-01',
        type: 'run_walk' as const,
        durationSec: 1800,
        distanceM: 3000,
        workoutId: null,
      },
      {
        date: '2026-09-05',
        type: 'easy' as const,
        durationSec: 1900,
        distanceM: 5000,
        workoutId: null,
      },
      {
        date: '2026-09-10',
        type: 'long' as const,
        durationSec: 5400,
        distanceM: 10000,
        workoutId: null,
      },
    ]
    const u = evaluateAchievements(logs, 0)
    const ids = u.map((x) => x.id)
    expect(ids).toContain('first_workout')
    expect(ids).toContain('first_30min_run')
    expect(ids).toContain('first_5k')
    expect(ids).toContain('first_10k')
    expect(ids).not.toContain('first_15k_long')
    expect(u.find((x) => x.id === 'first_5k')?.date).toBe('2026-09-05')
    expect(levelOf(u)).toBe('runner')
  })
  it('уровень без записей — ходок', () => {
    expect(levelOf([])).toBe('walker')
  })
})

describe('streaks', () => {
  const today = '2026-10-14' // среда, понедельник 12.10
  it('считает недели подряд', () => {
    const dates = ['2026-10-13', '2026-10-07', '2026-09-30', '2026-09-23']
    expect(weeklyStreak(dates, today).weeks).toBe(4)
  })
  it('одна пустая неделя после 4 недель прощается', () => {
    const dates = ['2026-10-13', '2026-09-30', '2026-09-23', '2026-09-16', '2026-09-09']
    const r = weeklyStreak(dates, today)
    // текущая + (пропуск 5–11.10 заморожен? стрик до пропуска = 1, заморозок 0) → ломается
    expect(r.weeks).toBe(1)
    const dates2 = [
      '2026-10-13',
      '2026-10-07',
      '2026-09-30',
      '2026-09-23',
      '2026-09-16',
      '2026-09-02',
    ]
    const r2 = weeklyStreak(dates2, today)
    expect(r2.weeks).toBe(6)
    expect(r2.frozenUsed).toBe(1)
  })
  it('текущая неделя без тренировок не ломает стрик', () => {
    const dates = [addDaysIso(today, -7), addDaysIso(today, -14)]
    expect(weeklyStreak(dates, today).weeks).toBe(2)
  })
})

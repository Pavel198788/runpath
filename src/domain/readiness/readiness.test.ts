import { describe, expect, it } from 'vitest'
import { readiness } from './readiness'

describe('readiness', () => {
  it('без данных — неизвестно', () => {
    expect(
      readiness({ sleepHours: null, stress: null, restingHr: null, baselineHr: null, sick: false })
        .level,
    ).toBe('unknown')
  })
  it('болезнь — низкая', () => {
    expect(
      readiness({ sleepHours: 8, stress: 1, restingHr: 50, baselineHr: 50, sick: true }).level,
    ).toBe('low')
  })
  it('хороший сон и спокойствие — высокая; недосып и высокий пульс — низкая', () => {
    expect(
      readiness({ sleepHours: 8, stress: 1, restingHr: 51, baselineHr: 50, sick: false }).level,
    ).toBe('high')
    const bad = readiness({ sleepHours: 5, stress: 5, restingHr: 62, baselineHr: 50, sick: false })
    expect(bad.level).toBe('low')
    expect(bad.reasons).toContain('elevated_hr')
  })
})

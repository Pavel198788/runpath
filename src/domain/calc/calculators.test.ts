import { describe, expect, it } from 'vitest'
import {
  estimateMaxHr,
  hrZones,
  marathonTargetPace,
  paceForTime,
  riegel,
  timeForDistance,
} from './calculators'

describe('калькуляторы', () => {
  it('темп ↔ время', () => {
    expect(timeForDistance(360, 10000)).toBe(3600)
    expect(paceForTime(3600, 10000)).toBe(360)
  })
  it('Ригель: 5 км за 30:00 → 10 км ≈ 62:30', () => {
    const t = riegel(1800, 5000, 10000)
    expect(t).toBeGreaterThan(3700)
    expect(t).toBeLessThan(3800)
  })
  it('зоны пульса и max HR', () => {
    expect(estimateMaxHr(40)).toBe(180)
    const z = hrZones(180)
    expect(z[1]).toEqual({ zone: 2, from: 108, to: 126 })
    expect(z).toHaveLength(5)
  })
  it('целевой темп марафона с запасом', () => {
    const r = marathonTargetPace(2 * 3600, 21097.5) // полумарафон за 2:00
    expect(r.finish).toBeGreaterThan(4 * 3600 + 10 * 60)
    expect(r.firstHalfPace).toBe(r.pace + 10)
  })
})

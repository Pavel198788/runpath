import { describe, expect, it } from 'vitest'
import {
  distanceInUnits,
  formatDistance,
  formatDuration,
  formatMinSec,
  paceSecondsPerUnit,
} from './units'

describe('units', () => {
  it('переводит метры в километры и мили', () => {
    expect(distanceInUnits(5000, 'metric')).toBe(5)
    expect(distanceInUnits(1609.344, 'imperial')).toBeCloseTo(1, 6)
  })

  it('считает темп на км и не делит на ноль', () => {
    expect(paceSecondsPerUnit(5000, 1500, 'metric')).toBe(300)
    expect(paceSecondsPerUnit(0, 1500, 'metric')).toBe(0)
    expect(paceSecondsPerUnit(5000, 0, 'metric')).toBe(0)
  })

  it('форматирует минуты и секунды', () => {
    expect(formatMinSec(330)).toBe('5:30')
    expect(formatMinSec(59.6)).toBe('1:00')
    expect(formatMinSec(-5)).toBe('0:00')
  })

  it('форматирует длительность с часами', () => {
    expect(formatDuration(3930)).toBe('1:05:30')
    expect(formatDuration(600)).toBe('10:00')
  })

  it('форматирует дистанцию с русской запятой', () => {
    expect(formatDistance(5200, 'metric')).toBe('5,2 км')
    expect(formatDistance(42195, 'metric', 3)).toBe('42,195 км')
    expect(formatDistance(1609.344, 'imperial')).toBe('1,0 мили')
  })
})

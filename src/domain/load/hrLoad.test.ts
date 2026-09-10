import { describe, expect, it } from 'vitest'
import { hrLoad, rpeFromAvgHr, timeInZones, zoneOf } from './hrLoad'

describe('нагрузка по пульсу', () => {
  it('зоны по % от максимума', () => {
    expect(zoneOf(100, 180)).toBe(1)
    expect(zoneOf(130, 180)).toBe(3)
    expect(zoneOf(170, 180)).toBe(5)
  })
  it('время в зонах и TRIMP', () => {
    const pts = []
    for (let t = 0; t <= 1800; t += 10) pts.push({ t, hr: t < 900 ? 120 : 150 }) // 15 мин зона 2, 15 мин зона 4 (max 180)
    const z = timeInZones(pts, 180)
    // Интервал относится к зоне конечной точки, поэтому 890 с в зоне 2 и 910 с в зоне 4.
    expect(z[2]).toBe(890)
    expect(z[4]).toBe(910)
    expect(hrLoad(z)).toBe(Math.round((890 / 60) * 4 + (910 / 60) * 8))
  })
  it('эквивалент RPE по среднему пульсу', () => {
    expect(rpeFromAvgHr(160, 180)).toBe(8)
    expect(rpeFromAvgHr(120, 180)).toBe(4)
  })
})

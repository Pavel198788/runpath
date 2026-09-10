import { describe, expect, it } from 'vitest'
import {
  avgPaceSecPerKm,
  currentPaceSecPerKm,
  elevationGainM,
  haversineM,
  splitsByKm,
  trackDistanceM,
  type TrackPoint,
} from './geo'
import { filterFix, isStationary, type FilterState } from './filter'
import { decodePolyline, encodePolyline } from './polyline'

/** Прямая на север: 1 м ≈ 0.000008993° широты. */
const DEG_PER_M = 1 / 111_195
function line(
  meters: number,
  stepM: number,
  speedMps: number,
  alt?: (i: number) => number,
): TrackPoint[] {
  const pts: TrackPoint[] = []
  for (let d = 0, i = 0; d <= meters; d += stepM, i++) {
    pts.push({
      lat: 55 + d * DEG_PER_M,
      lon: 37,
      t: d / speedMps,
      alt: alt ? alt(i) : null,
      acc: 5,
    })
  }
  return pts
}

describe('geo', () => {
  it('гаверсинус: 1 градус широты ≈ 111 км', () => {
    expect(haversineM(55, 37, 56, 37)).toBeCloseTo(111_195, -2)
  })

  it('дистанция и сплиты по километрам', () => {
    const pts = line(2500, 10, 3) // 3 м/с = 5:33/км
    expect(trackDistanceM(pts)).toBeCloseTo(2500, 0)
    const splits = splitsByKm(pts)
    expect(splits).toHaveLength(3)
    expect(splits[0]!.seconds).toBeCloseTo(333.3, 0)
    expect(splits[2]!.meters).toBeCloseTo(500, -1)
  })

  it('темп средний и текущий', () => {
    expect(avgPaceSecPerKm(5000, 1500)).toBe(300)
    const pts = line(600, 10, 2.5)
    expect(currentPaceSecPerKm(pts, 30)).toBeCloseTo(400, 0)
  })

  it('набор высоты игнорирует мелкий шум', () => {
    const noisy = line(1000, 10, 3, (i) => 100 + (i % 2) * 2)
    expect(elevationGainM(noisy)).toBe(0)
    const climb = line(1000, 10, 3, (i) => 100 + i * 0.5) // +50 м
    expect(elevationGainM(climb)).toBeGreaterThanOrEqual(40)
    expect(elevationGainM(climb)).toBeLessThanOrEqual(50)
  })

  it('полилиния кодируется и декодируется без потерь до 1e-5', () => {
    const coords: Array<[number, number]> = [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]
    const enc = encodePolyline(coords)
    expect(enc).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@')
    expect(decodePolyline(enc)).toEqual(coords)
  })
})

describe('gps filter', () => {
  it('отбрасывает неточные точки и невозможные скачки', () => {
    let state: FilterState | null = null
    const r1 = filterFix(state, { lat: 55, lon: 37, t: 0, alt: null, acc: 5 })
    state = r1.state
    expect(r1.point).not.toBeNull()
    expect(filterFix(state, { lat: 55.0001, lon: 37, t: 1, alt: null, acc: 80 }).point).toBeNull()
    // 100 м за 1 с — выброс
    expect(
      filterFix(state, { lat: 55 + 100 * DEG_PER_M, lon: 37, t: 1, alt: null, acc: 5 }).point,
    ).toBeNull()
  })

  it('сглаживает и не пишет точки, если стоим на месте', () => {
    let state: FilterState | null = null
    let accepted = 0
    for (let t = 0; t < 20; t++) {
      const jitter = (t % 2 ? 0.5 : -0.5) * DEG_PER_M
      const r = filterFix(state, { lat: 55 + jitter, lon: 37, t, alt: null, acc: 8 })
      state = r.state
      if (r.point) accepted++
    }
    expect(accepted).toBeLessThanOrEqual(2)
  })

  it('автопауза срабатывает при остановке', () => {
    const pts = line(300, 10, 3)
    const last = pts[pts.length - 1]!
    expect(isStationary(pts, last.t + 1)).toBe(false)
    expect(isStationary(pts, last.t + 7)).toBe(true)
  })
})

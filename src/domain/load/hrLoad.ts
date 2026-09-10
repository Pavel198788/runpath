/**
 * Нагрузка по пульсу. Когда есть пульс по точкам (часы), считаем время в зонах
 * и TRIMP по Эдвардсу (минуты в зоне × номер зоны). Чтобы сравнивать с sRPE
 * (минуты × усилие 1–10), умножаем на 2: зона 2 ≈ усилие 4, зона 4 ≈ усилие 8.
 */
export interface HrPoint {
  t: number
  hr: number | null
}

/** Границы зон в долях от максимального пульса. */
export const ZONE_BOUNDS = [0.5, 0.6, 0.7, 0.8, 0.9]

export function zoneOf(hr: number, maxHr: number): 0 | 1 | 2 | 3 | 4 | 5 {
  const p = hr / maxHr
  if (p < 0.5) return 0
  if (p < 0.6) return 1
  if (p < 0.7) return 2
  if (p < 0.8) return 3
  if (p < 0.9) return 4
  return 5
}

/** Секунды в каждой зоне [0..5]; зона 0 — ниже 50 % (разминка/ходьба). */
export function timeInZones(points: HrPoint[], maxHr: number): number[] {
  const zones = [0, 0, 0, 0, 0, 0]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const hr = b.hr ?? a.hr
    if (hr === null) continue
    const dt = Math.max(0, Math.min(60, b.t - a.t))
    zones[zoneOf(hr, maxHr)]! += dt
  }
  return zones.map((s) => Math.round(s))
}

/** Нагрузка по пульсу в единицах, сопоставимых с sRPE. */
export function hrLoad(zonesSec: number[]): number {
  let load = 0
  zonesSec.forEach((sec, zone) => {
    load += (sec / 60) * zone * 2
  })
  return Math.round(load)
}

/** Средний пульс в процентах от максимума → эквивалент RPE (для адаптации, когда ощущений нет). */
export function rpeFromAvgHr(avgHr: number, maxHr: number): number {
  const p = avgHr / maxHr
  if (p >= 0.92) return 9
  if (p >= 0.86) return 8
  if (p >= 0.8) return 7
  if (p >= 0.75) return 6
  if (p >= 0.7) return 5
  if (p >= 0.6) return 4
  return 3
}

export function estimateMaxHr(age: number): number {
  return Math.round(208 - 0.7 * age)
}

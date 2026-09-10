/** Беговые калькуляторы. Всё в секундах и метрах. */

export const DISTANCES_M: Record<string, number> = {
  '1k': 1000,
  '5k': 5000,
  '10k': 10000,
  half: 21097.5,
  marathon: 42195,
}

/** Время на дистанцию по темпу (сек/км). */
export function timeForDistance(paceSecPerKm: number, distanceM: number): number {
  return (paceSecPerKm * distanceM) / 1000
}

/** Темп (сек/км) по времени на дистанцию. */
export function paceForTime(totalSec: number, distanceM: number): number {
  return totalSec / (distanceM / 1000)
}

/**
 * Прогноз Ригеля: T2 = T1 × (D2/D1)^1.06.
 * Для новичков реальный результат обычно чуть хуже прогноза на длинных дистанциях — говорим это в UI.
 */
export function riegel(
  knownTimeSec: number,
  knownDistanceM: number,
  targetDistanceM: number,
  exponent = 1.06,
): number {
  return knownTimeSec * (targetDistanceM / knownDistanceM) ** exponent
}

export interface HrZone {
  zone: 1 | 2 | 3 | 4 | 5
  from: number
  to: number
}

/** Зоны по % от максимального пульса (простая схема, без пульса покоя). */
export function hrZones(maxHr: number): HrZone[] {
  const bounds: Array<[number, number]> = [
    [0.5, 0.6],
    [0.6, 0.7],
    [0.7, 0.8],
    [0.8, 0.9],
    [0.9, 1.0],
  ]
  return bounds.map(([a, b], i) => ({
    zone: (i + 1) as HrZone['zone'],
    from: Math.round(maxHr * a),
    to: Math.round(maxHr * b),
  }))
}

/** Оценка максимального пульса по возрасту (формула Танаки точнее, чем 220 − возраст). */
export function estimateMaxHr(age: number): number {
  return Math.round(208 - 0.7 * age)
}

/**
 * Целевой темп марафона по недавнему результату: прогноз Ригеля + запас 3 % для первого марафона.
 * Возвращает темп (сек/км) и рекомендуемый темп первой половины (на 10 с/км медленнее).
 */
export function marathonTargetPace(
  knownTimeSec: number,
  knownDistanceM: number,
): { pace: number; firstHalfPace: number; finish: number } {
  const finish = riegel(knownTimeSec, knownDistanceM, DISTANCES_M.marathon!) * 1.03
  const pace = paceForTime(finish, DISTANCES_M.marathon!)
  return { pace, firstHalfPace: pace + 10, finish }
}

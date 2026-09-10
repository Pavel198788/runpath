import { haversineM, type TrackPoint } from './geo'

/**
 * Фильтр GPS-шума: отбрасываем неточные точки и невозможные скачки,
 * а оставшиеся сглаживаем простым фильтром Калмана по дисперсии точности
 * (классический одномерный вариант для координат).
 */
export interface FilterOptions {
  /** Точки с точностью хуже (м) отбрасываем. */
  maxAccuracyM: number
  /** Скорость выше (м/с) считаем выбросом — 8 м/с ≈ 2:05 мин/км, быстрее бегун не бегает. */
  maxSpeedMps: number
  /** Минимальный сдвиг (м), чтобы записать точку — стоя на месте GPS «дрожит». */
  minMoveM: number
}

export const DEFAULT_FILTER: FilterOptions = { maxAccuracyM: 40, maxSpeedMps: 8, minMoveM: 2 }

export interface FilterState {
  lat: number
  lon: number
  /** Дисперсия оценки положения, м². */
  variance: number
  t: number
  lastAccepted: TrackPoint | null
}

export interface RawFix {
  lat: number
  lon: number
  t: number
  alt: number | null
  acc: number | null
}

/**
 * Обрабатывает новую точку. Возвращает новое состояние и точку для записи (или null, если отброшена).
 * Чистая функция — состояние передаётся снаружи, чтобы её можно было тестировать.
 */
export function filterFix(
  state: FilterState | null,
  fix: RawFix,
  opts: FilterOptions = DEFAULT_FILTER,
): { state: FilterState | null; point: TrackPoint | null } {
  const acc = fix.acc ?? 20
  if (acc > opts.maxAccuracyM) return { state, point: null }

  if (!state) {
    const point: TrackPoint = { lat: fix.lat, lon: fix.lon, t: fix.t, alt: fix.alt, acc }
    return {
      state: { lat: fix.lat, lon: fix.lon, variance: acc * acc, t: fix.t, lastAccepted: point },
      point,
    }
  }

  const dt = fix.t - state.t
  if (dt <= 0) return { state, point: null }

  // Проверка на невозможный скачок.
  const jump = haversineM(state.lat, state.lon, fix.lat, fix.lon)
  if (jump / dt > opts.maxSpeedMps) return { state, point: null }

  // Калман: дисперсия растёт со временем (человек движется до maxSpeed), затем сливаем с измерением.
  const grown = state.variance + dt * dt * (opts.maxSpeedMps / 4) ** 2
  const k = grown / (grown + acc * acc)
  const lat = state.lat + k * (fix.lat - state.lat)
  const lon = state.lon + k * (fix.lon - state.lon)
  const variance = (1 - k) * grown
  const next: FilterState = { lat, lon, variance, t: fix.t, lastAccepted: state.lastAccepted }

  const moved = state.lastAccepted
    ? haversineM(state.lastAccepted.lat, state.lastAccepted.lon, lat, lon)
    : Infinity
  if (moved < opts.minMoveM) return { state: next, point: null }

  const point: TrackPoint = { lat, lon, t: fix.t, alt: fix.alt, acc }
  return { state: { ...next, lastAccepted: point }, point }
}

/** Автопауза: стоим, если за последние windowSec прошли меньше minMove м. */
export function isStationary(
  points: TrackPoint[],
  nowT: number,
  windowSec = 6,
  minMoveM = 4,
): boolean {
  if (points.length === 0) return false
  const last = points[points.length - 1]!
  if (nowT - last.t >= windowSec) return true
  let i = points.length - 1
  while (i > 0 && nowT - points[i - 1]!.t <= windowSec) i--
  const first = points[i]!
  return (
    haversineM(first.lat, first.lon, last.lat, last.lon) < minMoveM && nowT - first.t >= windowSec
  )
}

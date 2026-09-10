/**
 * Преобразования единиц и форматирование темпа.
 * Внутри приложения всё хранится в метрах и секундах; мили — только для показа.
 */
export type UnitSystem = 'metric' | 'imperial'

export const METERS_PER_KM = 1000
export const METERS_PER_MILE = 1609.344

export function metersToKm(meters: number): number {
  return meters / METERS_PER_KM
}

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE
}

/** Дистанция в единицах пользователя (число, без округления). */
export function distanceInUnits(meters: number, units: UnitSystem): number {
  return units === 'metric' ? metersToKm(meters) : metersToMiles(meters)
}

/** Темп в секундах на километр (или на милю) из дистанции и времени. */
export function paceSecondsPerUnit(meters: number, seconds: number, units: UnitSystem): number {
  const distance = distanceInUnits(meters, units)
  if (distance <= 0 || seconds <= 0) return 0
  return seconds / distance
}

/** «5:30» из 330 секунд. Нужен и для темпа, и для длительности до часа. */
export function formatMinSec(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(s / 60)
  const seconds = s % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** «1:05:30» для длительностей от часа, иначе «5:30». */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(s / 3600)
  if (hours === 0) return formatMinSec(s)
  const rest = s % 3600
  const minutes = Math.floor(rest / 60)
  const seconds = rest % 60
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/** Дистанция для отображения: «5,2 км» / «3,2 мили» (русская запятая). */
export function formatDistance(meters: number, units: UnitSystem, digits = 1): string {
  const value = distanceInUnits(meters, units)
  const formatted = value.toFixed(digits).replace('.', ',')
  return `${formatted} ${units === 'metric' ? 'км' : 'мили'}`
}

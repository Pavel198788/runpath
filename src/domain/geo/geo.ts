/** Точка трека. Время — секунды от старта, высота и точность могут отсутствовать. */
export interface TrackPoint {
  lat: number
  lon: number
  /** Секунды от начала тренировки. */
  t: number
  alt: number | null
  /** Горизонтальная точность, м (из GPS). */
  acc: number | null
}

const EARTH_RADIUS_M = 6371008.8

/** Расстояние между двумя координатами по формуле гаверсинусов, м. */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Суммарная дистанция по точкам, м. */
export function trackDistanceM(points: TrackPoint[]): number {
  let d = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    d += haversineM(a.lat, a.lon, b.lat, b.lon)
  }
  return d
}

export interface Split {
  /** Номер километра (1, 2, …); последний может быть неполным. */
  km: number
  seconds: number
  /** Длина отрезка, м (1000, кроме последнего). */
  meters: number
}

/** Сплиты по километрам с линейной интерполяцией времени на границе. */
export function splitsByKm(points: TrackPoint[], splitM = 1000): Split[] {
  const splits: Split[] = []
  let dist = 0
  let splitStartT = points[0]?.t ?? 0
  let nextBoundary = splitM
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const seg = haversineM(a.lat, a.lon, b.lat, b.lon)
    while (seg > 0 && dist + seg >= nextBoundary) {
      const frac = (nextBoundary - dist) / seg
      const tAtBoundary = a.t + (b.t - a.t) * frac
      splits.push({ km: splits.length + 1, seconds: tAtBoundary - splitStartT, meters: splitM })
      splitStartT = tAtBoundary
      nextBoundary += splitM
    }
    dist += seg
  }
  const last = points[points.length - 1]
  const remaining = dist - splits.length * splitM
  if (last && remaining > 50) {
    splits.push({
      km: splits.length + 1,
      seconds: last.t - splitStartT,
      meters: Math.round(remaining),
    })
  }
  return splits
}

/**
 * Набор высоты, м. Высоту сглаживаем скользящим средним и учитываем только подъёмы
 * больше порога — иначе шум барометра/GPS даёт сотни «лишних» метров.
 */
export function elevationGainM(points: TrackPoint[], thresholdM = 3, window = 5): number {
  const alts = points.map((p) => p.alt).filter((a): a is number => a !== null)
  if (alts.length < 2) return 0
  const smooth: number[] = alts.map((_, i) => {
    const from = Math.max(0, i - window)
    const to = Math.min(alts.length, i + window + 1)
    const slice = alts.slice(from, to)
    return slice.reduce((s, v) => s + v, 0) / slice.length
  })
  let gain = 0
  let base = smooth[0]!
  for (const a of smooth) {
    if (a - base >= thresholdM) {
      gain += a - base
      base = a
    } else if (a < base) {
      base = a
    }
  }
  return Math.round(gain)
}

/** Средний темп, сек/км; 0, если данных нет. */
export function avgPaceSecPerKm(distanceM: number, seconds: number): number {
  if (distanceM < 1 || seconds <= 0) return 0
  return seconds / (distanceM / 1000)
}

/** Текущий темп по последним windowSec секундам трека. */
export function currentPaceSecPerKm(points: TrackPoint[], windowSec = 30): number {
  if (points.length < 2) return 0
  const last = points[points.length - 1]!
  let i = points.length - 1
  while (i > 0 && last.t - points[i - 1]!.t <= windowSec) i--
  const window = points.slice(i)
  const dist = trackDistanceM(window)
  const dt = last.t - window[0]!.t
  if (dist < 5 || dt <= 0) return 0
  return dt / (dist / 1000)
}

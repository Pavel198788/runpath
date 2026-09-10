import type { TrackPoint } from '@/domain/geo/geo'
import type { IsoDate } from '@/domain/dates/dates'

export type ImportSource = 'file' | 'strava' | 'apple_health'
export type Sport = 'running' | 'walking' | 'other'

/** Единый результат любого парсера — из него делаем запись в дневнике и трек. */
export interface ImportedActivity {
  /** Идентификатор в источнике (для защиты от дублей); null, если нет. */
  externalId: string | null
  source: ImportSource
  startTime: string | null
  date: IsoDate
  sport: Sport
  durationSec: number
  distanceM: number | null
  avgHr: number | null
  elevationGainM: number | null
  points: TrackPoint[]
  name: string | null
}

export function toIsoDateLocal(d: Date): IsoDate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function sportFromText(text: string | null | undefined): Sport {
  const s = (text ?? '').toLowerCase()
  if (s.includes('run') || s.includes('бег') || s.includes('jog')) return 'running'
  if (s.includes('walk') || s.includes('hik') || s.includes('ход')) return 'walking'
  return 'other'
}

import type { BaseEntity } from './base'
import type { Split, TrackPoint } from '@/domain/geo/geo'

/** GPS-трек тренировки. Хранится отдельно от записи: он большой и нужен не всегда. */
export interface Track extends BaseEntity {
  logId: string
  points: TrackPoint[]
  /** Сжатая линия для карт и синхронизации. */
  polyline: string
  distanceM: number
  splits: Split[]
}

import type { BaseEntity } from './base'
import type { WorkoutType } from '@/domain/plan/types'
import type { IntegrationSource } from '@/integrations/types'
import type { Split } from '@/domain/geo/geo'

export type Feeling = 'great' | 'ok' | 'hard' | 'bad'

/** Зоны боли — простой список; схема тела появится на A4. */
export type PainArea =
  'foot' | 'achilles' | 'shin' | 'calf' | 'knee' | 'hip' | 'back' | 'chest' | 'other'

/** Факт тренировки: то, что реально сделал человек. Append-only, не редактируем историю задним числом без нужды. */
export interface WorkoutLog extends BaseEntity {
  workoutId: string | null
  date: string
  type: WorkoutType
  source: IntegrationSource
  durationSec: number
  distanceM: number | null
  /** Шкала ощущений 1–10. */
  rpe: number | null
  feeling: Feeling | null
  pains: PainArea[]
  note: string
  /** Сколько сегментов таймера пройдено (для «частично»). */
  completedSegments: number | null
  /** Момент старта (ISO с временем), если известен. */
  startTime: string | null
  avgHr: number | null
  elevationGainM: number | null
  splits: Split[]
  /** Ссылка на GPS-трек (таблица tracks). */
  trackId: string | null
  /** Идентификатор в источнике импорта — защита от дублей. */
  externalId: string | null
  name: string | null
  /** Пара обуви (таблица shoes). */
  shoeId: string | null
}

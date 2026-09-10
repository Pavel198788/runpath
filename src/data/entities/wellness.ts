import type { BaseEntity } from './base'

/** Самочувствие за день. На A2 используем «болею», остальное — для индекса готовности (A4). */
export interface WellnessEntry extends BaseEntity {
  date: string
  sick: boolean
  sleepHours: number | null
  restingHr: number | null
  /** 1 (спокойно) … 5 (очень напряжённо). */
  stress: number | null
  note: string
}

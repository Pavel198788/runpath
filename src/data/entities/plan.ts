import type { BaseEntity } from './base'
import type { PlanCore, WorkoutCore } from '@/domain/plan/types'

/** План хранится целиком (недели внутри), тренировки — отдельной таблицей. */
export interface Plan extends BaseEntity, Omit<PlanCore, 'id'> {
  /** Активный план один; старые остаются для истории. */
  isActive: boolean
  /** Индекс последней недели, по которой уже принято решение об адаптации (−1 = ни одной). */
  lastEvaluatedWeekIndex: number
}

export interface Workout extends BaseEntity, Omit<WorkoutCore, 'id'> {
  /** Дата, на которую тренировку перенёс пользователь (исходная — в date). */
  movedFrom: string | null
}

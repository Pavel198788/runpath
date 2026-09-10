import type { BaseEntity } from './base'
import type { Adjustment } from '@/domain/plan/adapt'

export type AdjustmentStatus = 'proposed' | 'applied' | 'dismissed'

/** Предложенная/применённая корректировка плана — чтобы показать пользователю и не предлагать дважды. */
export interface PlanAdjustment extends BaseEntity, Adjustment {
  planId: string
  status: AdjustmentStatus
  decidedAt: string | null
}

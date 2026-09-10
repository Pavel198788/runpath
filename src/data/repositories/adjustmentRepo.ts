import { db } from '../db'
import type { PlanAdjustment } from '../entities'
import type { Adjustment } from '@/domain/plan/adapt'
import { touch, withMeta } from './helpers'

export async function proposedAdjustment(planId: string): Promise<PlanAdjustment | undefined> {
  return db.planAdjustments
    .where('planId')
    .equals(planId)
    .filter((a) => a.status === 'proposed' && a.deletedAt === null)
    .first()
}

export async function appliedAdjustments(planId: string): Promise<PlanAdjustment[]> {
  return db.planAdjustments
    .where('planId')
    .equals(planId)
    .filter((a) => a.status === 'applied' && a.deletedAt === null)
    .toArray()
}

export async function addProposal(planId: string, adj: Adjustment): Promise<PlanAdjustment> {
  const row = withMeta<PlanAdjustment>({ ...adj, planId, status: 'proposed', decidedAt: null })
  await db.planAdjustments.put(row)
  return row
}

export async function setAdjustmentStatus(
  id: string,
  status: PlanAdjustment['status'],
): Promise<void> {
  const row = await db.planAdjustments.get(id)
  if (row) await db.planAdjustments.put(touch(row, { status, decidedAt: new Date().toISOString() }))
}

import type { BaseEntity } from './base'

export interface Challenge extends BaseEntity {
  templateId: string
  name: string
  targetKm: number
  startDate: string
  endDate: string
  status: 'active' | 'done' | 'failed' | 'cancelled'
}

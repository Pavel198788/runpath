import type { BaseEntity } from './base'

export interface Shoe extends BaseEntity {
  name: string
  /** Пробег до добавления в приложение, м. */
  initialM: number
  retiredAt: string | null
  isDefault: boolean
}

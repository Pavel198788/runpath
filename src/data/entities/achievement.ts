import type { BaseEntity } from './base'
import type { AchievementId } from '@/domain/gamification/achievements'

/** Открытое достижение. Пересчитывается по журналу; храним, чтобы показать «новое» один раз. */
export interface Achievement extends BaseEntity {
  key: AchievementId
  unlockedOn: string
  seenAt: string | null
}

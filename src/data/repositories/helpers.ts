import type { BaseEntity, NewEntity } from '../entities/base'
import { uuid } from '@/domain/ids/uuid'

export function nowIso(): string {
  return new Date().toISOString()
}

/** Дополняет новую запись служебными полями. */
export function withMeta<T extends BaseEntity>(data: NewEntity<T>, id?: string): T {
  const now = nowIso()
  return {
    ...data,
    id: id ?? uuid(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncVersion: 0,
  } as T
}

/** Помечает запись изменённой (updatedAt обновляется всегда при записи). */
export function touch<T extends BaseEntity>(entity: T, patch: Partial<T>): T {
  return { ...entity, ...patch, updatedAt: nowIso() }
}

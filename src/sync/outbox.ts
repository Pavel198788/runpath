import { db } from '@/data/db'
import { SYNCED_COLLECTIONS, type OutboxItem, type SyncedCollection } from './types'

/**
 * Очередь исходящих изменений. Пишется хуком Dexie при любой записи в синхронизируемые таблицы,
 * поэтому репозиториям не нужно ничего знать о синхронизации.
 * Ключ = коллекция + id: повторные правки одной сущности не копятся, а обновляют запись.
 */
export function installOutboxHooks(): void {
  for (const name of SYNCED_COLLECTIONS) {
    const table = db.table(name)
    table.hook('creating', (_pk, obj) => {
      void enqueue(name, obj as { id?: string; updatedAt?: string })
    })
    table.hook('updating', (_mods, _pk, obj) => {
      void enqueue(name, obj as { id?: string; updatedAt?: string })
    })
  }
}

async function enqueue(
  collection: SyncedCollection,
  entity: { id?: string; updatedAt?: string },
): Promise<void> {
  if (!entity.id) return
  const item: OutboxItem = {
    key: `${collection}:${entity.id}`,
    collection,
    entityId: entity.id,
    updatedAt: entity.updatedAt ?? new Date().toISOString(),
    queuedAt: new Date().toISOString(),
  }
  try {
    await db.outbox.put(item)
  } catch {
    // Очередь не должна ломать основную запись данных.
  }
}

export async function outboxSize(): Promise<number> {
  return db.outbox.count()
}

export async function takeBatch(limit = 200): Promise<OutboxItem[]> {
  return db.outbox.limit(limit).toArray()
}

export async function clearItems(keys: string[]): Promise<void> {
  await db.outbox.bulkDelete(keys)
}

/** Полная перезаливка: ставим в очередь всё, что есть локально (после входа в аккаунт). */
export async function enqueueEverything(): Promise<number> {
  let total = 0
  for (const name of SYNCED_COLLECTIONS) {
    const rows = (await db.table(name).toArray()) as Array<{ id?: string; updatedAt?: string }>
    for (const row of rows) {
      await enqueue(name, row)
      total++
    }
  }
  return total
}

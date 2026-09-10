import Dexie, { type EntityTable } from 'dexie'
import type { Settings, UserProfile } from './entities'

/**
 * Локальная база (IndexedDB через Dexie). Единственный источник истины.
 *
 * ПРАВИЛА МИГРАЦИЙ (не ломать!):
 * - Никогда не редактировать уже выпущенную версию: только добавлять
 *   `this.version(N + 1).stores({...}).upgrade(...)`.
 * - В stores() перечисляются ТОЛЬКО индексы, а не все поля.
 * - У каждой таблицы обязательно индексы `updatedAt` и `deletedAt` —
 *   на них опирается синхронизация (этап B).
 */
export class RunPathDB extends Dexie {
  profiles!: EntityTable<UserProfile, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor(name = 'runpath') {
    super(name)

    this.version(1).stores({
      profiles: 'id, updatedAt, deletedAt',
      settings: 'id, updatedAt, deletedAt',
    })
  }
}

export const db = new RunPathDB()

/** Полностью стирает локальные данные (кнопка «Удалить все данные»). */
export async function wipeDatabase() {
  await db.delete()
  await db.open()
}

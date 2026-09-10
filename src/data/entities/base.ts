/**
 * Общие поля всех сущностей. Нужны для local-first синхронизации (этап B):
 * - id — UUID, генерируется на устройстве, конфликтов между устройствами нет;
 * - updatedAt — для разрешения конфликтов «последняя запись побеждает»;
 * - deletedAt — мягкое удаление, чтобы удаление доехало до других устройств;
 * - syncVersion — номер версии на сервере (0 = ещё не синхронизировано).
 * Даты храним как ISO-строки, чтобы они одинаково лежали в IndexedDB и JSON.
 */
export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  syncVersion: number
}

export type NewEntity<T extends BaseEntity> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncVersion'
>

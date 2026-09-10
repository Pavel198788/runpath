import { z } from 'zod'
import { db } from '../db'
import { APP_VERSION } from '@/config/app'

/**
 * Резервная копия всех данных одним JSON. Ключ ИИ и другие секреты не экспортируем.
 * Формат версионирован: при восстановлении проверяем схему и версию БД.
 */
export const BACKUP_FORMAT = 1

const TABLES = [
  'profiles',
  'settings',
  'plans',
  'workouts',
  'workoutLogs',
  'tracks',
  'wellness',
  'planAdjustments',
  'nutritionDays',
  'shoes',
  'achievements',
  'challenges',
  'aiConversations',
] as const

type TableName = (typeof TABLES)[number]

const BackupSchema = z.object({
  format: z.number().int(),
  app: z.string(),
  dbVersion: z.number(),
  exportedAt: z.string(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
})

export type Backup = z.infer<typeof BackupSchema>

export async function exportBackup(): Promise<Backup> {
  const tables: Backup['tables'] = {}
  for (const name of TABLES) {
    const table = db.table(name)
    const rows = (await table.toArray()) as Array<Record<string, unknown>>
    tables[name] = name === 'settings' ? rows.map((r) => ({ ...r, aiApiKey: null })) : rows
  }
  return {
    format: BACKUP_FORMAT,
    app: APP_VERSION,
    dbVersion: db.verno,
    exportedAt: new Date().toISOString(),
    tables,
  }
}

export function backupToBlob(b: Backup): Blob {
  return new Blob([JSON.stringify(b)], { type: 'application/json' })
}

/** Разбирает файл и проверяет формат. Бросает понятную ошибку. */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Это не JSON-файл')
  }
  const parsed = BackupSchema.safeParse(raw)
  if (!parsed.success) throw new Error('Файл не похож на резервную копию RunPath')
  if (parsed.data.format > BACKUP_FORMAT)
    throw new Error('Копия сделана более новой версией приложения')
  return parsed.data
}

/** Восстановление с полной заменой: текущие данные стираются. */
export async function restoreBackup(b: Backup): Promise<{ restored: number }> {
  let restored = 0
  const names = TABLES.filter((n) => b.tables[n])
  await db.transaction(
    'rw',
    names.map((n) => db.table(n)),
    async () => {
      for (const name of names) {
        const table = db.table(name as TableName)
        await table.clear()
        const rows = b.tables[name] ?? []
        if (rows.length) await table.bulkPut(rows)
        restored += rows.length
      }
    },
  )
  return { restored }
}

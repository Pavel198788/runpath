import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { exportBackup, parseBackup, restoreBackup } from './backup'
import { getSettings, updateSettings } from '../repositories/settingsRepo'
import { addWorkoutLog } from '../repositories/workoutLogRepo'

describe('backup', () => {
  beforeEach(async () => {
    await Promise.all([db.settings.clear(), db.workoutLogs.clear(), db.aiConversations.clear()])
  })

  it('экспорт → восстановление даёт те же записи, ключ ИИ не попадает в файл', async () => {
    await updateSettings({ units: 'imperial', aiApiKey: 'sk-secret' })
    await addWorkoutLog({
      workoutId: null,
      date: '2026-09-01',
      type: 'easy',
      source: 'manual',
      durationSec: 1800,
      distanceM: 4000,
      rpe: 4,
      feeling: 'ok',
      pains: [],
      note: 'тест',
      completedSegments: null,
    })
    const b = await exportBackup()
    expect(JSON.stringify(b)).not.toContain('sk-secret')
    expect(b.tables.workoutLogs).toHaveLength(1)

    await db.workoutLogs.clear()
    await updateSettings({ units: 'metric' })
    const text = JSON.stringify(b)
    const parsed = parseBackup(text)
    const { restored } = await restoreBackup(parsed)
    expect(restored).toBeGreaterThanOrEqual(2)
    expect((await getSettings()).units).toBe('imperial')
    expect((await getSettings()).aiApiKey).toBeNull()
    expect(await db.workoutLogs.count()).toBe(1)
  })

  it('отвергает чужие файлы', () => {
    expect(() => parseBackup('не json')).toThrow()
    expect(() => parseBackup('{"a":1}')).toThrow()
  })
})

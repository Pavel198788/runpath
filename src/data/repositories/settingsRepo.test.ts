import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { getSettings, updateSettings } from './settingsRepo'

describe('settingsRepo', () => {
  beforeEach(async () => {
    await db.settings.clear()
  })

  it('создаёт настройки с дефолтами при первом обращении', async () => {
    const s = await getSettings()
    expect(s.id).toBe('settings')
    expect(s.units).toBe('metric')
    expect(s.syncVersion).toBe(0)
    expect(s.deletedAt).toBeNull()
  })

  it('обновляет настройки и двигает updatedAt', async () => {
    const before = await getSettings()
    await new Promise((r) => setTimeout(r, 2))
    const after = await updateSettings({ units: 'imperial' })
    expect(after.units).toBe('imperial')
    expect(after.updatedAt > before.updatedAt).toBe(true)
  })
})

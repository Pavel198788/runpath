import { describe, expect, it } from 'vitest'
import { levelFromTest } from './levelTest'

describe('levelFromTest', () => {
  it('ходьба 20 минут — нужна фаза прогулок', () => {
    expect(levelFromTest({ mode: 'walk', minutes: 20 }, 'walk_30')).toMatchObject({
      level: 'never_ran',
      walkMinutes: 20,
      changed: true,
    })
  })
  it('бег 30 минут — уровень 5 км', () => {
    expect(levelFromTest({ mode: 'run', minutes: 30 }, 'never_ran').level).toBe('run_5k')
    expect(levelFromTest({ mode: 'run', minutes: 10 }, 'never_ran').level).toBe('run_walk')
    expect(levelFromTest({ mode: 'run', minutes: 3 }, 'never_ran').level).toBe('walk_30')
  })
  it('бегунов на 10 км не понижает', () => {
    expect(levelFromTest({ mode: 'run', minutes: 10 }, 'run_10k').changed).toBe(false)
  })
})

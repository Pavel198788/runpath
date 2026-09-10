import { describe, expect, it } from 'vitest'
import { pluralRu } from './plural'

describe('pluralRu', () => {
  const f: [string, string, string] = ['минута', 'минуты', 'минут']
  it('выбирает правильную форму', () => {
    expect(pluralRu(1, f)).toBe('минута')
    expect(pluralRu(2, f)).toBe('минуты')
    expect(pluralRu(5, f)).toBe('минут')
    expect(pluralRu(11, f)).toBe('минут')
    expect(pluralRu(21, f)).toBe('минута')
    expect(pluralRu(22, f)).toBe('минуты')
    expect(pluralRu(0, f)).toBe('минут')
  })
})

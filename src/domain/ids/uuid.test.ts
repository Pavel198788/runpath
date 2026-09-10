import { describe, expect, it } from 'vitest'
import { uuid } from './uuid'

describe('uuid', () => {
  it('возвращает уникальные UUID v4', () => {
    const a = uuid()
    const b = uuid()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

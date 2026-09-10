import { describe, expect, it } from 'vitest'
import { extractSuggestions } from './suggestions'

describe('extractSuggestions', () => {
  it('вырезает блок и парсит только валидные действия', () => {
    const text = `Сегодня лучше отдохнуть.
<suggestions>
[{"action":"skip_workout","workoutId":"w1","reason":"болезнь"},{"action":"explode","workoutId":"w2"},{"action":"move_workout","workoutId":"w3","date":"2026-10-01"}]
</suggestions>`
    const r = extractSuggestions(text)
    expect(r.text).toBe('Сегодня лучше отдохнуть.')
    expect(r.suggestions).toHaveLength(2)
    expect(r.suggestions[1]).toMatchObject({ action: 'move_workout', date: '2026-10-01' })
  })
  it('без блока — только текст', () => {
    expect(extractSuggestions('Привет').suggestions).toEqual([])
  })
})

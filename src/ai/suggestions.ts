import { z } from 'zod'
import { db } from '@/data/db'
import { moveWorkout, setWorkoutStatus } from '@/data/repositories/workoutRepo'
import { touch } from '@/data/repositories/helpers'
import { buildSegments } from '@/domain/plan/segments'
import { todayIso } from '@/domain/dates/dates'

/** Предложения ИИ — строго типизированы и проходят проверку правил перед применением. */
const SuggestionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('move_workout'),
    workoutId: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal('skip_workout'),
    workoutId: z.string(),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal('swap_to_easy'),
    workoutId: z.string(),
    reason: z.string().optional(),
  }),
])
export type Suggestion = z.infer<typeof SuggestionSchema>

/** Вырезает блок <suggestions> из ответа; возвращает чистый текст и список предложений. */
export function extractSuggestions(text: string): { text: string; suggestions: Suggestion[] } {
  const m = /<suggestions>([\s\S]*?)<\/suggestions>/.exec(text)
  if (!m) return { text, suggestions: [] }
  let suggestions: Suggestion[] = []
  try {
    const raw = JSON.parse(m[1]!.trim()) as unknown
    if (Array.isArray(raw))
      suggestions = raw
        .map((r) => SuggestionSchema.safeParse(r))
        .filter((r) => r.success)
        .map((r) => r.data)
  } catch {
    /* модель ошиблась в формате — просто не показываем предложений */
  }
  return { text: text.replace(m[0], '').trim(), suggestions }
}

export type SuggestionCheck =
  { ok: true } | { ok: false; reason: 'not_found' | 'not_planned' | 'past_date' | 'too_far' }

/** Проверка безопасных границ: тренировка существует и запланирована, дата не в прошлом и не дальше 14 дней. */
export async function checkSuggestion(s: Suggestion): Promise<SuggestionCheck> {
  const w = await db.workouts.get(s.workoutId)
  if (!w || w.deletedAt) return { ok: false, reason: 'not_found' }
  if (w.status !== 'planned') return { ok: false, reason: 'not_planned' }
  if (s.action === 'move_workout') {
    const today = todayIso()
    if (s.date < today) return { ok: false, reason: 'past_date' }
    const diff = (new Date(s.date).getTime() - new Date(w.date).getTime()) / 86_400_000
    if (Math.abs(diff) > 14) return { ok: false, reason: 'too_far' }
  }
  return { ok: true }
}

export async function applySuggestion(s: Suggestion): Promise<void> {
  const check = await checkSuggestion(s)
  if (!check.ok) return
  if (s.action === 'move_workout') await moveWorkout(s.workoutId, s.date)
  else if (s.action === 'skip_workout') await setWorkoutStatus(s.workoutId, 'skipped')
  else {
    const w = await db.workouts.get(s.workoutId)
    if (!w) return
    const segments = buildSegments('easy', Math.round(w.estimatedSeconds * 0.7))
    await db.workouts.put(
      touch(w, {
        type: 'easy',
        segments,
        estimatedSeconds: segments.reduce((a, x) => a + x.seconds, 0),
        targetDistanceM: w.targetDistanceM ? Math.round(w.targetDistanceM * 0.7) : null,
      }),
    )
  }
}

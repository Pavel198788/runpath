import { LESSONS } from '@content/index'

/** Урок недели: уроки текущей фазы (и общие) по порядку, по одному на неделю фазы. */
export function lessonOfWeek(phase: string | null, weekInPhase: number) {
  const pool = LESSONS.filter((l) => l.phase === 'any' || l.phase === phase).sort(
    (a, b) => a.order - b.order,
  )
  return pool[Math.min(Math.max(0, weekInPhase), pool.length - 1)] ?? LESSONS[0]
}

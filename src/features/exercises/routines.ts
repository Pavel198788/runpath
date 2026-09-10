/** Какой комплекс показывать: чередуем А и Б по неделям и по дням внутри недели. */
export function strengthRoutineFor(weekIndex: number, indexInWeek: number): string {
  return (weekIndex + indexInWeek) % 2 === 0 ? 'strength_a' : 'strength_b'
}

/** Разминка зависит от того, быстрая тренировка или лёгкая. */
export function warmupRoutineFor(type: string): string {
  return type === 'tempo' || type === 'fartlek' || type === 'race'
    ? 'warmup_quality'
    : 'warmup_basic'
}

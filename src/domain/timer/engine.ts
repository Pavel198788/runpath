import type { Segment } from '@/domain/plan/types'

/**
 * Движок таймера интервалов — чистая машина состояний без setInterval.
 * Всё считается от меток времени (мс), поэтому таймер не «уплывает», когда
 * браузер тормозит фоновые вкладки: при возврате мы просто пересчитываем.
 */
export interface TimerState {
  segments: Segment[]
  segmentIndex: number
  /** Момент старта текущего сегмента (мс) с учётом пауз. */
  segmentStartedAt: number
  pausedAt: number | null
  finished: boolean
  startedAt: number
  /** Сколько всего стояли на паузе (мс) — чтобы знать чистое время тренировки. */
  totalPausedMs: number
}

export interface TimerSnapshot {
  segment: Segment | null
  segmentIndex: number
  segmentElapsedSec: number
  segmentRemainingSec: number
  totalElapsedSec: number
  totalRemainingSec: number
  finished: boolean
  paused: boolean
}

export function createTimer(segments: Segment[], now: number): TimerState {
  return {
    segments,
    segmentIndex: 0,
    segmentStartedAt: now,
    pausedAt: null,
    finished: segments.length === 0,
    startedAt: now,
    totalPausedMs: 0,
  }
}

export function pause(state: TimerState, now: number): TimerState {
  if (state.pausedAt !== null || state.finished) return state
  return { ...state, pausedAt: now }
}

export function resume(state: TimerState, now: number): TimerState {
  if (state.pausedAt === null) return state
  const pausedFor = now - state.pausedAt
  return {
    ...state,
    pausedAt: null,
    segmentStartedAt: state.segmentStartedAt + pausedFor,
    totalPausedMs: state.totalPausedMs + pausedFor,
  }
}

/** Переход к следующему сегменту (по кнопке «пропустить» или по истечении времени). */
export function skip(state: TimerState, now: number): TimerState {
  if (state.finished) return state
  const next = state.segmentIndex + 1
  if (next >= state.segments.length) return { ...state, finished: true, pausedAt: null }
  return { ...state, segmentIndex: next, segmentStartedAt: now, pausedAt: null }
}

/**
 * Продвигает таймер до момента now: если сегмент(ы) закончились — переключает.
 * Возвращает новое состояние и число завершившихся сегментов (для голосовых подсказок).
 */
export function advance(state: TimerState, now: number): { state: TimerState; completed: number } {
  let s = state
  let completed = 0
  if (s.pausedAt !== null || s.finished) return { state: s, completed }
  for (;;) {
    const seg = s.segments[s.segmentIndex]
    if (!seg) return { state: { ...s, finished: true }, completed }
    const elapsedMs = now - s.segmentStartedAt
    if (elapsedMs < seg.seconds * 1000) return { state: s, completed }
    // Следующий сегмент начинается ровно в момент окончания предыдущего, а не «сейчас».
    const nextStart = s.segmentStartedAt + seg.seconds * 1000
    completed += 1
    const next = s.segmentIndex + 1
    if (next >= s.segments.length) return { state: { ...s, finished: true }, completed }
    s = { ...s, segmentIndex: next, segmentStartedAt: nextStart }
  }
}

export function snapshot(state: TimerState, now: number): TimerSnapshot {
  const effectiveNow = state.pausedAt ?? now
  const seg = state.segments[state.segmentIndex] ?? null
  const segmentElapsedSec =
    seg && !state.finished
      ? Math.min(seg.seconds, (effectiveNow - state.segmentStartedAt) / 1000)
      : 0
  const doneBefore = state.segments.slice(0, state.segmentIndex).reduce((a, s) => a + s.seconds, 0)
  const total = state.segments.reduce((a, s) => a + s.seconds, 0)
  const totalElapsedSec = state.finished ? total : doneBefore + segmentElapsedSec
  return {
    segment: state.finished ? null : seg,
    segmentIndex: state.segmentIndex,
    segmentElapsedSec,
    segmentRemainingSec: seg && !state.finished ? Math.max(0, seg.seconds - segmentElapsedSec) : 0,
    totalElapsedSec,
    totalRemainingSec: Math.max(0, total - totalElapsedSec),
    finished: state.finished,
    paused: state.pausedAt !== null,
  }
}

/** Чистое время тренировки (без пауз), сек. */
export function activeSeconds(state: TimerState, now: number): number {
  const end = state.pausedAt ?? now
  return Math.max(0, Math.round((end - state.startedAt - state.totalPausedMs) / 1000))
}

/** В какие секунды сегмента нужны напоминания «осталось …». */
export function reminderPoints(seg: Segment): number[] {
  const points: number[] = []
  // Каждые 5 минут для длинных отрезков, «осталось минута» и «осталось 10 секунд» для средних.
  for (let left = 300; left < seg.seconds; left += 300) points.push(seg.seconds - left)
  if (seg.seconds > 90) points.push(seg.seconds - 60)
  if (seg.seconds >= 30) points.push(seg.seconds - 10)
  return [...new Set(points)].filter((p) => p > 0).sort((a, b) => a - b)
}

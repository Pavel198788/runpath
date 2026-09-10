import { describe, expect, it } from 'vitest'
import {
  activeSeconds,
  advance,
  createTimer,
  pause,
  reminderPoints,
  resume,
  skip,
  snapshot,
} from './engine'
import type { Segment } from '@/domain/plan/types'

const segs: Segment[] = [
  { kind: 'warmup', seconds: 10, rpe: [2, 3] },
  { kind: 'run', seconds: 60, rpe: [3, 4] },
  { kind: 'walk', seconds: 30, rpe: [2, 3] },
]

describe('timer engine', () => {
  it('стартует с первого сегмента и считает оставшееся', () => {
    const t = createTimer(segs, 0)
    const snap = snapshot(t, 4000)
    expect(snap.segmentIndex).toBe(0)
    expect(snap.segmentRemainingSec).toBe(6)
    expect(snap.totalRemainingSec).toBe(96)
  })

  it('переключает сегменты по времени, даже если «проспали» несколько', () => {
    const t = createTimer(segs, 0)
    const { state, completed } = advance(t, 75_000) // 10 + 60 = 70 → третий сегмент 5 сек
    expect(state.segmentIndex).toBe(2)
    expect(completed).toBe(2)
    expect(snapshot(state, 75_000).segmentElapsedSec).toBe(5)
  })

  it('завершается после последнего сегмента', () => {
    const t = createTimer(segs, 0)
    const { state } = advance(t, 100_000)
    expect(state.finished).toBe(true)
    expect(snapshot(state, 100_000).totalRemainingSec).toBe(0)
  })

  it('пауза замораживает время и сдвигает старт сегмента', () => {
    let t = createTimer(segs, 0)
    t = pause(t, 5000)
    expect(snapshot(t, 20_000).segmentRemainingSec).toBe(5)
    t = resume(t, 20_000)
    expect(snapshot(t, 22_000).segmentRemainingSec).toBe(3)
    expect(activeSeconds(t, 22_000)).toBe(7)
    expect(advance(pause(t, 22_000), 99_000).state.segmentIndex).toBe(0)
  })

  it('пропуск переходит к следующему, в конце — завершает', () => {
    let t = createTimer(segs, 0)
    t = skip(t, 1000)
    expect(t.segmentIndex).toBe(1)
    t = skip(skip(t, 2000), 3000)
    expect(t.finished).toBe(true)
  })

  it('точки напоминаний', () => {
    expect(reminderPoints({ kind: 'run', seconds: 60, rpe: [3, 4] })).toEqual([50])
    expect(reminderPoints({ kind: 'run', seconds: 20, rpe: [3, 4] })).toEqual([])
    expect(reminderPoints({ kind: 'run', seconds: 720, rpe: [3, 4] })).toEqual([120, 420, 660, 710])
  })
})

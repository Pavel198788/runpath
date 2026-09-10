import type { Segment, WorkoutType } from './types'
import {
  BASE_WEEKS,
  COOLDOWN_SECONDS,
  STRENGTH_SECONDS,
  WARMUP_SECONDS,
  type BaseWeekTemplate,
} from './phases'

/** Собирает отрезки для тренировки данного типа и длительности (сек). */
export function buildSegments(type: WorkoutType, totalSeconds: number): Segment[] {
  switch (type) {
    case 'walk':
      return [{ kind: 'walk', seconds: totalSeconds, rpe: [2, 3] }]
    case 'strength':
      return [{ kind: 'strength', seconds: totalSeconds, rpe: [4, 6] }]
    case 'easy':
    case 'long':
    case 'race':
      return wrap([
        { kind: 'run', seconds: body(totalSeconds), rpe: type === 'race' ? [5, 7] : [3, 4] },
      ])
    case 'tempo': {
      // Разминка 10 мин, темповый блок ~40% (15–25 мин), заминка 10 мин.
      const warm = 600
      const cool = 600
      const tempo = clamp(Math.round((totalSeconds - warm - cool) * 0.6), 900, 1500)
      const easyRest = Math.max(0, totalSeconds - warm - cool - tempo)
      const segs: Segment[] = [{ kind: 'warmup', seconds: warm, rpe: [3, 4] }]
      segs.push({ kind: 'tempo', seconds: tempo, rpe: [6, 7] })
      if (easyRest >= 120) segs.push({ kind: 'run', seconds: easyRest, rpe: [3, 4] })
      segs.push({ kind: 'cooldown', seconds: cool, rpe: [2, 3] })
      return segs
    }
    case 'fartlek': {
      // 10 мин разминка, N × (1 мин быстро / 2 мин легко), заминка.
      const warm = 600
      const cool = 600
      const middle = Math.max(540, totalSeconds - warm - cool)
      const reps = clamp(Math.floor(middle / 180), 4, 8)
      const segs: Segment[] = [{ kind: 'warmup', seconds: warm, rpe: [3, 4] }]
      for (let i = 0; i < reps; i++) {
        segs.push({ kind: 'fast', seconds: 60, rpe: [7, 8] })
        segs.push({ kind: 'run', seconds: 120, rpe: [3, 4] })
      }
      const rest = middle - reps * 180
      if (rest >= 120) segs.push({ kind: 'run', seconds: rest, rpe: [3, 4] })
      segs.push({ kind: 'cooldown', seconds: cool, rpe: [2, 3] })
      return segs
    }
    case 'run_walk':
      throw new Error('run_walk строится через buildBaseSegments')
  }
}

/** Интервалы базовой фазы: разминка 5 мин ходьбы, блок, заминка 5 мин ходьбы. */
export function buildBaseSegments(template: BaseWeekTemplate): Segment[] {
  const block: Segment[] = []
  if (template.walk === 0) {
    block.push({ kind: 'run', seconds: template.run, rpe: [3, 4] })
  } else if (template.run === 1200) {
    // Неделя 9: 20 мин бег / 2 мин ходьба / 10 мин бег.
    block.push({ kind: 'run', seconds: 1200, rpe: [3, 4] })
    block.push({ kind: 'walk', seconds: 120, rpe: [2, 3] })
    block.push({ kind: 'run', seconds: 600, rpe: [3, 4] })
  } else {
    for (let i = 0; i < template.reps; i++) {
      block.push({ kind: 'run', seconds: template.run, rpe: [3, 4] })
      if (i < template.reps - 1) block.push({ kind: 'walk', seconds: template.walk, rpe: [2, 3] })
    }
  }
  return wrap(block)
}

export function baseTemplate(weekInBase: number): BaseWeekTemplate {
  return BASE_WEEKS[Math.min(weekInBase, BASE_WEEKS.length - 1)] as BaseWeekTemplate
}

export function strengthSegments(): Segment[] {
  return buildSegments('strength', STRENGTH_SECONDS)
}

export function totalSeconds(segments: Segment[]): number {
  return segments.reduce((s, seg) => s + seg.seconds, 0)
}

function wrap(block: Segment[]): Segment[] {
  return [
    { kind: 'warmup', seconds: WARMUP_SECONDS, rpe: [2, 3] },
    ...block,
    { kind: 'cooldown', seconds: COOLDOWN_SECONDS, rpe: [2, 3] },
  ]
}

/** Основная часть без разминки/заминки, не короче 5 минут. */
function body(total: number): number {
  return Math.max(300, total - WARMUP_SECONDS - COOLDOWN_SECONDS)
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

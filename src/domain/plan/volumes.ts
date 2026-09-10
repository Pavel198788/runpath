import type { PhaseSpec } from './phases'

/** Одна неделя «объёмной» фазы (k5 и дальше) до раскладки по дням. */
export interface VolumeWeek {
  volume: number
  longRun: number
  isRecovery: boolean
  isTaper: boolean
  hasQuality: boolean
  isRaceWeek: boolean
}

interface VolumeOptions {
  growth: number
  recoveryEvery: number
  /** Округление объёма (минуты до 5, км до 0,5) — считаем рост от округлённых значений. */
  round: (value: number) => number
}

/**
 * Считает объёмы недель фазы: плато на входе, рост ≤ growth, разгрузка каждую
 * recoveryEvery-ю неделю (−25%), тейпер в конце, длительная — по доле и с ограничением роста.
 */
export function buildVolumeWeeks(
  spec: PhaseSpec,
  startVolume: number,
  startLong: number,
  opts: VolumeOptions,
): VolumeWeek[] {
  const weeks: VolumeWeek[] = []
  const normalWeeks = spec.weeks - spec.taperWeeks
  const r = opts.round
  let lastNormalVolume = r(Math.min(startVolume, spec.peakVolume))
  let lastNormalLong = r(Math.min(startLong, spec.longCap))
  let peak = lastNormalVolume
  let atCapStep = false
  let maxLongSeen = lastNormalLong

  for (let i = 0; i < normalWeeks; i++) {
    const isRecovery = i > 0 && (i + 1) % opts.recoveryEvery === 0 && i !== normalWeeks - 1
    let volume: number
    let longRun: number
    if (i === 0) {
      // Плато: первая неделя фазы = последняя неделя предыдущей.
      volume = lastNormalVolume
      longRun = r(Math.min(lastNormalLong, spec.longShare * volume, spec.longCap))
    } else if (isRecovery) {
      volume = r(lastNormalVolume * 0.75)
      longRun = r(lastNormalLong * 0.65)
    } else {
      // Округляем вниз, чтобы округление не превращало +10% в +11%.
      volume = Math.min(roundDown(lastNormalVolume * (1 + opts.growth), r), spec.peakVolume)
      if (lastNormalLong >= spec.longCap - 1e-9) {
        // Потолок достигнут: чередуем «шаг назад» (80%) и максимальную, чтобы не бегать 32 км три недели подряд.
        longRun = r(spec.longCap * 0.8)
        atCapStep = !atCapStep
        if (!atCapStep) longRun = spec.longCap
      } else {
        longRun = Math.min(
          lastNormalLong + spec.longGrowthCap,
          spec.longShare * volume,
          spec.longCap,
        )
        // Длительная не должна уменьшаться на обычной неделе.
        longRun = roundDown(Math.max(longRun, Math.min(lastNormalLong, spec.longShare * volume)), r)
      }
    }
    if (!isRecovery) {
      lastNormalVolume = volume
      // После «шага назад» помним, что потолок уже был достигнут.
      lastNormalLong = Math.max(longRun, maxLongSeen >= spec.longCap - 1e-9 ? spec.longCap : 0)
      maxLongSeen = Math.max(maxLongSeen, longRun)
      peak = Math.max(peak, volume)
    }
    weeks.push({
      volume,
      longRun,
      isRecovery,
      isTaper: false,
      hasQuality: spec.quality !== 'none' && i + 1 >= spec.qualityFromWeek && !isRecovery,
      isRaceWeek: spec.taperWeeks === 0 && i === normalWeeks - 1 && spec.raceKm !== null,
    })
  }

  const taperFactors =
    spec.taperWeeks === 3 ? [0.8, 0.6, 0.4] : spec.taperWeeks === 2 ? [0.75, 0.5] : [0.7]
  for (let t = 0; t < spec.taperWeeks; t++) {
    const factor = taperFactors[t] ?? 0.5
    const volume = r(peak * factor)
    const isRaceWeek = t === spec.taperWeeks - 1 && spec.raceKm !== null
    weeks.push({
      volume,
      longRun: isRaceWeek
        ? (spec.raceKm ?? 0)
        : r(Math.min(maxLongSeen * factor, spec.longShare * volume)),
      isRecovery: false,
      isTaper: true,
      hasQuality: t === 0 && spec.quality !== 'none',
      isRaceWeek,
    })
  }
  return weeks
}

/** Округление «не вверх»: если округлённое значение больше исходного, берём шаг ниже. */
function roundDown(value: number, r: (v: number) => number): number {
  const rounded = r(value)
  if (rounded <= value + 1e-9) return rounded
  const step = r(value) - r(value - 1e-6) || 0.5
  return r(rounded - step)
}

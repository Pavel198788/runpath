/**
 * Выбор дней недели под тренировки. 0 = пн … 6 = вс.
 * Длительная — на последний доступный выходной (или последний доступный день),
 * остальные беговые дни — с максимальными промежутками между ними.
 */
export interface WeekSchedule {
  longDay: number
  qualityDay: number | null
  easyDays: number[]
  strengthDays: number[]
}

export function pickRunDays(available: number[], runDays: number): number[] {
  const days = [...new Set(available)].sort((a, b) => a - b)
  const n = Math.min(runDays, days.length)
  if (n === days.length) return days

  const weekend = days.filter((d) => d >= 5)
  const longDay = weekend.length
    ? (weekend[weekend.length - 1] as number)
    : (days[days.length - 1] as number)

  // Жадно добираем дни, каждый раз беря самый далёкий от уже выбранных (по кольцу недели).
  const chosen = [longDay]
  const circular = (a: number, b: number) => Math.min(Math.abs(a - b), 7 - Math.abs(a - b))
  while (chosen.length < n) {
    let best: number | null = null
    let bestDist = -1
    for (const d of days) {
      if (chosen.includes(d)) continue
      const dist = Math.min(...chosen.map((c) => circular(c, d)))
      if (dist > bestDist) {
        bestDist = dist
        best = d
      }
    }
    if (best === null) break
    chosen.push(best)
  }
  return chosen.sort((a, b) => a - b)
}

export function buildWeekSchedule(
  available: number[],
  runDays: number,
  withQuality: boolean,
  strengthCount = 2,
): WeekSchedule {
  const run = pickRunDays(available, runDays)
  const weekend = run.filter((d) => d >= 5)
  const longDay = weekend.length
    ? (weekend[weekend.length - 1] as number)
    : (run[run.length - 1] as number)
  const others = run.filter((d) => d !== longDay)

  // Качественная — подальше от длительной: берём день с максимальной дистанцией до longDay.
  let qualityDay: number | null = null
  if (withQuality && others.length > 0) {
    const circular = (a: number, b: number) => Math.min(Math.abs(a - b), 7 - Math.abs(a - b))
    qualityDay = others.reduce(
      (best, d) => (circular(d, longDay) > circular(best, longDay) ? d : best),
      others[0] as number,
    )
  }
  const easyDays = others.filter((d) => d !== qualityDay)

  // ОФП — на свободные доступные дни; если их нет, в дни лёгких пробежек (второй тренировкой).
  const free = [...new Set(available)].filter((d) => !run.includes(d)).sort((a, b) => a - b)
  const strengthDays = free.slice(0, strengthCount)
  if (strengthDays.length < strengthCount) {
    for (const d of easyDays) {
      if (strengthDays.length >= strengthCount) break
      if (!strengthDays.includes(d)) strengthDays.push(d)
    }
  }

  return { longDay, qualityDay, easyDays, strengthDays: strengthDays.sort((a, b) => a - b) }
}

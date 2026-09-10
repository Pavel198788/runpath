import { toIsoDateLocal, type ImportedActivity, type Sport } from './types'

/**
 * Apple Health export.xml бывает на гигабайты, поэтому читаем его кусками:
 * вызываем scanAppleHealthChunk для каждого куска, передавая «хвост» дальше.
 * Нужны только элементы <Workout …>, их атрибуты умещаются в одной строке.
 */
export interface ScanState {
  carry: string
  activities: ImportedActivity[]
}

export function createScanState(): ScanState {
  return { carry: '', activities: [] }
}

const WORKOUT_RE = /<Workout\s[^>]*?>/g

export function scanAppleHealthChunk(state: ScanState, chunk: string): ScanState {
  const text = state.carry + chunk
  let lastEnd = 0
  const found: ImportedActivity[] = []
  for (const m of text.matchAll(WORKOUT_RE)) {
    const act = parseWorkoutTag(m[0])
    if (act) found.push(act)
    lastEnd = m.index + m[0].length
  }
  // Хвост: всё после последнего полного тега, но не больше 4 КБ (незавершённый тег).
  const rest = text.slice(lastEnd)
  const cutAt = rest.lastIndexOf('<Workout')
  const carry = cutAt >= 0 ? rest.slice(cutAt) : rest.slice(-64)
  return { carry, activities: [...state.activities, ...found] }
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)
  return m ? m[1]! : null
}

function parseWorkoutTag(tag: string): ImportedActivity | null {
  const type = attr(tag, 'workoutActivityType') ?? ''
  const sport: Sport = type.includes('Running')
    ? 'running'
    : type.includes('Walking') || type.includes('Hiking')
      ? 'walking'
      : 'other'
  if (sport === 'other') return null
  const start = new Date(attr(tag, 'startDate') ?? '')
  if (Number.isNaN(start.getTime())) return null
  const durationRaw = Number(attr(tag, 'duration') ?? '0')
  const durationUnit = attr(tag, 'durationUnit') ?? 'min'
  const durationSec = Math.round(
    durationUnit === 'min'
      ? durationRaw * 60
      : durationUnit === 'hr'
        ? durationRaw * 3600
        : durationRaw,
  )
  const distRaw = Number(attr(tag, 'totalDistance') ?? '')
  const distUnit = attr(tag, 'totalDistanceUnit') ?? 'km'
  const distanceM =
    Number.isFinite(distRaw) && distRaw > 0
      ? Math.round(
          distUnit === 'mi' ? distRaw * 1609.344 : distUnit === 'm' ? distRaw : distRaw * 1000,
        )
      : null
  return {
    externalId: `apple-${start.toISOString()}`,
    source: 'apple_health',
    startTime: start.toISOString(),
    date: toIsoDateLocal(start),
    sport,
    durationSec,
    distanceM,
    avgHr: null,
    elevationGainM: null,
    points: [],
    name: null,
  }
}

import { sportFromText, toIsoDateLocal, type ImportedActivity } from './types'

/** Разбор CSV с кавычками и переносами строк внутри полей. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

/** activities.csv из архива Strava («Скачать данные»). Треков там нет — только сводка. */
export function parseStravaCsv(text: string): ImportedActivity[] {
  const rows = parseCsv(text)
  const header = rows[0]?.map((h) => h.trim()) ?? []
  const col = (name: string) => header.indexOf(name)
  const iId = col('Activity ID')
  const iDate = col('Activity Date')
  const iName = col('Activity Name')
  const iType = col('Activity Type')
  const iElapsed = col('Elapsed Time')
  const iMoving = col('Moving Time')
  const iDist = col('Distance')
  const iElev = col('Elevation Gain')
  const iHr = col('Average Heart Rate')
  if (iDate < 0 || iType < 0) throw new Error('Это не activities.csv из Strava')

  const out: ImportedActivity[] = []
  for (const r of rows.slice(1)) {
    const date = new Date(r[iDate] ?? '')
    if (Number.isNaN(date.getTime())) continue
    const moving = Number(r[iMoving] ?? '')
    const elapsed = Number(r[iElapsed] ?? '')
    const duration = Number.isFinite(moving) && moving > 0 ? moving : elapsed
    const distRaw = Number((r[iDist] ?? '').replace(',', '.'))
    // В экспорте дистанция в километрах (первая колонка Distance), иногда в метрах — различаем по величине.
    const distanceM =
      Number.isFinite(distRaw) && distRaw > 0
        ? Math.round(distRaw < 1000 ? distRaw * 1000 : distRaw)
        : null
    const elev = Number(r[iElev] ?? '')
    const hr = Number(r[iHr] ?? '')
    out.push({
      externalId: r[iId] ? `strava-${r[iId]}` : null,
      source: 'strava',
      startTime: date.toISOString(),
      date: toIsoDateLocal(date),
      sport: sportFromText(r[iType]),
      durationSec: Math.round(Number.isFinite(duration) ? duration : 0),
      distanceM,
      avgHr: Number.isFinite(hr) && hr > 0 ? Math.round(hr) : null,
      elevationGainM: Number.isFinite(elev) && elev > 0 ? Math.round(elev) : null,
      points: [],
      name: r[iName]?.trim() || null,
    })
  }
  return out
}

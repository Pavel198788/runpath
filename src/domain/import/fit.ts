import { elevationGainM, trackDistanceM, type TrackPoint } from '@/domain/geo/geo'
import { toIsoDateLocal, type ImportedActivity, type Sport } from './types'

/**
 * Минимальный парсер FIT (Garmin/Coros/Suunto/Polar экспортируют его).
 * Читаем только нужное: record (точки трека) и session (итоги). Developer-поля пропускаем.
 * Спецификация: заголовок файла → поток записей (definition / data, в т.ч. со сжатой меткой времени).
 */
const FIT_EPOCH_OFFSET = 631_065_600 // 1989-12-31T00:00:00Z в unix-секундах
const SEMICIRCLE = 180 / 2 ** 31

interface FieldDef {
  num: number
  size: number
  baseType: number
}
interface MsgDef {
  globalNum: number
  littleEndian: boolean
  fields: FieldDef[]
  devFieldBytes: number
}

const BASE_SIZE: Record<number, number> = {
  0x00: 1,
  0x01: 1,
  0x02: 1,
  0x83: 2,
  0x84: 2,
  0x85: 4,
  0x86: 4,
  0x07: 1,
  0x88: 4,
  0x89: 8,
  0x0a: 1,
  0x8b: 2,
  0x8c: 4,
  0x0d: 1,
  0x8e: 8,
  0x8f: 8,
  0x90: 8,
}

export function parseFit(buffer: ArrayBuffer): ImportedActivity[] {
  const view = new DataView(buffer)
  const headerSize = view.getUint8(0)
  const signature = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11),
  )
  if (signature !== '.FIT') throw new Error('Не FIT-файл')
  const dataSize = view.getUint32(4, true)
  const end = Math.min(buffer.byteLength, headerSize + dataSize)

  const defs = new Map<number, MsgDef>()
  const points: TrackPoint[] = []
  let session: Record<string, number> | null = null
  let lastTimestamp = 0
  let startTs: number | null = null

  let offset = headerSize
  while (offset < end) {
    const header = view.getUint8(offset++)
    const compressed = (header & 0x80) !== 0
    const localType = compressed ? (header >> 5) & 0x03 : header & 0x0f

    if (!compressed && header & 0x40) {
      // Definition message
      const littleEndian = view.getUint8(offset + 1) === 0
      const globalNum = littleEndian
        ? view.getUint16(offset + 2, true)
        : view.getUint16(offset + 2, false)
      const numFields = view.getUint8(offset + 4)
      offset += 5
      const fields: FieldDef[] = []
      for (let i = 0; i < numFields; i++) {
        fields.push({
          num: view.getUint8(offset),
          size: view.getUint8(offset + 1),
          baseType: view.getUint8(offset + 2),
        })
        offset += 3
      }
      let devFieldBytes = 0
      if (header & 0x20) {
        const numDev = view.getUint8(offset++)
        for (let i = 0; i < numDev; i++) {
          devFieldBytes += view.getUint8(offset + 1)
          offset += 3
        }
      }
      defs.set(localType, { globalNum, littleEndian, fields, devFieldBytes })
      continue
    }

    const def = defs.get(localType)
    if (!def) throw new Error('FIT: данные без определения сообщения')
    const values: Record<number, number> = {}
    for (const f of def.fields) {
      const v = readValue(view, offset, f, def.littleEndian)
      if (v !== null) values[f.num] = v
      offset += f.size
    }
    offset += def.devFieldBytes

    if (compressed) {
      const timeOffset = header & 0x1f
      lastTimestamp = (lastTimestamp & ~0x1f) | timeOffset
      if (timeOffset < (lastTimestamp & 0x1f)) lastTimestamp += 0x20
      values[253] = lastTimestamp
    } else if (values[253] !== undefined) {
      lastTimestamp = values[253]
    }

    if (def.globalNum === 20) {
      const ts = values[253]
      const lat = values[0]
      const lon = values[1]
      if (ts !== undefined && lat !== undefined && lon !== undefined) {
        if (startTs === null) startTs = ts
        const alt =
          values[78] !== undefined
            ? values[78] / 5 - 500
            : values[2] !== undefined
              ? values[2] / 5 - 500
              : null
        points.push({
          lat: lat * SEMICIRCLE,
          lon: lon * SEMICIRCLE,
          t: ts - startTs,
          alt,
          acc: null,
        })
      }
    } else if (def.globalNum === 18) {
      session = values
    }
  }

  const startUnix = (session?.[2] ?? startTs ?? lastTimestamp) + FIT_EPOCH_OFFSET
  const startTime = new Date(startUnix * 1000)
  const sport: Sport = session?.[5] === 1 ? 'running' : session?.[5] === 11 ? 'walking' : 'other'
  const duration =
    session?.[8] !== undefined
      ? session[8] / 1000
      : session?.[7] !== undefined
        ? session[7] / 1000
        : points.length
          ? points[points.length - 1]!.t
          : 0
  const distance =
    session?.[9] !== undefined ? session[9] / 100 : points.length ? trackDistanceM(points) : null

  return [
    {
      externalId: `fit-${startUnix}`,
      source: 'file',
      startTime: startTime.toISOString(),
      date: toIsoDateLocal(startTime),
      sport,
      durationSec: Math.round(duration),
      distanceM: distance !== null ? Math.round(distance) : null,
      avgHr: session?.[16] ?? null,
      elevationGainM: session?.[22] ?? (points.length ? elevationGainM(points) : null),
      points,
      name: null,
    },
  ]
}

/** Читает одно значение (первый элемент, если массив) и отбрасывает «невалидные» по спецификации. */
function readValue(view: DataView, offset: number, f: FieldDef, le: boolean): number | null {
  const size = BASE_SIZE[f.baseType] ?? 1
  if (offset + size > view.byteLength) return null
  switch (f.baseType) {
    case 0x00:
    case 0x02:
    case 0x0a:
    case 0x0d: {
      const v = view.getUint8(offset)
      return v === 0xff ? null : v
    }
    case 0x01: {
      const v = view.getInt8(offset)
      return v === 0x7f ? null : v
    }
    case 0x83: {
      const v = view.getInt16(offset, le)
      return v === 0x7fff ? null : v
    }
    case 0x84:
    case 0x8b: {
      const v = view.getUint16(offset, le)
      return v === 0xffff ? null : v
    }
    case 0x85: {
      const v = view.getInt32(offset, le)
      return v === 0x7fffffff ? null : v
    }
    case 0x86:
    case 0x8c: {
      const v = view.getUint32(offset, le)
      return v === 0xffffffff ? null : v
    }
    case 0x88:
      return view.getFloat32(offset, le)
    case 0x89:
      return view.getFloat64(offset, le)
    default:
      return null
  }
}

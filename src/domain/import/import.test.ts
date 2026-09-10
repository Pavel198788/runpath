import { describe, expect, it } from 'vitest'
import { parseGpx } from './gpx'
import { parseTcx } from './tcx'
import { parseFit } from './fit'
import { parseCsv, parseStravaCsv } from './stravaCsv'
import { createScanState, scanAppleHealthChunk } from './appleHealth'
import { toGpx } from './gpxExport'

const GPX = `<?xml version="1.0"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<trk><name>Утренняя</name><type>running</type><trkseg>
<trkpt lat="55.0000" lon="37.0000"><ele>100</ele><time>2026-09-01T06:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>120</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
<trkpt lat="55.0090" lon="37.0000"><ele>110</ele><time>2026-09-01T06:05:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
<trkpt lat="55.0180" lon="37.0000"><ele>120</ele><time>2026-09-01T06:10:00Z</time></trkpt>
</trkseg></trk></gpx>`

describe('parseGpx', () => {
  it('читает точки, время, дистанцию, пульс и набор высоты', () => {
    const [a] = parseGpx(GPX)
    expect(a).toBeDefined()
    expect(a!.name).toBe('Утренняя')
    expect(a!.sport).toBe('running')
    expect(a!.durationSec).toBe(600)
    expect(a!.distanceM).toBeGreaterThan(1900)
    expect(a!.distanceM).toBeLessThan(2100)
    expect(a!.avgHr).toBe(130)
    expect(a!.points).toHaveLength(3)
    expect(a!.points[2]!.t).toBe(600)
    expect(a!.date).toBe('2026-09-01')
  })

  it('ругается на мусор', () => {
    expect(() => parseGpx('<gpx><trk>')).toThrow()
  })

  it('экспорт в GPX читается обратно', () => {
    const [a] = parseGpx(GPX)
    const xml = toGpx({ name: 'Тест', startTime: a!.startTime, points: a!.points })
    const [b] = parseGpx(xml)
    expect(b!.points).toHaveLength(3)
    expect(b!.durationSec).toBe(600)
  })
})

const TCX = `<?xml version="1.0"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
<Activities><Activity Sport="Running"><Id>2026-09-02T07:00:00Z</Id>
<Lap StartTime="2026-09-02T07:00:00Z"><TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters>
<Track>
<Trackpoint><Time>2026-09-02T07:00:00Z</Time><Position><LatitudeDegrees>55</LatitudeDegrees><LongitudeDegrees>37</LongitudeDegrees></Position><AltitudeMeters>100</AltitudeMeters><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>
<Trackpoint><Time>2026-09-02T07:30:00Z</Time><Position><LatitudeDegrees>55.04</LatitudeDegrees><LongitudeDegrees>37</LongitudeDegrees></Position><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint>
</Track></Lap></Activity></Activities></TrainingCenterDatabase>`

describe('parseTcx', () => {
  it('берёт итоги из Lap и точки из Track', () => {
    const [a] = parseTcx(TCX)
    expect(a!.sport).toBe('running')
    expect(a!.durationSec).toBe(1800)
    expect(a!.distanceM).toBe(5000)
    expect(a!.avgHr).toBe(140)
    expect(a!.points).toHaveLength(2)
    expect(a!.externalId).toBe('2026-09-02T07:00:00Z')
  })
})

/** Собираем маленький FIT-файл: definition+data для session (18) и двух record (20). */
function buildFit(): ArrayBuffer {
  const bytes: number[] = []
  const u8 = (v: number) => bytes.push(v & 0xff)
  const u16 = (v: number) => {
    u8(v)
    u8(v >> 8)
  }
  const u32 = (v: number) => {
    u16(v & 0xffff)
    u16(v >>> 16)
  }
  const s32 = (v: number) => u32(v >>> 0)

  // record definition: local 0, fields: 253 ts u32, 0 lat s32, 1 lon s32, 3 hr u8, 5 dist u32
  u8(0x40)
  u8(0)
  u8(0)
  u16(20)
  u8(5)
  u8(253)
  u8(4)
  u8(0x86)
  u8(0)
  u8(4)
  u8(0x85)
  u8(1)
  u8(4)
  u8(0x85)
  u8(3)
  u8(1)
  u8(0x02)
  u8(5)
  u8(4)
  u8(0x86)
  const ts0 = 1_000_000_000 // FIT-секунды
  const lat = Math.round(55 / (180 / 2 ** 31))
  const lon = Math.round(37 / (180 / 2 ** 31))
  u8(0x00)
  u32(ts0)
  s32(lat)
  s32(lon)
  u8(130)
  u32(0)
  u8(0x00)
  u32(ts0 + 600)
  s32(lat + Math.round(0.009 / (180 / 2 ** 31)))
  s32(lon)
  u8(150)
  u32(100_000)
  // session definition: local 1: 253 ts, 2 start_time u32, 5 sport enum, 8 total_timer_time u32, 9 total_distance u32, 16 avg_hr u8
  u8(0x41)
  u8(0)
  u8(0)
  u16(18)
  u8(6)
  u8(253)
  u8(4)
  u8(0x86)
  u8(2)
  u8(4)
  u8(0x86)
  u8(5)
  u8(1)
  u8(0x00)
  u8(8)
  u8(4)
  u8(0x86)
  u8(9)
  u8(4)
  u8(0x86)
  u8(16)
  u8(1)
  u8(0x02)
  u8(0x01)
  u32(ts0 + 600)
  u32(ts0)
  u8(1)
  u32(600_000)
  u32(100_000)
  u8(140)

  const header = [14, 0x10, 0, 0, 0, 0, 0, 0, 0x2e, 0x46, 0x49, 0x54, 0, 0]
  const size = bytes.length
  header[4] = size & 0xff
  header[5] = (size >> 8) & 0xff
  header[6] = (size >> 16) & 0xff
  header[7] = (size >> 24) & 0xff
  return new Uint8Array([...header, ...bytes, 0, 0]).buffer
}

describe('parseFit', () => {
  it('разбирает session и record', () => {
    const [a] = parseFit(buildFit())
    expect(a!.sport).toBe('running')
    expect(a!.durationSec).toBe(600)
    expect(a!.distanceM).toBe(1000)
    expect(a!.avgHr).toBe(140)
    expect(a!.points).toHaveLength(2)
    expect(a!.points[0]!.lat).toBeCloseTo(55, 4)
    expect(a!.points[1]!.t).toBe(600)
    expect(a!.startTime).toBe(new Date((1_000_000_000 + 631_065_600) * 1000).toISOString())
  })

  it('отвергает не-FIT', () => {
    expect(() => parseFit(new Uint8Array(20).buffer)).toThrow()
  })
})

describe('strava csv', () => {
  it('parseCsv понимает кавычки и переносы', () => {
    expect(parseCsv('a,"b, c","d ""e"""\n1,2,3')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '2', '3'],
    ])
  })

  it('читает activities.csv', () => {
    const csv = `Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Distance,Moving Time,Elevation Gain,Average Heart Rate
123,"Sep 10, 2026, 6:12:43 AM",Morning Run,Run,1900,5.2,1800,42,145
124,"Sep 11, 2026, 7:00:00 AM",Ride,Ride,3600,30,3500,,`
    const acts = parseStravaCsv(csv)
    expect(acts).toHaveLength(2)
    expect(acts[0]!.sport).toBe('running')
    expect(acts[0]!.durationSec).toBe(1800)
    expect(acts[0]!.distanceM).toBe(5200)
    expect(acts[0]!.avgHr).toBe(145)
    expect(acts[0]!.externalId).toBe('strava-123')
    expect(acts[0]!.date).toBe('2026-09-10')
    expect(acts[1]!.sport).toBe('other')
  })
})

describe('apple health', () => {
  it('находит тренировки в кусках, даже если тег разрезан', () => {
    const xml = `<HealthData><Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30.5" durationUnit="min" totalDistance="5.1" totalDistanceUnit="km" startDate="2026-09-03 07:00:00 +0300" endDate="2026-09-03 07:30:30 +0300"></Workout>
<Workout workoutActivityType="HKWorkoutActivityTypeCycling" duration="60" durationUnit="min" startDate="2026-09-04 07:00:00 +0300"/>
<Workout workoutActivityType="HKWorkoutActivityTypeWalking" duration="1.0" durationUnit="hr" totalDistance="3" totalDistanceUnit="mi" startDate="2026-09-05 08:00:00 +0300"/></HealthData>`
    const cut = xml.indexOf('HKWorkoutActivityTypeWalking') + 5
    let state = createScanState()
    state = scanAppleHealthChunk(state, xml.slice(0, cut))
    state = scanAppleHealthChunk(state, xml.slice(cut))
    expect(state.activities).toHaveLength(2)
    expect(state.activities[0]!.durationSec).toBe(1830)
    expect(state.activities[0]!.distanceM).toBe(5100)
    expect(state.activities[1]!.sport).toBe('walking')
    expect(state.activities[1]!.durationSec).toBe(3600)
    expect(state.activities[1]!.distanceM).toBe(4828)
  })
})

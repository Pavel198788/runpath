/**
 * Кодирование координат в строку (формат Google Encoded Polyline, точность 1e-5).
 * Нужен для компактного хранения и будущей синхронизации треков.
 */
export function encodePolyline(coords: Array<[number, number]>): string {
  let out = ''
  let prevLat = 0
  let prevLon = 0
  for (const [lat, lon] of coords) {
    const la = Math.round(lat * 1e5)
    const lo = Math.round(lon * 1e5)
    out += encodeValue(la - prevLat) + encodeValue(lo - prevLon)
    prevLat = la
    prevLon = lo
  }
  return out
}

export function decodePolyline(str: string): Array<[number, number]> {
  const coords: Array<[number, number]> = []
  let index = 0
  let lat = 0
  let lon = 0
  while (index < str.length) {
    const r1 = decodeValue(str, index)
    index = r1.index
    lat += r1.value
    const r2 = decodeValue(str, index)
    index = r2.index
    lon += r2.value
    coords.push([lat / 1e5, lon / 1e5])
  }
  return coords
}

function encodeValue(v: number): string {
  let value = v < 0 ? ~(v << 1) : v << 1
  let out = ''
  while (value >= 0x20) {
    out += String.fromCharCode((0x20 | (value & 0x1f)) + 63)
    value >>= 5
  }
  out += String.fromCharCode(value + 63)
  return out
}

function decodeValue(str: string, index: number): { value: number; index: number } {
  let result = 0
  let shift = 0
  let b: number
  do {
    b = str.charCodeAt(index++) - 63
    result |= (b & 0x1f) << shift
    shift += 5
  } while (b >= 0x20)
  return { value: result & 1 ? ~(result >> 1) : result >> 1, index }
}

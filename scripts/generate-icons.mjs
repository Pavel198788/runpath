// Генерирует PNG-иконки PWA без внешних зависимостей (только zlib из Node).
// Рисунок: оранжевый скруглённый квадрат, белая «дорожка» с финишной точкой.
// Запуск: npm run icons
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const OUT = new URL('../public/icons/', import.meta.url)
mkdirSync(OUT, { recursive: true })

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Простейший растеризатор: для каждого пикселя проверяем принадлежность фигурам.
function render(size, { maskable }) {
  const px = Buffer.alloc(size * size * 4)
  const pad = maskable ? 0 : size * 0.08 // без padding для maskable (ОС сама обрежет)
  const r = maskable ? 0 : size * 0.22
  const bg = [249, 115, 22] // #f97316
  const inRoundedRect = (x, y) => {
    const x0 = pad,
      y0 = pad,
      x1 = size - pad,
      y1 = size - pad
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const cx = Math.min(Math.max(x, x0 + r), x1 - r)
    const cy = Math.min(Math.max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
  }
  // «Дорожка»: синусоида из левого нижнего угла в правый верхний, толщина ~9% размера.
  const road = (x, y) => {
    const t = (x - size * 0.2) / (size * 0.6)
    if (t < 0 || t > 1) return false
    const yc = size * (0.72 - 0.44 * t) + Math.sin(t * Math.PI * 2) * size * 0.07
    return Math.abs(y - yc) <= size * 0.045
  }
  // Финишная точка — круг в верхнем правом конце дорожки.
  const finish = (x, y) => (x - size * 0.8) ** 2 + (y - size * 0.28) ** 2 <= (size * 0.085) ** 2
  const ss = 3 // суперсэмплинг для сглаживания краёв
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0,
        w = 0
      for (let j = 0; j < ss; j++)
        for (let i = 0; i < ss; i++) {
          const sx = x + (i + 0.5) / ss,
            sy = y + (j + 0.5) / ss
          if (inRoundedRect(sx, sy)) {
            a++
            if (road(sx, sy) || finish(sx, sy)) w++
          }
        }
      const alpha = a / (ss * ss),
        white = w / (ss * ss)
      const i = (y * size + x) * 4
      px[i] = Math.round(bg[0] * (1 - white) + 255 * white)
      px[i + 1] = Math.round(bg[1] * (1 - white) + 255 * white)
      px[i + 2] = Math.round(bg[2] * (1 - white) + 255 * white)
      px[i + 3] = Math.round(alpha * 255)
    }
  }
  return encodePng(size, size, px)
}

const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon-180.png', 180, true],
]
for (const [name, size, maskable] of targets) {
  writeFileSync(new URL(name, OUT), render(size, { maskable }))
  console.log('✓', name)
}
// SVG-версия для favicon.
writeFileSync(
  new URL('icon.svg', OUT),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#f97316"/><path d="M20 72 C 35 50, 45 80, 60 55 S 75 25, 80 28" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/><circle cx="80" cy="28" r="8.5" fill="#fff"/></svg>\n`,
)
console.log('✓ icon.svg')

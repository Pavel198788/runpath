/** Рисует карточку прогресса на Canvas и отдаёт PNG (для «Поделиться»). */
export interface ShareData {
  title: string
  level: string
  totalKm: number
  streakWeeks: number
  bestKm: number
  appName: string
}

export async function renderShareCard(d: ShareData): Promise<Blob> {
  const w = 1080
  const h = 1080
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#f97316')
  grad.addColorStop(1, '#7c2d12')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath()
  ctx.arc(w * 0.8, h * 0.2, 260, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 56px system-ui, sans-serif'
  ctx.fillText(d.title, 80, 160)
  ctx.font = '40px system-ui, sans-serif'
  ctx.fillText(d.level, 80, 230)

  const stat = (label: string, value: string, y: number) => {
    ctx.font = 'bold 120px system-ui, sans-serif'
    ctx.fillText(value, 80, y)
    ctx.font = '36px system-ui, sans-serif'
    ctx.fillText(label, 84, y + 50)
  }
  stat('км всего', d.totalKm.toFixed(0), 460)
  stat('недель подряд', String(d.streakWeeks), 680)
  stat('км за раз (лучшая)', d.bestKm.toFixed(1), 900)

  ctx.font = 'bold 40px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(d.appName, w - 80, h - 80)

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
}

export async function shareOrDownload(blob: Blob, filename: string, title: string) {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return
    } catch {
      /* пользователь отменил — скачаем */
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

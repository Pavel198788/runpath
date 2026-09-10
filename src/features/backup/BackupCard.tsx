import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardText, CardTitle } from '@/ui'
import { backupToBlob, exportBackup, parseBackup, restoreBackup } from '@/data/backup/backup'
import { todayIso } from '@/domain/dates/dates'

/** Экспорт всех данных в файл и восстановление из файла. */
export function BackupCard() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<string | null>(null)

  const download = async () => {
    const b = await exportBackup()
    const url = URL.createObjectURL(backupToBlob(b))
    const a = document.createElement('a')
    a.href = url
    a.download = `runpath-backup-${todayIso()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setStatus(t('backup.exported'))
  }

  const restore = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = parseBackup(await file.text())
      if (!window.confirm(t('backup.restoreConfirm'))) return
      const { restored } = await restoreBackup(parsed)
      setStatus(t('backup.restored', { count: restored }))
      setTimeout(() => window.location.reload(), 800)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Card className="space-y-3">
      <CardTitle>{t('backup.title')}</CardTitle>
      <CardText className="text-sm">{t('backup.hint')}</CardText>
      <Button fullWidth variant="secondary" onClick={() => void download()}>
        {t('backup.export')}
      </Button>
      <label className="bg-surface-2 flex min-h-12 cursor-pointer items-center justify-center rounded-xl font-semibold">
        {t('backup.import')}
        <input
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => void restore(e.target.files?.[0])}
        />
      </label>
      {status && <CardText className="text-sm">{status}</CardText>}
    </Card>
  )
}

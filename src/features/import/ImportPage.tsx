import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import { Button, Card, CardText, CardTitle, Page, PageHeader } from '@/ui'
import {
  createScanState,
  parseFit,
  parseGpx,
  parseStravaCsv,
  parseTcx,
  scanAppleHealthChunk,
  type ImportedActivity,
} from '@/domain/import'
import { importActivities, type ImportOutcome } from '@/data/services/importService'
import { formatDistance, formatDuration } from '@/domain/units/units'
import { longDate } from '@/features/workout/workoutText'

/** Импорт тренировок из файлов. Всё разбирается в браузере. */
export default function ImportPage() {
  const { t } = useTranslation()
  const [found, setFound] = useState<ImportedActivity[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  const [busy, setBusy] = useState(false)

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setOutcome(null)
    setErrors([])
    const all: ImportedActivity[] = []
    for (const file of Array.from(files)) {
      setStatus(t('import.parsing', { name: file.name }))
      try {
        all.push(...(await parseFile(file)))
      } catch (e) {
        setErrors((prev) => [
          ...prev,
          t('import.error', {
            name: file.name,
            message: e instanceof Error ? e.message : String(e),
          }),
        ])
      }
    }
    setFound(all)
    setStatus(null)
    setBusy(false)
  }

  const doImport = async () => {
    setBusy(true)
    const result = await importActivities(found)
    setOutcome(result)
    setFound([])
    setBusy(false)
  }

  return (
    <Page className="space-y-4">
      <PageHeader title={t('import.title')} />
      <Card className="space-y-3">
        <CardText>{t('import.hint')}</CardText>
        <label className="bg-accent text-accent-fg flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold">
          <Upload className="size-5" aria-hidden /> {t('import.choose')}
          <input
            type="file"
            multiple
            accept=".gpx,.tcx,.fit,.csv,.xml"
            className="sr-only"
            disabled={busy}
            onChange={(e) => void onFiles(e.target.files)}
          />
        </label>
        {status && <CardText className="text-sm">{status}</CardText>}
        {errors.map((e) => (
          <CardText key={e} className="text-danger text-sm">
            {e}
          </CardText>
        ))}
        {outcome && (
          <CardText className="text-success">{t('import.result', { ...outcome })}</CardText>
        )}
      </Card>

      {found.length > 0 && (
        <Card className="space-y-3">
          <CardTitle>{t('import.found', { count: found.length })}</CardTitle>
          <ul className="divide-border max-h-80 divide-y overflow-y-auto text-sm">
            {found.map((a, i) => (
              <li key={`${a.externalId ?? i}`} className="flex items-center justify-between py-2">
                <span>
                  <span className="block font-medium">
                    {a.name ?? t(`import.sport.${a.sport}`)}
                  </span>
                  <span className="text-muted">
                    {longDate(a.date)} · {formatDuration(a.durationSec)}
                    {a.distanceM ? ` · ${formatDistance(a.distanceM, 'metric')}` : ''}
                    {a.points.length ? ' · GPS' : ''}
                  </span>
                </span>
                <span className="text-muted text-xs">{t(`import.sport.${a.sport}`)}</span>
              </li>
            ))}
          </ul>
          <Button fullWidth size="lg" disabled={busy} onClick={() => void doImport()}>
            {t('import.doImport')}
          </Button>
        </Card>
      )}
      {found.length === 0 &&
        outcome === null &&
        !busy &&
        status === null &&
        errors.length === 0 &&
        null}

      <Card className="space-y-2">
        <CardText className="text-sm">{t('import.garmin')}</CardText>
        <CardText className="text-sm">{t('import.apple')}</CardText>
      </Card>
    </Page>
  )
}

async function parseFile(file: File): Promise<ImportedActivity[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.fit')) return parseFit(await file.arrayBuffer())
  if (name.endsWith('.gpx')) return parseGpx(await file.text())
  if (name.endsWith('.tcx')) return parseTcx(await file.text())
  if (name.endsWith('.csv')) return parseStravaCsv(await file.text())
  if (name.endsWith('.xml')) {
    // Apple Health: читаем потоком, файл может быть на гигабайты.
    let state = createScanState()
    const decoder = new TextDecoder()
    const reader = file.stream().getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      state = scanAppleHealthChunk(state, decoder.decode(value, { stream: true }))
    }
    const acts = state.activities
    if (acts.length === 0) throw new Error('Не найдено тренировок')
    return acts
  }
  throw new Error('Неизвестный формат')
}

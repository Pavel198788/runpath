import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pause, Play, Square } from 'lucide-react'
import { Button } from '@/ui'
import { getSettings } from '@/data/repositories/settingsRepo'
import { formatDuration } from '@/domain/units/units'
import { useWakeLock } from '@/features/workout/useWakeLock'
import { useGpsTracker } from './useGpsTracker'
import { GpsPanel } from './GpsPanel'
import { usePendingTrack } from './pendingTrackStore'

/** Свободная пробежка: секундомер + GPS, без плана. В конце — обычная форма записи. */
export default function FreeRunPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const settings = useLiveQuery(getSettings)
  const gps = useGpsTracker({ autoPause: settings?.autoPause ?? true })
  const setPending = usePendingTrack((s) => s.setPending)
  const [phase, setPhase] = useState<'ready' | 'running' | 'paused'>('ready')
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef<number | null>(null)
  const pausedTotal = useRef(0)
  const pausedAt = useRef<number | null>(null)
  useWakeLock(phase !== 'ready')

  useEffect(() => {
    if (phase !== 'running') return
    const id = setInterval(() => {
      if (startedAt.current !== null)
        setElapsed(Math.round((Date.now() - startedAt.current - pausedTotal.current) / 1000))
    }, 500)
    return () => clearInterval(id)
  }, [phase])

  const start = () => {
    startedAt.current = Date.now()
    gps.start()
    setPhase('running')
  }
  const togglePause = () => {
    if (phase === 'running') {
      pausedAt.current = Date.now()
      gps.pause()
      setPhase('paused')
    } else {
      if (pausedAt.current !== null) pausedTotal.current += Date.now() - pausedAt.current
      pausedAt.current = null
      gps.resume()
      setPhase('running')
    }
  }
  const finish = () => {
    if (!window.confirm(t('run.finishConfirm'))) return
    const points = gps.stop()
    const startTime = new Date(startedAt.current ?? Date.now()).toISOString()
    setPending(
      points.length > 1
        ? {
            points,
            distanceM: gps.state.distanceM,
            movingSec: gps.state.movingSec || elapsed,
            startTime,
          }
        : null,
    )
    navigate('/log/new', { replace: true, state: null })
  }

  return (
    <div
      className="bg-bg text-fg flex min-h-dvh flex-col px-4 pt-4"
      style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      <button type="button" onClick={() => navigate(-1)} className="text-muted self-start text-sm">
        {t('common.back')}
      </button>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-muted">{t('gps.freeRun')}</p>
        <p className="font-mono text-7xl font-bold tabular-nums">{formatDuration(elapsed)}</p>
        <p className="text-muted -mt-4 text-sm">{t('run.elapsed')}</p>
        <GpsPanel gps={gps.state} />
        {phase === 'ready' && <p className="text-muted max-w-sm text-sm">{t('gps.enableHint')}</p>}
      </div>
      {phase === 'ready' ? (
        <Button size="lg" fullWidth onClick={start}>
          <Play className="size-6" aria-hidden /> {t('run.start')}
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            onClick={togglePause}
            aria-label={phase === 'paused' ? t('timer.resume') : t('timer.pause')}
          >
            {phase === 'paused' ? (
              <Play className="size-6" aria-hidden />
            ) : (
              <Pause className="size-6" aria-hidden />
            )}
          </Button>
          <Button variant="danger" size="lg" onClick={finish} aria-label={t('run.finish')}>
            <Square className="size-6" aria-hidden /> {t('run.finish')}
          </Button>
        </div>
      )}
    </div>
  )
}

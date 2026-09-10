import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pause, Play, SkipForward, Square, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/ui'
import { getWorkout } from '@/data/repositories/workoutRepo'
import { getSettings, updateSettings } from '@/data/repositories/settingsRepo'
import {
  activeSeconds,
  advance,
  createTimer,
  pause,
  reminderPoints,
  resume,
  skip,
  snapshot,
  type TimerState,
} from '@/domain/timer/engine'
import { formatMinSec } from '@/domain/units/units'
import { cn } from '@/lib/cn'
import { useSpeech, vibrate } from './useSpeech'
import { createSilentAudio, useWakeLock } from './useWakeLock'
import { useNow } from './useNow'
import { sayKeyFor, segmentLabel, workoutTitle } from './workoutText'
import type { Segment } from '@/domain/plan/types'
import { useGpsTracker } from '@/features/tracking/useGpsTracker'
import { GpsPanel } from '@/features/tracking/GpsPanel'
import { usePendingTrack } from '@/features/tracking/pendingTrackStore'

export interface TimerResult {
  workoutId: string
  durationSec: number
  completedSegments: number
  totalSegments: number
}

const kindColor: Record<Segment['kind'], string> = {
  warmup: 'bg-info',
  walk: 'bg-info',
  cooldown: 'bg-info',
  run: 'bg-accent',
  fast: 'bg-danger',
  tempo: 'bg-warning',
  strength: 'bg-success',
}

/** Полноэкранный таймер интервалов с голосом и вибрацией. */
export default function TimerPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const workout = useLiveQuery(async () => (await getWorkout(id)) ?? null, [id])
  const settings = useLiveQuery(getSettings)
  const voiceEnabled = settings?.voiceEnabled ?? true
  const vibrationEnabled = settings?.vibrationEnabled ?? true

  const [timer, setTimer] = useState<TimerState | null>(null)
  const timerRef = useRef<TimerState | null>(null)
  const spokenRef = useRef<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { speak, cancel } = useSpeech(voiceEnabled)
  const running = timer !== null && !timer.finished
  const now = useNow(250, running)
  useWakeLock(running)
  const gpsWanted = (settings?.gpsEnabled ?? true) && workout?.type !== 'strength'
  const gps = useGpsTracker({ autoPause: settings?.autoPause ?? true })
  const setPending = usePendingTrack((s) => s.setPending)
  const startedAtRef = useRef<string | null>(null)

  const announceSegment = useCallback(
    (seg: Segment) => {
      const { key, count } = sayKeyFor(seg.kind, seg.seconds)
      speak(t(key, { count }))
      vibrate([200, 100, 200], vibrationEnabled)
    },
    [speak, t, vibrationEnabled],
  )

  const start = () => {
    if (!workout) return
    const state = createTimer(workout.segments, Date.now())
    timerRef.current = state
    setTimer(state)
    spokenRef.current.clear()
    // Тихая дорожка запускается из жеста пользователя — иначе iOS её заблокирует.
    audioRef.current = createSilentAudio()
    void audioRef.current?.play().catch(() => {})
    startedAtRef.current = new Date().toISOString()
    if (gpsWanted) gps.start()
    const first = workout.segments[0]
    if (first) announceSegment(first)
  }

  // Основной цикл: продвигаем движок и озвучиваем события.
  useEffect(() => {
    const state = timerRef.current
    if (!state || state.finished || state.pausedAt !== null) return
    const { state: next, completed } = advance(state, now)
    if (completed > 0) {
      timerRef.current = next
      setTimer(next)
      if (next.finished) {
        speak(t('say.finished'))
        vibrate([400, 100, 400, 100, 400], vibrationEnabled)
      } else {
        const seg = next.segments[next.segmentIndex]
        if (seg) announceSegment(seg)
      }
      return
    }
    const seg = state.segments[state.segmentIndex]
    if (!seg) return
    const elapsed = (now - state.segmentStartedAt) / 1000
    for (const point of reminderPoints(seg)) {
      const key = `${state.segmentIndex}:${point}`
      if (elapsed >= point && !spokenRef.current.has(key)) {
        spokenRef.current.add(key)
        const left = seg.seconds - point
        speak(
          left >= 60
            ? t('say.left_min', { count: Math.round(left / 60) })
            : t('say.left_sec_many', { count: left }),
        )
        vibrate(100, vibrationEnabled)
      }
    }
  }, [now, speak, t, announceSegment, vibrationEnabled])

  useEffect(
    () => () => {
      cancel()
      audioRef.current?.pause()
    },
    [cancel],
  )

  const update = (next: TimerState) => {
    timerRef.current = next
    setTimer(next)
  }

  const finish = (confirmFirst: boolean) => {
    const state = timerRef.current
    if (!state || !workout) return
    if (confirmFirst && !window.confirm(t('timer.finishConfirm'))) return
    const nowMs = Date.now()
    const completed = state.finished ? state.segments.length : state.segmentIndex
    const result: TimerResult = {
      workoutId: workout.id,
      durationSec: activeSeconds(state, nowMs),
      completedSegments: completed,
      totalSegments: state.segments.length,
    }
    cancel()
    audioRef.current?.pause()
    if (gpsWanted) {
      const points = gps.stop()
      setPending(
        points.length > 1
          ? {
              points,
              distanceM: gps.state.distanceM,
              movingSec: gps.state.movingSec,
              startTime: startedAtRef.current ?? new Date().toISOString(),
            }
          : null,
      )
    }
    navigate('/log/new', { replace: true, state: result })
  }

  if (workout === undefined) return <div className="p-6">{t('common.loading')}</div>
  if (!workout) return <div className="p-6">{t('common.notFound')}</div>

  // Экран «приготовься»: нужен клик, чтобы разрешить звук и речь.
  if (!timer) {
    return (
      <div
        className="bg-bg text-fg flex min-h-dvh flex-col px-4 pt-6 pb-8"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-muted self-start text-sm"
        >
          {t('common.back')}
        </button>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-muted">{workoutTitle(workout, t)}</p>
          <h1 className="text-4xl font-bold">{t('timer.getReady')}</h1>
          <p className="text-muted max-w-sm text-sm">{t('timer.screenHint')}</p>
        </div>
        <Button size="lg" fullWidth onClick={start}>
          <Play className="size-6" aria-hidden /> {t('timer.go')}
        </Button>
      </div>
    )
  }

  const snap = snapshot(timer, now)
  const seg = snap.segment
  const nextSeg = timer.segments[timer.segmentIndex + 1]
  const progress = seg ? snap.segmentElapsedSec / seg.seconds : 1

  return (
    <div
      className="bg-bg text-fg flex min-h-dvh flex-col px-4 pt-4"
      style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-muted text-sm">{workoutTitle(workout, t)}</span>
        <button
          type="button"
          aria-label={voiceEnabled ? t('timer.voiceOn') : t('timer.voiceOff')}
          onClick={() => void updateSettings({ voiceEnabled: !voiceEnabled })}
          className="text-muted p-2"
        >
          {voiceEnabled ? (
            <Volume2 className="size-6" aria-hidden />
          ) : (
            <VolumeX className="size-6" aria-hidden />
          )}
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {snap.finished ? (
          <h1 className="text-3xl font-bold">{t('say.finished')}</h1>
        ) : (
          <>
            <p className="text-muted text-sm">
              {t('timer.segmentOf', {
                current: snap.segmentIndex + 1,
                total: timer.segments.length,
              })}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{seg ? segmentLabel(seg.kind, t) : ''}</h1>
            <p className="mt-6 font-mono text-7xl font-bold tabular-nums" aria-live="off">
              {formatMinSec(Math.ceil(snap.segmentRemainingSec))}
            </p>
            {seg && (
              <p className="text-muted mt-2 text-sm">
                {t('workout.rpeHint', { from: seg.rpe[0], to: seg.rpe[1] })} —{' '}
                {t(`workout.rpe.${seg.rpe[1]}`)}
              </p>
            )}
            <div className="bg-surface-2 mt-6 h-3 w-full max-w-sm overflow-hidden rounded-full">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  seg ? kindColor[seg.kind] : 'bg-accent',
                )}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="text-muted mt-4 text-sm">
              {t('timer.totalLeft')}:{' '}
              <span className="font-mono">{formatMinSec(Math.ceil(snap.totalRemainingSec))}</span>
            </p>
            {nextSeg && (
              <p className="text-muted mt-1 text-sm">
                {t('timer.next', {
                  segment: `${segmentLabel(nextSeg.kind, t)} ${formatMinSec(nextSeg.seconds)}`,
                })}
              </p>
            )}
            {snap.paused && <p className="text-warning mt-4 font-medium">{t('say.paused')}</p>}
            {gpsWanted && (
              <div className="mt-4 w-full max-w-sm">
                <GpsPanel gps={gps.state} />
              </div>
            )}
          </>
        )}
      </div>

      {snap.finished ? (
        <Button size="lg" fullWidth onClick={() => finish(false)}>
          {t('common.continue')}
        </Button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => update(skip(timer, Date.now()))}
            aria-label={t('timer.skipSegment')}
          >
            <SkipForward className="size-6" aria-hidden />
          </Button>
          <Button
            size="lg"
            onClick={() => {
              const nowMs = Date.now()
              if (snap.paused) {
                update(resume(timer, nowMs))
                if (gpsWanted) gps.resume()
                speak(t('say.resumed'))
              } else {
                update(pause(timer, nowMs))
                if (gpsWanted) gps.pause()
                speak(t('say.paused'))
              }
            }}
            aria-label={snap.paused ? t('timer.resume') : t('timer.pause')}
          >
            {snap.paused ? (
              <Play className="size-6" aria-hidden />
            ) : (
              <Pause className="size-6" aria-hidden />
            )}
          </Button>
          <Button
            variant="danger"
            size="lg"
            onClick={() => finish(true)}
            aria-label={t('timer.finish')}
          >
            <Square className="size-6" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  avgPaceSecPerKm,
  currentPaceSecPerKm,
  trackDistanceM,
  type TrackPoint,
} from '@/domain/geo/geo'
import { filterFix, isStationary, type FilterState } from '@/domain/geo/filter'

export type GpsStatus =
  'idle' | 'acquiring' | 'tracking' | 'paused' | 'autopaused' | 'denied' | 'unsupported'

export interface GpsState {
  status: GpsStatus
  points: TrackPoint[]
  distanceM: number
  /** Секунды движения (без пауз и автопауз). */
  movingSec: number
  currentPace: number
  avgPace: number
  accuracyM: number | null
}

const initial: GpsState = {
  status: 'idle',
  points: [],
  distanceM: 0,
  movingSec: 0,
  currentPace: 0,
  avgPace: 0,
  accuracyM: null,
}

/**
 * GPS-трекинг через Geolocation API. Фильтрует шум, считает дистанцию и темп, умеет автопаузу.
 * Ограничения PWA: на iOS при заблокированном экране обновления останавливаются;
 * на Android при выключенном экране могут приходить реже. Держим экран включённым (Wake Lock).
 */
export function useGpsTracker(opts: { autoPause: boolean }) {
  const [state, setState] = useState<GpsState>(initial)
  const watchId = useRef<number | null>(null)
  const filter = useRef<FilterState | null>(null)
  const startedAt = useRef<number | null>(null)
  const pausedRef = useRef(false)
  const pointsRef = useRef<TrackPoint[]>([])
  const movingRef = useRef(0)
  const lastTickRef = useRef<number | null>(null)
  const autoPausedRef = useRef(false)

  const stopWatch = () => {
    if (watchId.current !== null && 'geolocation' in navigator)
      navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, status: 'unsupported' }))
      return
    }
    startedAt.current = Date.now()
    pointsRef.current = []
    filter.current = null
    movingRef.current = 0
    lastTickRef.current = null
    pausedRef.current = false
    setState({ ...initial, status: 'acquiring' })
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (pausedRef.current || startedAt.current === null) return
        const t = (pos.timestamp - startedAt.current) / 1000
        const acc = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null
        const r = filterFix(filter.current, {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          t,
          alt: pos.coords.altitude,
          acc,
        })
        filter.current = r.state
        if (r.point) pointsRef.current = [...pointsRef.current, r.point]
        const stationary = opts.autoPause && isStationary(pointsRef.current, t)
        autoPausedRef.current = stationary
        const pts = pointsRef.current
        const distanceM = trackDistanceM(pts)
        setState((s) => ({
          ...s,
          status: stationary ? 'autopaused' : 'tracking',
          points: pts,
          distanceM,
          currentPace: stationary ? 0 : currentPaceSecPerKm(pts),
          avgPace: avgPaceSecPerKm(distanceM, movingRef.current),
          accuracyM: acc,
        }))
      },
      (err) => {
        setState((s) => ({
          ...s,
          status: err.code === err.PERMISSION_DENIED ? 'denied' : s.status,
        }))
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20_000 },
    )
  }, [opts.autoPause])

  // Секунды движения считаем тиками по секунде, пока не на паузе/автопаузе.
  useEffect(() => {
    if (state.status === 'idle' || state.status === 'denied' || state.status === 'unsupported')
      return
    const id = setInterval(() => {
      const now = Date.now()
      if (lastTickRef.current !== null && !pausedRef.current && !autoPausedRef.current) {
        movingRef.current += (now - lastTickRef.current) / 1000
        setState((s) => ({
          ...s,
          movingSec: Math.round(movingRef.current),
          avgPace: avgPaceSecPerKm(s.distanceM, movingRef.current),
        }))
      }
      lastTickRef.current = now
    }, 1000)
    return () => clearInterval(id)
  }, [state.status])

  const pause = useCallback(() => {
    pausedRef.current = true
    setState((s) => ({ ...s, status: 'paused' }))
  }, [])

  const resume = useCallback(() => {
    pausedRef.current = false
    // После паузы фильтр начинает заново, чтобы не «дорисовать» путь до нового места.
    filter.current = null
    setState((s) => ({ ...s, status: 'tracking' }))
  }, [])

  const stop = useCallback((): TrackPoint[] => {
    stopWatch()
    pausedRef.current = true
    setState((s) => ({ ...s, status: 'idle' }))
    return pointsRef.current
  }, [])

  useEffect(() => () => stopWatch(), [])

  return { state, start, pause, resume, stop }
}

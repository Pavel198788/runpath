import { create } from 'zustand'
import type { TrackPoint } from '@/domain/geo/geo'

interface PendingTrack {
  points: TrackPoint[]
  distanceM: number
  movingSec: number
  startTime: string
}

interface PendingTrackState {
  pending: PendingTrack | null
  setPending: (p: PendingTrack | null) => void
}

/**
 * Трек ещё не записанной тренировки: таймер кладёт сюда точки,
 * форма записи забирает и сохраняет вместе с записью. В router.state он не влезает.
 */
export const usePendingTrack = create<PendingTrackState>()((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
}))

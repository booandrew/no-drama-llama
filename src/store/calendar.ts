import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type CalendarStatus = 'idle' | 'connected' | 'loading' | 'done' | 'error' | 'expired'

interface CalendarState {
  status: CalendarStatus
  accessToken: string | null
  expiresAt: number | null

  setConnected: (accessToken: string, expiresIn: number) => void
  setStatus: (status: CalendarStatus) => void
  setExpired: () => void
  disconnect: () => void
  isTokenValid: () => boolean
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      accessToken: null,
      expiresAt: null,

      setConnected: (accessToken, expiresIn) =>
        set({
          accessToken,
          expiresAt: Date.now() + expiresIn * 1000,
          status: 'connected',
        }),

      setStatus: (status) => set({ status }),

      setExpired: () =>
        set({
          accessToken: null,
          expiresAt: null,
          status: 'expired',
        }),

      disconnect: () =>
        set({
          accessToken: null,
          expiresAt: null,
          status: 'idle',
        }),

      isTokenValid: () => {
        const { expiresAt } = get()
        if (!expiresAt) return false
        return expiresAt > Date.now() + 60_000
      },
    }),
    {
      name: 'gcal-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        expiresAt: state.expiresAt,
      }),
    },
  ),
)

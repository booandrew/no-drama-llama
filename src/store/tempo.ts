import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { logAction } from '@/store/activity-log'

type TempoStatus = 'idle' | 'connected' | 'error' | 'expired'

interface TempoState {
  status: TempoStatus
  accessToken: string | null
  error: string | null

  setToken: (token: string) => void
  setStatus: (status: TempoStatus) => void
  setExpired: () => void
  disconnect: () => void
}

export const useTempoStore = create<TempoState>()(
  persist(
    (set) => ({
      status: 'idle',
      accessToken: null,
      error: null,

      setToken: (token) => {
        logAction('connection', 'success', 'Connected to Tempo')
        return set({
          accessToken: token,
          status: 'connected',
          error: null,
        })
      },

      setStatus: (status) => set({ status }),

      setExpired: () =>
        set({
          accessToken: null,
          status: 'expired',
          error: 'API token expired or revoked. Please generate a new one in Tempo Settings.',
        }),

      disconnect: () => {
        logAction('connection', 'info', 'Disconnected from Tempo')
        return set({
          accessToken: null,
          status: 'idle',
          error: null,
        })
      },
    }),
    {
      name: 'tempo-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          state.setStatus('connected')
        }
      },
    },
  ),
)

import { create } from 'zustand'

import { logAction } from '@/store/activity-log'

type TempoStatus = 'idle' | 'connected' | 'error' | 'expired'

interface TempoState {
  status: TempoStatus
  error: string | null

  setToken: (token: string) => Promise<void>
  setStatus: (status: TempoStatus) => void
  setExpired: () => void
  disconnect: () => Promise<void>
  checkAuthStatus: () => Promise<void>
}

export const useTempoStore = create<TempoState>()((set) => ({
  status: 'idle',
  error: null,

  setToken: async (token) => {
    logAction('connection', 'success', 'Connected to Tempo')
    try {
      const res = await fetch('/tempo-api/.auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) throw new Error(`Failed to store token: ${res.status}`)
      set({ status: 'connected', error: null })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  setStatus: (status) => set({ status }),

  setExpired: () =>
    set({
      status: 'expired',
      error: 'API token expired or revoked. Please generate a new one in Tempo Settings.',
    }),

  disconnect: async () => {
    logAction('connection', 'info', 'Disconnected from Tempo')
    try {
      await fetch('/tempo-api/.auth/disconnect', { method: 'DELETE' })
    } catch {
      // best-effort
    }
    set({ status: 'idle', error: null })
  },

  checkAuthStatus: async () => {
    try {
      const res = await fetch('/tempo-api/.auth/status')
      if (!res.ok) return
      const data = await res.json()
      if (data.connected) {
        set({ status: 'connected' })
      }
    } catch {
      // offline or not deployed yet
    }
  },
}))

// Check auth status on app load
useTempoStore.getState().checkAuthStatus()

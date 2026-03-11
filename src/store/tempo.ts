import { create } from 'zustand'

import { logAction } from '@/store/activity-log'

type TempoStatus = 'idle' | 'connected' | 'error' | 'expired'
export type ConnectionHealth = 'unknown' | 'healthy' | 'unhealthy'

interface TempoState {
  status: TempoStatus
  connectionHealth: ConnectionHealth
  error: string | null

  setToken: (token: string) => Promise<void>
  setStatus: (status: TempoStatus) => void
  setExpired: () => void
  disconnect: () => Promise<void>
  checkAuthStatus: () => Promise<void>
  checkHealth: () => Promise<void>
}

export const useTempoStore = create<TempoState>()((set, get) => ({
  status: 'idle',
  connectionHealth: 'unknown',
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
      set({ status: 'connected', connectionHealth: 'healthy', error: null })
    } catch (e) {
      set({ status: 'error', connectionHealth: 'unhealthy', error: (e as Error).message })
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
    set({ status: 'idle', connectionHealth: 'unknown', error: null })
  },

  checkAuthStatus: async () => {
    try {
      const res = await fetch('/tempo-api/.auth/status')
      if (!res.ok) return
      const data = await res.json()
      if (data.connected) {
        set({ status: 'connected' })
        get().checkHealth()
      }
    } catch {
      // offline or not deployed yet
    }
  },

  checkHealth: async () => {
    const { status } = get()
    if (status === 'idle') return
    try {
      const res = await fetch('/tempo-api/.auth/health')
      if (!res.ok) return
      const data = await res.json()
      set({ connectionHealth: data.healthy ? 'healthy' : 'unhealthy' })
      if (!data.healthy) set({ status: 'expired' })
    } catch {
      // network error — don't change state
    }
  },
}))

// Check auth status on app load
useTempoStore.getState().checkAuthStatus()

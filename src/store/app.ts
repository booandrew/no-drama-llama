import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { logAction } from '@/store/activity-log'

type Tab =
  | 'llama-time'
  | 'sources'
  | 'custom-inputs'
  | 'mappings'
  | 'wool-insights'
  | 'logs-history'

interface Integration {
  id: string
  name: string
  connected: boolean
}

const defaultIntegrations: Integration[] = [{ id: 'git', name: 'Git', connected: false }]

interface AppState {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  integrations: Integration[]
  toggleIntegration: (id: string) => void
  isMockMode: boolean
  toggleMockMode: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTab: 'llama-time',
      setActiveTab: (activeTab) => set({ activeTab }),
      integrations: defaultIntegrations,
      toggleIntegration: (id) =>
        set((state) => ({
          integrations: state.integrations.map((i) =>
            i.id === id ? { ...i, connected: !i.connected } : i,
          ),
        })),
      isMockMode: false,
      toggleMockMode: () =>
        set((state) => {
          const next = !state.isMockMode
          logAction('settings', 'info', next ? 'Switched to mock data' : 'Switched to real data')
          return { isMockMode: next }
        }),
    }),
    {
      name: 'app-store',
      partialize: (state) => ({ isMockMode: state.isMockMode }),
    },
  ),
)

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

interface AppState {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  isMockMode: boolean
  toggleMockMode: () => void
  hasSeenLanding: boolean
  setHasSeenLanding: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTab: 'llama-time',
      setActiveTab: (activeTab) => set({ activeTab }),
      isMockMode: false,
      toggleMockMode: () => set((state) => ({ isMockMode: !state.isMockMode })),
      hasSeenLanding: false,
      setHasSeenLanding: () => set({ hasSeenLanding: true }),
    }),
    {
      name: 'app-store',
      partialize: (state) => ({
        isMockMode: state.isMockMode,
        hasSeenLanding: state.hasSeenLanding,
      }),
    },
  ),
)

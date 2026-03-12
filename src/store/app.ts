import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Tab =
  | 'llama-time'
  | 'sources'
  | 'custom-inputs'
  | 'mappings'
  | 'wool-insights'
  | 'logs-history'

export type ViewMode = 'month' | 'week' | 'day' | 'list'

interface AppState {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  isMockMode: boolean
  toggleMockMode: () => void
  hasSeenLanding: boolean
  setHasSeenLanding: () => void
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  selectedDate: string
  setSelectedDate: (date: string) => void
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
      viewMode: 'list',
      setViewMode: (viewMode) => set({ viewMode }),
      selectedDate: new Date().toISOString().slice(0, 10),
      setSelectedDate: (selectedDate) => set({ selectedDate }),
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

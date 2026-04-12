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
      hasSeenLanding: false,
      setHasSeenLanding: () => set({ hasSeenLanding: true }),
      viewMode: 'list',
      setViewMode: (viewMode) => set({ viewMode }),
      selectedDate: new Date().toISOString().slice(0, 10),
      setSelectedDate: (selectedDate) => set({ selectedDate }),
    }),
    {
      name: 'app-store',
      version: 2,
      partialize: (state) => ({
        hasSeenLanding: state.hasSeenLanding,
        selectedDate: state.selectedDate,
      }),
    },
  ),
)

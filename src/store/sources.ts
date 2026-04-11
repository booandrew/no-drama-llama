import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  computePeriodRange,
  daysBetweenInclusive,
  todayDate,
} from '@/lib/date-range'

export type PeriodMode = 'day' | 'week' | 'month' | 'custom'
export type SourceSubtab = 'jira-issues' | 'jira-worklogs' | 'gcal-events' | 'tempo-capacity'
export type SourceView = 'data' | 'raw'

const MAX_CUSTOM_DAYS = 92 // ~3 months

export function computePeriod(state: {
  periodMode: PeriodMode
  selectedDate: string
  customStart: string | null
  customEnd: string | null
}): { start: string; endExclusive: string } {
  return computePeriodRange(state)
}

interface SourcesState {
  periodMode: PeriodMode
  selectedDate: string
  customStart: string | null
  customEnd: string | null
  activeSubtab: SourceSubtab
  activeView: SourceView
  syncing: Record<string, boolean>

  setPeriodMode: (mode: PeriodMode) => void
  setSelectedDate: (date: string) => void
  setCustomRange: (start: string, end: string) => string | null
  setActiveSubtab: (tab: SourceSubtab) => void
  setActiveView: (view: SourceView) => void
  setSyncing: (source: string, loading: boolean) => void
  getPeriod: () => { start: string; endExclusive: string }
}

export const useSourcesStore = create<SourcesState>()(
  persist(
    (set, get) => ({
      periodMode: 'month',
      selectedDate: todayDate(),
      customStart: null,
      customEnd: null,
      activeSubtab: 'jira-issues',
      activeView: 'data',
      syncing: {},

      setPeriodMode: (periodMode) => set({ periodMode }),
      setSelectedDate: (selectedDate) => set({ selectedDate }),

      setCustomRange: (start, end) => {
        if (daysBetweenInclusive(start, end) > MAX_CUSTOM_DAYS) {
          return 'Custom period cannot exceed 3 months'
        }
        if (new Date(end) < new Date(start)) {
          return 'End date must be on or after start date'
        }
        set({ customStart: start, customEnd: end })
        return null
      },

      setActiveSubtab: (activeSubtab) => set({ activeSubtab }),
      setActiveView: (activeView) => set({ activeView }),

      setSyncing: (source, loading) =>
        set((state) => ({ syncing: { ...state.syncing, [source]: loading } })),

      getPeriod: () => computePeriod(get()),
    }),
    {
      name: 'sources-period',
      partialize: (state) => ({
        periodMode: state.periodMode,
        selectedDate: state.selectedDate,
        customStart: state.customStart,
        customEnd: state.customEnd,
      }),
    },
  ),
)

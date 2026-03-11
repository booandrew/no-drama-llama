import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PeriodMode = 'day' | 'week' | 'month' | 'custom'
export type SourceSubtab = 'jira-issues' | 'jira-worklogs' | 'gcal-events' | 'tempo-capacity'
export type SourceView = 'data' | 'raw'

const MAX_CUSTOM_DAYS = 92 // ~3 months

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function getMonday(dateStr: string) {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function getMonthStart(dateStr: string) {
  const d = new Date(dateStr)
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function getMonthEnd(dateStr: string) {
  const d = new Date(dateStr)
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string) {
  return Math.abs((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
}

export function computePeriod(state: {
  periodMode: PeriodMode
  selectedDate: string
  customStart: string | null
  customEnd: string | null
}): { start: string; end: string } {
  switch (state.periodMode) {
    case 'day':
      return { start: state.selectedDate, end: addDays(state.selectedDate, 1) }
    case 'week': {
      const mon = getMonday(state.selectedDate)
      return { start: mon, end: addDays(mon, 7) }
    }
    case 'month':
      return { start: getMonthStart(state.selectedDate), end: getMonthEnd(state.selectedDate) }
    case 'custom':
      return {
        start: state.customStart ?? state.selectedDate,
        end: state.customEnd ?? addDays(state.selectedDate, 1),
      }
  }
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
  getPeriod: () => { start: string; end: string }
}

export const useSourcesStore = create<SourcesState>()(
  persist(
    (set, get) => ({
      periodMode: 'month',
      selectedDate: todayISO(),
      customStart: null,
      customEnd: null,
      activeSubtab: 'jira-issues',
      activeView: 'data',
      syncing: {},

      setPeriodMode: (periodMode) => set({ periodMode }),
      setSelectedDate: (selectedDate) => set({ selectedDate }),

      setCustomRange: (start, end) => {
        if (daysBetween(start, end) > MAX_CUSTOM_DAYS) {
          return 'Custom period cannot exceed 3 months'
        }
        if (new Date(end) <= new Date(start)) {
          return 'End date must be after start date'
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

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { computePeriodRange, daysBetweenInclusive, todayDate } from '@/lib/date-range'
import type { DdsCustomInput } from '@/lib/duckdb/queries'
import { logAction } from '@/store/activity-log'
import {
  readDdsCustomInputs,
  upsertDdsCustomInputs,
  deleteDdsCustomInput,
  nextTaskRevision,
  customInputToTask,
} from '@/lib/duckdb/queries'
import type { PeriodMode } from '@/store/sources'

const MAX_CUSTOM_DAYS = 92

interface CustomInputsState {
  periodMode: PeriodMode
  selectedDate: string
  customStart: string | null
  customEnd: string | null

  items: DdsCustomInput[]
  loading: boolean

  setPeriodMode: (mode: PeriodMode) => void
  setSelectedDate: (date: string) => void
  setCustomRange: (start: string, end: string) => string | null
  getPeriod: () => { start: string; endExclusive: string }

  loadItems: () => Promise<void>
  addItem: (
    item: Omit<DdsCustomInput, 'id'>,
    issueOverride?: {
      issue_key: string | null
      issue_name: string | null
      project_key: string | null
    },
  ) => Promise<void>
  updateItem: (
    item: DdsCustomInput,
    issueOverride?: {
      issue_key: string | null
      issue_name: string | null
      project_key: string | null
    },
  ) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

export const useCustomInputsStore = create<CustomInputsState>()(
  persist(
    (set, get) => ({
      periodMode: 'day',
      selectedDate: todayDate(),
      customStart: null,
      customEnd: null,

      items: [],
      loading: false,

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

      getPeriod: () => computePeriodRange(get()),

      loadItems: async () => {
        set({ loading: true })
        try {
          const { start, endExclusive } = get().getPeriod()
          const items = await readDdsCustomInputs(start, endExclusive)
          set({ items })
        } finally {
          set({ loading: false })
        }
      },

      addItem: async (item, issueOverride) => {
        const id = crypto.randomUUID()
        const fullItem: DdsCustomInput = { ...item, id }
        await upsertDdsCustomInputs([fullItem])
        const revision = await nextTaskRevision()
        await customInputToTask(fullItem, revision, issueOverride)
        await get().loadItems()
        logAction('input', 'success', 'Added custom time entry')
      },

      updateItem: async (item, issueOverride) => {
        await upsertDdsCustomInputs([item])
        const revision = await nextTaskRevision()
        await customInputToTask(item, revision, issueOverride)
        await get().loadItems()
        logAction('input', 'success', 'Updated custom time entry')
      },

      deleteItem: async (id) => {
        await deleteDdsCustomInput(id)
        await get().loadItems()
        logAction('input', 'success', 'Deleted custom time entry')
      },
    }),
    {
      name: 'custom-inputs-period',
      partialize: (state) => ({
        periodMode: state.periodMode,
        selectedDate: state.selectedDate,
        customStart: state.customStart,
        customEnd: state.customEnd,
      }),
    },
  ),
)

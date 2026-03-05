import { create } from 'zustand'

import type { DdsCustomInput } from '@/lib/duckdb/queries'
import {
  readDdsCustomInputs,
  upsertDdsCustomInputs,
  deleteDdsCustomInput,
  nextTaskRevision,
  customInputToTask,
} from '@/lib/duckdb/queries'
import type { PeriodMode } from '@/store/sources'
import { computePeriod } from '@/store/sources'

const MAX_CUSTOM_DAYS = 92

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string) {
  return Math.abs(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  )
}

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
  getPeriod: () => { start: string; end: string }

  loadItems: () => Promise<void>
  addItem: (item: Omit<DdsCustomInput, 'id'>) => Promise<void>
  updateItem: (item: DdsCustomInput) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

export const useCustomInputsStore = create<CustomInputsState>()((set, get) => ({
  periodMode: 'day',
  selectedDate: todayISO(),
  customStart: null,
  customEnd: null,

  items: [],
  loading: false,

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

  getPeriod: () => computePeriod(get()),

  loadItems: async () => {
    set({ loading: true })
    try {
      const { start, end } = get().getPeriod()
      const items = await readDdsCustomInputs(start, end)
      set({ items })
    } finally {
      set({ loading: false })
    }
  },

  addItem: async (item) => {
    const id = crypto.randomUUID()
    const fullItem: DdsCustomInput = { ...item, id }
    await upsertDdsCustomInputs([fullItem])
    const revision = await nextTaskRevision()
    await customInputToTask(fullItem, revision)
    await get().loadItems()
  },

  updateItem: async (item) => {
    await upsertDdsCustomInputs([item])
    const revision = await nextTaskRevision()
    await customInputToTask(item, revision)
    await get().loadItems()
  },

  deleteItem: async (id) => {
    await deleteDdsCustomInput(id)
    await get().loadItems()
  },
}))

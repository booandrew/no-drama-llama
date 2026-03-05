import { create } from 'zustand'

import type { MapKeywordIssue } from '@/lib/duckdb/queries'
import {
  readMapKeywordIssues,
  upsertMapKeywordIssue,
  deleteMapKeywordIssue,
} from '@/lib/duckdb/queries'

interface MappingsState {
  items: MapKeywordIssue[]
  loading: boolean

  loadItems: () => Promise<void>
  addItem: (item: Omit<MapKeywordIssue, 'id'>) => Promise<void>
  updateItem: (item: MapKeywordIssue) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

export const useMappingsStore = create<MappingsState>()((set, get) => ({
  items: [],
  loading: false,

  loadItems: async () => {
    set({ loading: true })
    try {
      const items = await readMapKeywordIssues()
      set({ items })
    } finally {
      set({ loading: false })
    }
  },

  addItem: async (item) => {
    const id = crypto.randomUUID()
    await upsertMapKeywordIssue({ ...item, id })
    await get().loadItems()
  },

  updateItem: async (item) => {
    await upsertMapKeywordIssue(item)
    await get().loadItems()
  },

  deleteItem: async (id) => {
    await deleteMapKeywordIssue(id)
    await get().loadItems()
  },
}))

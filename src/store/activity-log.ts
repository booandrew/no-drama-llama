import { create } from 'zustand'

export type ActionType =
  | 'sync'
  | 'mapping'
  | 'submit'
  | 'connection'
  | 'input'
  | 'settings'
  | 'export'

export type ActionStatus = 'success' | 'error' | 'info' | 'pending'

export interface LogEntry {
  id: string
  timestamp: Date
  type: ActionType
  status: ActionStatus
  message: string
  details?: string
}

const MAX_ENTRIES = 100

interface ActivityLogState {
  entries: LogEntry[]
  logAction: (
    type: ActionType,
    status: ActionStatus,
    message: string,
    details?: string,
  ) => void
  updateEntry: (id: string, updates: Partial<Pick<LogEntry, 'status' | 'message' | 'details'>>) => void
  clear: () => void
}

export const useActivityLogStore = create<ActivityLogState>()((set) => ({
  entries: [],

  logAction: (type, status, message, details) => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      status,
      message,
      details,
    }
    set((state) => ({
      entries: [...state.entries, entry].slice(-MAX_ENTRIES),
    }))
    return entry.id
  },

  updateEntry: (id, updates) =>
    set((state) => ({
      entries: state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),

  clear: () => set({ entries: [] }),
}))

/** Shorthand for logging from outside React components (e.g. inside Zustand stores) */
export const logAction = (...args: Parameters<ActivityLogState['logAction']>) =>
  useActivityLogStore.getState().logAction(...args)

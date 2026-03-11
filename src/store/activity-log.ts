import { create } from 'zustand'

import {
  insertAuditLogEntry,
  updateAuditLogEntry,
  readAuditLogEntries,
  clearAuditLog,
} from '@/lib/duckdb/queries'

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

const MAX_ENTRIES = 200

// Chain DB writes to guarantee ordering; silently swallow errors
// (DuckDB may not be initialized yet when early logAction calls fire)
let _dbQueue: Promise<void> = Promise.resolve()
function enqueueDb(fn: () => Promise<void>) {
  _dbQueue = _dbQueue.then(fn).catch((e) => {
    if (import.meta.env.DEV) console.warn('[AuditLog] DB write skipped:', e)
  })
}

interface ActivityLogState {
  entries: LogEntry[]
  loaded: boolean
  logAction: (type: ActionType, status: ActionStatus, message: string, details?: string) => string
  updateEntry: (
    id: string,
    updates: Partial<Pick<LogEntry, 'status' | 'message' | 'details'>>,
  ) => void
  clear: () => void
  loadEntries: () => Promise<void>
}

export const useActivityLogStore = create<ActivityLogState>()((set, get) => ({
  entries: [],
  loaded: false,

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
      entries: [entry, ...state.entries].slice(0, MAX_ENTRIES),
    }))
    enqueueDb(() =>
      insertAuditLogEntry({
        id: entry.id,
        type: entry.type,
        status: entry.status,
        message: entry.message,
        details: entry.details,
      }),
    )
    return entry.id
  },

  updateEntry: (id, updates) => {
    set((state) => ({
      entries: state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }))
    enqueueDb(() =>
      updateAuditLogEntry(id, updates as { status?: string; message?: string; details?: string }),
    )
  },

  clear: () => {
    set({ entries: [] })
    enqueueDb(() => clearAuditLog())
  },

  loadEntries: async () => {
    if (get().loaded) return
    try {
      const rows = await readAuditLogEntries(MAX_ENTRIES)
      const entries: LogEntry[] = rows.map((r) => ({
        id: r.id,
        timestamp: new Date(r.timestamp),
        type: r.type as ActionType,
        status: r.status as ActionStatus,
        message: r.message,
        details: r.details ?? undefined,
      }))
      set({ entries, loaded: true })
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[AuditLog] Failed to load from DB:', e)
      set({ loaded: true })
    }
  },
}))

/** Shorthand for logging from outside React components (e.g. inside Zustand stores) */
export const logAction = (...args: Parameters<ActivityLogState['logAction']>) =>
  useActivityLogStore.getState().logAction(...args)

/** Shorthand for updating an existing entry from outside React components */
export const updateLogEntry = (...args: Parameters<ActivityLogState['updateEntry']>) =>
  useActivityLogStore.getState().updateEntry(...args)

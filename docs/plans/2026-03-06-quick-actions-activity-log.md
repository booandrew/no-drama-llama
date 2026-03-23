# Quick Actions — Activity Log Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Quick Actions placeholder with a real-time activity log that records all user actions, displayed as a collapsible card in the right sidebar.

**Architecture:** New Zustand store (`activity-log.ts`) holds in-memory log entries. A `logAction()` utility is called explicitly from existing stores/components. New `QuickActionsCard` component renders collapsed (last 5) and expanded (full overlay) views.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS, shadcn/ui Card, Lucide icons

---

### Task 1: Create Activity Log Store

**Files:**
- Create: `src/store/activity-log.ts`

**Step 1: Create the store file**

```typescript
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
```

**Step 2: Verify it compiles**

Run: `pnpm build`
Expected: No TypeScript errors related to activity-log.ts

**Step 3: Commit**

```bash
git add src/store/activity-log.ts
git commit -m "feat(activity-log): add Zustand store for activity log entries"
```

---

### Task 2: Create QuickActionsCard Component

**Files:**
- Create: `src/components/QuickActionsCard.tsx`

**Step 1: Create the component**

```tsx
import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActivityLogStore, type ActionStatus } from '@/store/activity-log'

function statusIcon(status: ActionStatus) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
    case 'error':
      return <XCircle className="size-3.5 shrink-0 text-red-500" />
    case 'info':
      return <Info className="size-3.5 shrink-0 text-blue-500" />
    case 'pending':
      return <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-500" />
  }
}

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}

export function QuickActionsCard() {
  const entries = useActivityLogStore((s) => s.entries)
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [, setTick] = useState(0)

  // Update relative times every 30s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length])

  const visibleEntries = expanded ? entries : entries.slice(-5)

  if (!expanded) {
    return (
      <Card className="flex-1 gap-0 py-0">
        <CardHeader className="shrink-0 px-4 py-3">
          <div className="flex items-center justify-between">
            <CardTitle>Quick Actions</CardTitle>
            <button
              onClick={() => setExpanded(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Expand activity log"
            >
              <Maximize2 className="size-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No actions yet — start by connecting an integration.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {visibleEntries.map((entry) => (
                <li key={entry.id} className="flex items-start gap-2 text-xs">
                  {statusIcon(entry.status)}
                  <span className="min-w-0 flex-1 truncate">{entry.message}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {timeAgo(entry.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="absolute inset-0 z-10 flex flex-col gap-0 py-0">
      <CardHeader className="shrink-0 px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle>Quick Actions</CardTitle>
          <button
            onClick={() => setExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Collapse activity log"
          >
            <Minimize2 className="size-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-3">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No actions yet — start by connecting an integration.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2 text-xs">
                {statusIcon(entry.status)}
                <span className="min-w-0 flex-1">{entry.message}</span>
                <span className="shrink-0 text-muted-foreground">
                  {timeAgo(entry.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 2: Verify it compiles**

Run: `pnpm build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/QuickActionsCard.tsx
git commit -m "feat(activity-log): add QuickActionsCard component with expand/collapse"
```

---

### Task 3: Wire QuickActionsCard into App.tsx

**Files:**
- Modify: `src/App.tsx:1-8` (imports)
- Modify: `src/App.tsx:241-253` (right sidebar)

**Step 1: Replace placeholder with component**

In `src/App.tsx`, add import:
```typescript
import { QuickActionsCard } from '@/components/QuickActionsCard'
```

Replace the right sidebar section (lines 241-253):
```tsx
{/* Right sidebar */}
<div className="relative flex flex-col gap-4">
  <SummaryCard />
  <QuickActionsCard />
</div>
```

The key change: add `relative` to the parent `div` so the expanded overlay positions against the sidebar column.

**Step 2: Verify it compiles and renders**

Run: `pnpm build`
Run: `pnpm dev` — check the right sidebar shows "Quick Actions" card with empty state

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(activity-log): wire QuickActionsCard into right sidebar"
```

---

### Task 4: Add logAction calls to calendar.ts

**Files:**
- Modify: `src/store/calendar.ts:98-146` (fetchEvents)

**Step 1: Add log calls**

Add import at top of `calendar.ts`:
```typescript
import { logAction } from '@/store/activity-log'
```

In `fetchEvents()`:
- After `set({ eventsLoading: true })` (line 105), add:
  ```typescript
  logAction('sync', 'pending', 'Syncing Google Calendar...')
  ```
- After `set({ events: allEvents, eventsLoading: false })` (line 141), add:
  ```typescript
  logAction('sync', 'success', `Synced ${allEvents.length} events from Google Calendar`)
  ```
- In the 401 handler (after line 131), add:
  ```typescript
  logAction('sync', 'error', 'Google Calendar token expired')
  ```
- In the catch block (after line 143), add:
  ```typescript
  logAction('sync', 'error', 'Failed to sync Google Calendar')
  ```

**Step 2: Verify it compiles**

Run: `pnpm build`

**Step 3: Commit**

```bash
git add src/store/calendar.ts
git commit -m "feat(activity-log): add log calls to calendar store"
```

---

### Task 5: Add logAction calls to jira.ts

**Files:**
- Modify: `src/store/jira.ts`

**Step 1: Add log calls**

Add import at top:
```typescript
import { logAction } from '@/store/activity-log'
```

In `exchangeCode()`:
- After `set({ status: 'loading' })` (line 129): `logAction('connection', 'pending', 'Connecting to Jira...')`
- After successful set (line 184): `logAction('connection', 'success', 'Connected to Jira via OAuth')`
- In catch (line 186): `logAction('connection', 'error', 'Failed to connect to Jira')`

In `connectWithToken()`:
- After `set({ status: 'loading' })` (line 230): `logAction('connection', 'pending', 'Connecting to Jira...')`
- After successful set (line 253): `logAction('connection', 'success', 'Connected to Jira via API token')`
- In catch (line 255): `logAction('connection', 'error', 'Failed to connect to Jira')`

In `loadAll()`:
- After `set({ loading: true })` (line 271): `logAction('sync', 'pending', 'Syncing Jira issues...')`
- After `set({ issues, loading: false })` (line 274): `logAction('sync', 'success', \`Loaded ${issues.length} Jira issues\`)`
- In catch (line 276): `logAction('sync', 'error', 'Failed to sync Jira issues')`

In `disconnect()` (line 75): `logAction('connection', 'info', 'Disconnected from Jira')`

**Step 2: Verify it compiles**

Run: `pnpm build`

**Step 3: Commit**

```bash
git add src/store/jira.ts
git commit -m "feat(activity-log): add log calls to Jira store"
```

---

### Task 6: Add logAction calls to remaining stores

**Files:**
- Modify: `src/store/custom-inputs.ts`
- Modify: `src/store/app.ts`
- Modify: `src/store/tempo.ts`
- Modify: `src/store/mappings.ts`

**Step 1: custom-inputs.ts**

Add import: `import { logAction } from '@/store/activity-log'`

- In `addItem()`, after `await get().loadItems()`: `logAction('input', 'success', 'Added custom time entry')`
- In `updateItem()`, after `await get().loadItems()`: `logAction('input', 'success', 'Updated custom time entry')`
- In `deleteItem()`, after `await get().loadItems()`: `logAction('input', 'success', 'Deleted custom time entry')`

**Step 2: app.ts**

Add import: `import { logAction } from '@/store/activity-log'`

- In `toggleMockMode()`, after `set(...)`:
  ```typescript
  toggleMockMode: () =>
    set((state) => {
      const next = !state.isMockMode
      logAction('settings', 'info', next ? 'Switched to mock data' : 'Switched to real data')
      return { isMockMode: next }
    }),
  ```

**Step 3: tempo.ts**

Add import: `import { logAction } from '@/store/activity-log'`

- In `setToken()` or equivalent connect method: `logAction('connection', 'success', 'Connected to Tempo')`
- In `disconnect()`: `logAction('connection', 'info', 'Disconnected from Tempo')`

**Step 4: mappings.ts**

Add import: `import { logAction } from '@/store/activity-log'`

- In `addItem()`: `logAction('mapping', 'success', 'Added new mapping rule')`
- In `updateItem()`: `logAction('mapping', 'success', 'Updated mapping rule')`
- In `deleteItem()`: `logAction('mapping', 'success', 'Deleted mapping rule')`

**Step 5: Verify it compiles**

Run: `pnpm build`

**Step 6: Commit**

```bash
git add src/store/custom-inputs.ts src/store/app.ts src/store/tempo.ts src/store/mappings.ts
git commit -m "feat(activity-log): add log calls to custom-inputs, app, tempo, mappings stores"
```

---

### Task 7: Final verification

**Step 1: Build check**

Run: `pnpm build`
Expected: Clean build with no errors

**Step 2: Lint check**

Run: `pnpm lint`
Expected: No lint errors

**Step 3: Manual smoke test**

Run: `pnpm dev`
Verify:
- Quick Actions card shows in right sidebar with empty state
- Expand/collapse button works (overlay covers SummaryCard)
- Toggling mock mode adds an entry to the log
- Entries show status icon, message, and relative time

**Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(activity-log): address lint/build issues"
```

# No Drama Llama — Feature Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement features from v0.2 through v0.4 of the No Drama Llama roadmap — completing the core time logging loop, Jira submission, diff view, audit log, and export.

**Architecture:** Feature-by-feature incremental delivery. Each task produces a working, committable unit. Data flows through DuckDB-WASM (schema.ts → queries.ts → Zustand stores → React components). New tables follow the existing `map_*` / `submit_*` naming convention.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4, shadcn/ui (New York), Zustand, DuckDB-WASM, Apache Arrow, Cloudflare Pages, date-fns, lucide-react, sonner.

**Spec:** `docs/superpowers/specs/2026-03-25-feature-release-roadmap-design.md`

**Code style:** No semicolons, single quotes, trailing commas, 100 char width, 2-space indent. Path alias `@/*` → `./src/*`.

**DuckDB query conventions:** All queries in `queries.ts` use the `exec()` helper (lines 6-11) which wraps `getConnection()` and forces a checkpoint after mutations. All interpolated values MUST use `escSql()` (lines 13-18) to prevent SQL injection. Never use raw `getDb()` or `db.query()` — these do not exist in this codebase.

---

## File Structure Overview

### New files to create

| File | Purpose |
|------|---------|
| `src/components/AddLogFab.tsx` | Floating Action Button for "Add Log" — always visible |
| `src/components/AddLogModal.tsx` | Universal add-log modal with context-aware pre-fill |
| `src/components/MappingOverridesSection.tsx` | Manual overrides table within Mappings tab |
| `src/components/MappingSuggestionsSection.tsx` | AI fuzzy-match suggestions within Mappings tab |
| `src/components/SubmitReviewDialog.tsx` | Pre-submit review screen with validation |
| `src/components/SubmitProgressDialog.tsx` | Submission progress + success/failure summary |
| `src/components/DiffView.tsx` | Difference view — summary table + drill-down |
| `src/components/DiffDetailRow.tsx` | Expandable row for diff drill-down |
| `src/components/TimesheetHistoryTab.tsx` | Historical submitted months viewer |
| `src/components/ExportButton.tsx` | Export toolbar button with format picker |
| `src/store/submit.ts` | Zustand store for submit flow state |
| `src/store/diff.ts` | Zustand store for diff view state |
| `src/lib/fuzzy-match.ts` | String similarity utilities for AI suggestions |
| `src/lib/export.ts` | CSV/JSON export utilities |

### Existing files to modify

| File | Changes |
|------|---------|
| `src/lib/duckdb/schema.ts` | Add `map_hidden_events`, `map_event_issue_override`, `submit_history` tables; bump SCHEMA_VERSION |
| `src/lib/duckdb/queries.ts` | Add CRUD for new tables: hidden events, overrides, submit history, diff queries |
| `src/components/calendar-views/EventBlock.tsx` | Add hide/show eye toggle icon |
| `src/components/LlamaTimeTab.tsx` | Add "Show hidden" toolbar toggle, integrate FAB, add diff view entry point |
| `src/components/CustomInputForm.tsx` | Extend with Jira issue searchable dropdown |
| `src/components/MappingsTab.tsx` | Add Overrides and AI Suggestions sections |
| `src/store/mappings.ts` | Add override CRUD methods, suggestion methods |
| `src/store/tasks.ts` | Add hidden event filtering logic |
| `src/store/app.ts` | Add `Tab` union member for diff view; add `showHidden` toggle |
| `src/store/activity-log.ts` | Track submit events, diff actions |
| `src/lib/jira.ts` | Add `createWorklog()` function for submit flow |
| `src/lib/tempo.ts` | Add `createTempoWorklog()` function for submit flow |
| `src/App.tsx` | Register new tabs (diff view, timesheet history), mount FAB |

---

## Phase 1: v0.2 — Core Logging Loop

---

### Task 1: Schema — Add `map_hidden_events` table

**Files:**
- Modify: `src/lib/duckdb/schema.ts` (SCHEMA_VERSION constant at top, new table after `map_keyword_issue` block)
- Modify: `src/lib/duckdb/queries.ts` (add CRUD functions after mappings section)

- [ ] **Step 1: Add table to schema.ts**

In `src/lib/duckdb/schema.ts`, after the `map_keyword_issue` CREATE TABLE block, add:

```typescript
CREATE TABLE IF NOT EXISTS map_hidden_events (
  event_id VARCHAR PRIMARY KEY,
  hidden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Bump `SCHEMA_VERSION` at the top of the file (increment by 1 from current value). All schema tasks (1, 9, 15) add tables — since `CREATE TABLE IF NOT EXISTS` is idempotent, the version bump is a signal for cache invalidation, not a migration gate.

- [ ] **Step 2: Add query functions in queries.ts**

In `src/lib/duckdb/queries.ts`, add after the mappings section (after the mappings section):

```typescript
// --- Hidden Events ---

export async function readHiddenEventIds(): Promise<string[]> {
  const result = await exec('SELECT event_id FROM map_hidden_events')
  return result.toArray().map((r: { event_id: string }) => r.event_id)
}

export async function hideEvent(eventId: string): Promise<void> {
  await exec(`INSERT OR REPLACE INTO map_hidden_events (event_id) VALUES (${escSql(eventId)})`)
}

export async function unhideEvent(eventId: string): Promise<void> {
  await exec(`DELETE FROM map_hidden_events WHERE event_id = ${escSql(eventId)}`)
}
```

- [ ] **Step 3: Verify schema runs without errors**

Run: `pnpm dev` — open browser, check console for DuckDB init errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/duckdb/schema.ts src/lib/duckdb/queries.ts
git commit -m "feat: add map_hidden_events table and queries"
```

---

### Task 2: Store — Hidden events state in tasks store

**Files:**
- Modify: `src/store/tasks.ts` (extend TasksState interface, add methods to store body)

- [ ] **Step 1: Extend TasksState interface**

In `src/store/tasks.ts`, add to the interface:

```typescript
hiddenEventIds: string[]
loadHiddenEvents: () => Promise<void>
toggleHideEvent: (eventId: string) => Promise<void>
isHidden: (eventId: string) => boolean
```

**Note:** Use `string[]` instead of `Set<string>` for Zustand compatibility (devtools, equality checks). Add helper `isHidden` that wraps `.includes()` for convenience.

- [ ] **Step 2: Implement methods in store**

In the store `create` body, add:

```typescript
hiddenEventIds: [],

isHidden: (eventId: string) => get().hiddenEventIds.includes(eventId),

loadHiddenEvents: async () => {
  const ids = await readHiddenEventIds()
  set({ hiddenEventIds: ids })
},

toggleHideEvent: async (eventId: string) => {
  const { hiddenEventIds } = get()
  if (hiddenEventIds.includes(eventId)) {
    await unhideEvent(eventId)
    set({ hiddenEventIds: hiddenEventIds.filter((id) => id !== eventId) })
  } else {
    await hideEvent(eventId)
    set({ hiddenEventIds: [...hiddenEventIds, eventId] })
  }
},
```

**Note:** The store creation must include `get` in the argument list: `create<TasksState>()((set, get) => ({...}))`. Check if the existing store already destructures `get` — if not, add it.

- [ ] **Step 3: Call `loadHiddenEvents()` alongside `loadTasks()`**

In `loadTasks()` method (~line 37), add `await readHiddenEventIds()` call and update hiddenEventIds.

- [ ] **Step 4: Commit**

```bash
git add src/store/tasks.ts
git commit -m "feat: add hidden events state and toggle to tasks store"
```

---

### Task 3: Store — Add `showHidden` toggle to app store

**Files:**
- Modify: `src/store/app.ts`

- [ ] **Step 1: Add showHidden to AppState**

```typescript
showHidden: boolean
setShowHidden: (show: boolean) => void
```

- [ ] **Step 2: Add implementation**

In the store create body, add:
```typescript
showHidden: false,
setShowHidden: (show) => set({ showHidden: show }),
```

- [ ] **Step 3: Commit**

```bash
git add src/store/app.ts
git commit -m "feat: add showHidden toggle to app store"
```

---

### Task 4: UI — Eye toggle on EventBlock

**Note:** `EventBlock` is the shared component used across all calendar views (month, week, day, list). Modifying it here applies the toggle everywhere.

**Files:**
- Modify: `src/components/calendar-views/EventBlock.tsx`

- [ ] **Step 1: Import dependencies**

Add to EventBlock.tsx imports:
```typescript
import { Eye, EyeOff } from 'lucide-react'
import { useTasksStore } from '@/store/tasks'
import { useAppStore } from '@/store/app'
```

- [ ] **Step 2: Add hide toggle button**

Inside the EventBlock component, read from stores:
```typescript
const isHidden = useTasksStore((s) => s.isHidden(task.source_id || task.task_id))
const toggleHideEvent = useTasksStore((s) => s.toggleHideEvent)
const showHidden = useAppStore((s) => s.showHidden)
```

If `isHidden && !showHidden`, return `null` (don't render).

If `isHidden && showHidden`, apply `opacity-40` class.

Add eye toggle button (on hover) to the event block:
```tsx
<button
  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10"
  onClick={(e) => {
    e.stopPropagation()
    toggleHideEvent(task.source_id || task.task_id)
  }}
>
  {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
</button>
```

Add `group` and `relative` to the outer element's className.

- [ ] **Step 3: Exclude hidden events from duration calculations**

In `LlamaTimeTab.tsx` and `LlamaSidebar` (where total hours are computed), filter out tasks whose IDs are in `hiddenEventIds` before summing durations. Also in `SummaryCard`, exclude hidden events from project/issue hour aggregation.

- [ ] **Step 4: Verify in browser**

Run `pnpm dev`, navigate to calendar, hover over an event — eye icon should appear. Click to hide. Event disappears.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar-views/EventBlock.tsx src/components/LlamaTimeTab.tsx src/App.tsx
git commit -m "feat: add hide/show toggle on calendar events"
```

---

### Task 5: UI — "Show hidden" toolbar toggle

**Files:**
- Modify: `src/components/LlamaTimeTab.tsx` (LlamaTimeToolbar section)

- [ ] **Step 1: Add toggle to toolbar**

In `LlamaTimeToolbar`, import:
```typescript
import { Eye, EyeOff } from 'lucide-react'
```

Read from store:
```typescript
const showHidden = useAppStore((s) => s.showHidden)
const setShowHidden = useAppStore((s) => s.setShowHidden)
const hiddenCount = useTasksStore((s) => s.hiddenEventIds.length)
```

Add toggle button in toolbar (near sync button area):
```tsx
{hiddenCount > 0 && (
  <Button
    variant={showHidden ? 'secondary' : 'ghost'}
    size="sm"
    onClick={() => setShowHidden(!showHidden)}
    className="gap-1.5"
  >
    {showHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    {hiddenCount} hidden
  </Button>
)}
```

- [ ] **Step 2: Verify in browser**

Hide 2+ events. Toolbar shows "2 hidden" button. Toggle reveals/hides greyed-out events.

- [ ] **Step 3: Commit**

```bash
git add src/components/LlamaTimeTab.tsx
git commit -m "feat: add show-hidden toggle to toolbar"
```

---

### Task 6: Add Log — Create AddLogModal component

**Files:**
- Create: `src/components/AddLogModal.tsx`
- Reference: `src/components/CustomInputForm.tsx` (reuse pattern)

- [ ] **Step 1: Create AddLogModal**

Create `src/components/AddLogModal.tsx`. This extends the CustomInputForm pattern with a Jira issue searchable dropdown.

```typescript
// Props:
interface AddLogModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefillDate?: string    // YYYY-MM-DD
  prefillTime?: string    // HH:MM
}
```

Use `@ui-ux-pro-max`, `@frontend-design` skills during implementation for the modal design.

Modal fields:
1. **Description** — text input
2. **Duration** — number input (hours, step 0.25)
3. **Date** — date picker, pre-filled from `prefillDate` or today
4. **Time** — time picker, pre-filled from `prefillTime` or current time
5. **Jira Issue** — searchable combobox using shadcn `Command` + `Popover`, populated from `useTasksStore.issues`

On save: calls `useTasksStore.addTask()` with the assembled DdsTask.

- [ ] **Step 2: Verify modal opens and saves**

Import into any view, render with `open={true}`. Fill form, save. Check DuckDB for new task.

- [ ] **Step 3: Commit**

```bash
git add src/components/AddLogModal.tsx
git commit -m "feat: create AddLogModal with issue search"
```

---

### Task 7: Add Log — Create FAB component

**Files:**
- Create: `src/components/AddLogFab.tsx`
- Modify: `src/App.tsx` (mount FAB)

- [ ] **Step 1: Create AddLogFab**

Create `src/components/AddLogFab.tsx`:
```tsx
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AddLogModal } from './AddLogModal'

export function AddLogFab() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>
      <AddLogModal open={open} onOpenChange={setOpen} />
    </>
  )
}
```

- [ ] **Step 2: Mount FAB in App.tsx**

In `src/App.tsx`, import `AddLogFab` and render it inside the main app layout, after tab content. It should be visible on all tabs except landing page.

- [ ] **Step 3: Verify FAB appears and opens modal**

Run `pnpm dev`. FAB visible bottom-right on all views. Click opens modal.

- [ ] **Step 4: Commit**

```bash
git add src/components/AddLogFab.tsx src/App.tsx
git commit -m "feat: add floating action button for quick log entry"
```

---

### Task 8: Add Log — Context-aware triggers in calendar views

**Files:**
- Modify: `src/components/calendar-views/MonthCalendarView.tsx` (add "+" button per cell)
- Modify: `src/components/calendar-views/WeekCalendarView.tsx` (click empty space)
- Modify: `src/components/calendar-views/DayCalendarView.tsx` (click empty space)

- [ ] **Step 1: Add state for AddLogModal in LlamaTimeTab**

In `LlamaTimeTab.tsx`, add state:
```typescript
const [addLogOpen, setAddLogOpen] = useState(false)
const [addLogPrefill, setAddLogPrefill] = useState<{ date?: string, time?: string }>({})
```

Pass `onAddLog={(date, time) => { setAddLogPrefill({ date, time }); setAddLogOpen(true) }}` to each calendar view.

- [ ] **Step 2: Month view — "+" button**

In `MonthCalendarView.tsx`, add a small "+" button in each day cell header. On click, calls `onAddLog(cellDate)`.

- [ ] **Step 3: Week/Day views — click empty space**

In `WeekCalendarView.tsx` and `DayCalendarView.tsx`, add `onClick` handler on the hourly grid background. Calculate the clicked hour from mouse position. Call `onAddLog(date, timeFromHour)`.

- [ ] **Step 4: List/Timeline view — "Add Log" row per day group**

In `TimelineChart.tsx` (the list view), add an "Add Log" row at the bottom of each day group. On click, calls `onAddLog(dayDate)` with the group's date.

- [ ] **Step 5: Verify context-aware pre-fill**

Click "+" on March 15 month cell → modal opens with date=2026-03-15. Click 14:00 slot in day view → modal opens with date+time pre-filled. List view "Add Log" row opens modal with date pre-filled.

- [ ] **Step 6: Commit**

```bash
git add src/components/LlamaTimeTab.tsx src/components/calendar-views/MonthCalendarView.tsx src/components/calendar-views/WeekCalendarView.tsx src/components/calendar-views/DayCalendarView.tsx src/components/TimelineChart.tsx
git commit -m "feat: context-aware add-log triggers in all calendar views"
```

---

### Task 9: Schema — Add `map_event_issue_override` table

**Files:**
- Modify: `src/lib/duckdb/schema.ts` (add table after map_hidden_events)
- Modify: `src/lib/duckdb/queries.ts` (add CRUD)

- [ ] **Step 1: Add table to schema.ts**

```sql
CREATE TABLE IF NOT EXISTS map_event_issue_override (
  event_name_pattern VARCHAR NOT NULL,
  issue_key VARCHAR NOT NULL,
  issue_name VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_name_pattern, issue_key)
);
```

- [ ] **Step 2: Add query functions**

```typescript
export interface EventIssueOverride {
  event_name_pattern: string
  issue_key: string
  issue_name: string | null
  created_at: string
}

export async function readEventIssueOverrides(): Promise<EventIssueOverride[]> {
  const result = await exec('SELECT * FROM map_event_issue_override ORDER BY created_at DESC')
  return result.toArray() as EventIssueOverride[]
}

export async function upsertEventIssueOverride(
  pattern: string,
  issueKey: string,
  issueName?: string,
): Promise<void> {
  await exec(`
    INSERT OR REPLACE INTO map_event_issue_override
    (event_name_pattern, issue_key, issue_name)
    VALUES (${escSql(pattern)}, ${escSql(issueKey)}, ${issueName ? escSql(issueName) : 'NULL'})
  `)
}

export async function deleteEventIssueOverride(
  pattern: string,
  issueKey: string,
): Promise<void> {
  await exec(`
    DELETE FROM map_event_issue_override
    WHERE event_name_pattern = ${escSql(pattern)} AND issue_key = ${escSql(issueKey)}
  `)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/duckdb/schema.ts src/lib/duckdb/queries.ts
git commit -m "feat: add map_event_issue_override table and queries"
```

---

### Task 10: Store — Extend mappings store with overrides

**Files:**
- Modify: `src/store/mappings.ts`

- [ ] **Step 1: Extend MappingsState**

Add to the interface:
```typescript
overrides: EventIssueOverride[]
loadOverrides: () => Promise<void>
addOverride: (pattern: string, issueKey: string, issueName?: string) => Promise<void>
deleteOverride: (pattern: string, issueKey: string) => Promise<void>
```

- [ ] **Step 2: Implement methods**

```typescript
overrides: [],

loadOverrides: async () => {
  const overrides = await readEventIssueOverrides()
  set({ overrides })
},

addOverride: async (pattern, issueKey, issueName) => {
  await upsertEventIssueOverride(pattern, issueKey, issueName)
  await get().loadOverrides()
  logAction('mapping', 'success', `Added override: "${pattern}" → ${issueKey}`)
},

deleteOverride: async (pattern, issueKey) => {
  await deleteEventIssueOverride(pattern, issueKey)
  await get().loadOverrides()
  logAction('mapping', 'success', `Removed override: "${pattern}" → ${issueKey}`)
},
```

- [ ] **Step 3: Load overrides in loadItems**

In the existing `loadItems()` method, also call `loadOverrides()`.

- [ ] **Step 4: Commit**

```bash
git add src/store/mappings.ts
git commit -m "feat: add override CRUD to mappings store"
```

---

### Task 11: UI — Mapping Overrides section

**Files:**
- Create: `src/components/MappingOverridesSection.tsx`
- Modify: `src/components/MappingsTab.tsx`

- [ ] **Step 1: Create MappingOverridesSection**

Component shows a table of manual overrides with columns: Event Pattern | Issue Key | Issue Name | Actions (delete).

Uses `useMappingsStore` for `overrides`, `deleteOverride`.

Table follows the same pattern as the existing mapping table in `MappingsTab.tsx` (Card + Table from shadcn).

- [ ] **Step 2: Integrate into MappingsTab**

In `MappingsTab.tsx`, add the overrides section below the existing rules section:

```tsx
<MappingOverridesSection />
```

Add section headers: "Keyword Rules" for existing section, "Manual Overrides" for new section.

- [ ] **Step 3: Verify overrides display**

Manually insert a test override via DuckDB console. Navigate to Mappings tab. Override should appear in the new section.

- [ ] **Step 4: Commit**

```bash
git add src/components/MappingOverridesSection.tsx src/components/MappingsTab.tsx
git commit -m "feat: add manual overrides section to mappings tab"
```

---

### Task 12: Add fuzzy matching utility

**Files:**
- Create: `src/lib/fuzzy-match.ts`

- [ ] **Step 1: Create fuzzy-match.ts**

Implement trigram-based string similarity (no external dependencies):

```typescript
export function trigrams(str: string): Set<string> {
  const normalized = str.toLowerCase().trim()
  const padded = `  ${normalized} `
  const result = new Set<string>()
  for (let i = 0; i < padded.length - 2; i++) {
    result.add(padded.slice(i, i + 3))
  }
  return result
}

export function similarity(a: string, b: string): number {
  const triA = trigrams(a)
  const triB = trigrams(b)
  const intersection = new Set([...triA].filter((t) => triB.has(t)))
  const union = new Set([...triA, ...triB])
  return union.size === 0 ? 0 : intersection.size / union.size
}

export interface SuggestionMatch {
  eventName: string
  issueKey: string
  issueName: string
  confidence: number
}

export function suggestMappings(
  unmappedEventNames: string[],
  issues: Array<{ issue_key: string; issue_name: string }>,
  threshold = 0.3,
): SuggestionMatch[] {
  const results: SuggestionMatch[] = []
  for (const eventName of unmappedEventNames) {
    let best: SuggestionMatch | null = null
    for (const issue of issues) {
      const score = similarity(eventName, issue.issue_name)
      if (score >= threshold && (!best || score > best.confidence)) {
        best = {
          eventName,
          issueKey: issue.issue_key,
          issueName: issue.issue_name,
          confidence: score,
        }
      }
    }
    if (best) results.push(best)
  }
  return results.sort((a, b) => b.confidence - a.confidence)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fuzzy-match.ts
git commit -m "feat: add trigram fuzzy matching for event→issue suggestions"
```

---

### Task 13: UI — AI Suggestions section in Mappings

**Files:**
- Create: `src/components/MappingSuggestionsSection.tsx`
- Modify: `src/components/MappingsTab.tsx`

- [ ] **Step 1: Create MappingSuggestionsSection**

Component that:
1. Reads unmapped event names from tasks store (tasks where `source === 'gcal'` and `issue_key` is null)
2. Reads issues from tasks store
3. On "Suggest Mappings" button click, calls `suggestMappings()` from `@/lib/fuzzy-match`
4. Shows results as a list: event name | suggested issue (key + name) | confidence bar | approve / reject buttons
5. Approve calls `useMappingsStore.addOverride(eventName, issueKey, issueName)`

```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center justify-between">
      AI Suggestions
      <Button size="sm" onClick={handleSuggest} disabled={unmappedCount === 0}>
        <Sparkles className="mr-2 h-4 w-4" />
        Suggest Mappings ({unmappedCount} unmapped)
      </Button>
    </CardTitle>
  </CardHeader>
  <CardContent>
    {suggestions.map((s) => (
      <div key={s.eventName} className="flex items-center justify-between py-2 border-b">
        <div>
          <span className="font-medium">{s.eventName}</span>
          <span className="mx-2 text-muted-foreground">→</span>
          <span>{s.issueKey} {s.issueName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{Math.round(s.confidence * 100)}%</span>
          <Button size="sm" variant="ghost" onClick={() => handleApprove(s)}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleReject(s)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    ))}
  </CardContent>
</Card>
```

- [ ] **Step 2: Add to MappingsTab**

Below overrides section, add:
```tsx
<MappingSuggestionsSection />
```

- [ ] **Step 3: Verify end-to-end**

Have unmapped gcal events + Jira issues loaded. Click "Suggest Mappings". See suggestions. Approve one. It appears in overrides.

- [ ] **Step 4: Commit**

```bash
git add src/components/MappingSuggestionsSection.tsx src/components/MappingsTab.tsx
git commit -m "feat: add AI fuzzy-match suggestions to mappings tab"
```

---

### Task 14: Integration — Apply overrides during task loading

**Files:**
- Modify: `src/lib/duckdb/queries.ts` (extend `applyKeywordMappings` or add parallel function)

- [ ] **Step 1: Add `applyOverrideMappings()` function**

In `queries.ts`, after `applyKeywordMappings()`, add an **in-memory** function matching the same pattern (operates on the tasks array before DB write, not as a SQL UPDATE):

```typescript
export async function applyOverrideMappings(tasks: DdsTask[]): Promise<number> {
  const overrides = await readEventIssueOverrides()
  if (overrides.length === 0) return 0
  let matched = 0
  for (const task of tasks) {
    if (task.issue_key) continue // already mapped
    const override = overrides.find(
      (o) => o.event_name_pattern.toLowerCase() === task.description.toLowerCase(),
    )
    if (override) {
      task.issue_key = override.issue_key
      task.issue_name = override.issue_name ?? task.issue_name
      matched++
    }
  }
  return matched
}
```

**Important:** This follows the same pattern as `applyKeywordMappings()` — it mutates the in-memory `tasks[]` array *before* they are written to DuckDB by `upsertDdsTasks()`.

- [ ] **Step 2: Call in `upsertTasksWithMappings()`**

In the existing `upsertTasksWithMappings()` function, add a call to `applyOverrideMappings(tasks)` after `applyKeywordMappings(tasks)` and before `upsertDdsTasks()`.

- [ ] **Step 3: Verify mapping auto-applies**

Create an override for event name "Daily Standup" → PROJ-123. Sync calendar events. A "Daily Standup" event should now show as mapped.

- [ ] **Step 4: Commit**

```bash
git add src/lib/duckdb/queries.ts
git commit -m "feat: apply override mappings during task loading"
```

---

## Phase 2: v0.3 — Close the Loop

---

### Task 15: Schema — Add `submit_history` table

**Files:**
- Modify: `src/lib/duckdb/schema.ts`
- Modify: `src/lib/duckdb/queries.ts`

- [ ] **Step 1: Add table to schema**

```sql
CREATE TABLE IF NOT EXISTS submit_history (
  submit_id VARCHAR PRIMARY KEY,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  target VARCHAR NOT NULL,
  worklog_count INTEGER,
  total_hours DOUBLE,
  status VARCHAR DEFAULT 'submitted'
);
```

Bump `SCHEMA_VERSION` (increment from current value).

- [ ] **Step 2: Add query functions**

```typescript
export interface SubmitRecord {
  submit_id: string
  period_year: number
  period_month: number
  submitted_at: string
  target: string
  worklog_count: number
  total_hours: number
  status: string
}

export async function insertSubmitRecord(record: SubmitRecord): Promise<void> { ... }
export async function updateSubmitStatus(submitId: string, status: string): Promise<void> { ... }
export async function readSubmitHistory(year?: number, month?: number): Promise<SubmitRecord[]> { ... }
export async function getLatestSubmitForPeriod(year: number, month: number): Promise<SubmitRecord | null> { ... }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/duckdb/schema.ts src/lib/duckdb/queries.ts
git commit -m "feat: add submit_history table and queries"
```

---

### Task 16: API — Add worklog creation to Jira client

**Files:**
- Modify: `src/lib/jira.ts`

- [ ] **Step 1: Add `createWorklog()` function**

After `fetchIssues()` (after `fetchIssues()`):

```typescript
export async function createJiraWorklog(
  issueKey: string,
  started: string,      // ISO datetime
  timeSpentSeconds: number,
  comment?: string,
): Promise<{ id: string }> {
  const store = useJiraStore.getState()
  const base = getBase(store)
  const res = await fetch(`${base}/rest/api/3/issue/${issueKey}/worklog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      started: formatJiraDateTime(started),
      timeSpentSeconds,
      comment: comment ? { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }] } : undefined,
    }),
  })
  if (!res.ok) throw new Error(`Jira worklog creation failed: ${res.status}`)
  return res.json()
}
```

Add helper `formatJiraDateTime()` that converts ISO to Jira's expected format.

- [ ] **Step 2: Commit**

```bash
git add src/lib/jira.ts
git commit -m "feat: add createJiraWorklog to Jira API client"
```

---

### Task 17: API — Add worklog creation to Tempo client

**Files:**
- Modify: `src/lib/tempo.ts`

- [ ] **Step 1: Add `createTempoWorklog()` function**

After `fetchTempoWorklogs()` (after `fetchTempoWorklogs()`):

```typescript
export async function createTempoWorklog(
  issueKey: string,
  started: string,       // YYYY-MM-DD
  timeSpentSeconds: number,
  description?: string,
): Promise<{ tempoWorklogId: number }> {
  const accountId = useJiraStore.getState().accountId
  const res = await fetch('/tempo-api/4/worklogs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issueKey,
      timeSpentSeconds,
      startDate: started,
      startTime: '09:00:00',
      authorAccountId: accountId,
      description,
    }),
  })
  if (!res.ok) throw new Error(`Tempo worklog creation failed: ${res.status}`)
  return res.json()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/tempo.ts
git commit -m "feat: add createTempoWorklog to Tempo API client"
```

---

### Task 18: Store — Create submit store

**Files:**
- Create: `src/store/submit.ts`

- [ ] **Step 1: Create submit store**

```typescript
import { create } from 'zustand'

type SubmitTarget = 'tempo' | 'jira'
type SubmitPhase = 'idle' | 'review' | 'submitting' | 'done'

interface SubmitItem {
  taskId: string
  issueKey: string
  issueName: string
  date: string
  durationSeconds: number
  description: string
  selected: boolean
  status: 'pending' | 'success' | 'error'
  error?: string
}

interface SubmitState {
  phase: SubmitPhase
  target: SubmitTarget
  items: SubmitItem[]
  progress: { done: number; total: number }

  setTarget: (target: SubmitTarget) => void
  openReview: (items: SubmitItem[]) => void
  toggleItem: (taskId: string) => void
  toggleAll: (selected: boolean) => void
  submitSelected: () => Promise<void>
  reset: () => void
}
```

`submitSelected()` iterates over selected items, calls `createJiraWorklog` or `createTempoWorklog` based on target, updates progress, records result per item, creates `submit_history` record at the end.

- [ ] **Step 2: Commit**

```bash
git add src/store/submit.ts
git commit -m "feat: create submit store with review and progress tracking"
```

---

### Task 19: UI — Submit Review Dialog

**Files:**
- Create: `src/components/SubmitReviewDialog.tsx`

- [ ] **Step 1: Create SubmitReviewDialog**

A dialog that shows:
1. **Target selector** — dropdown: "Tempo" / "Jira REST" (auto-detected default)
2. **Validation banner** — if unmapped tasks exist: "{N} unmapped tasks — assign issues before submitting"
3. **Review table** — grouped by issue: checkbox | issue key | issue name | total hours | worklog count | date range. Color: green (ready), red (unmapped)
4. **Footer** — "Submit {N} worklogs ({X}h total)" button, disabled if any selected items are unmapped

Uses `useSubmitStore` for state.

- [ ] **Step 2: Wire to toolbar button**

In `LlamaTimeTab.tsx`, the existing disabled "Submit to JIRA" button should now open `SubmitReviewDialog`. Remove the `disabled` attribute. Add onClick handler that:
1. Collects all mapped tasks for the current period, **excluding hidden events** (filter out IDs in `hiddenEventIds`)
2. Converts to SubmitItem[]
3. Calls `useSubmitStore.openReview(items)`

- [ ] **Step 3: Commit**

```bash
git add src/components/SubmitReviewDialog.tsx src/components/LlamaTimeTab.tsx
git commit -m "feat: add submit review dialog with validation"
```

---

### Task 20: UI — Submit Progress Dialog

**Files:**
- Create: `src/components/SubmitProgressDialog.tsx`

- [ ] **Step 1: Create SubmitProgressDialog**

Shows during and after submission:
1. **During** — progress bar (done/total), current item being submitted, cancel button
2. **After** — summary: success count, failure count, total hours. Failed items listed with error message + "Retry" button per item
3. **Month status badge** — after successful submit, show "Submitted" badge

Uses `useSubmitStore.phase` to toggle between progress and summary views.

- [ ] **Step 2: Post-submit status**

After submission completes, read `submit_history` for the current period. If a record exists, show status badge in the toolbar's month picker area.

- [ ] **Step 3: Verify full submit flow**

Run `pnpm dev`. Map all tasks. Click "Submit to JIRA". Review screen shows. Select items. Submit. Progress bar. Success summary.

- [ ] **Step 4: Commit**

```bash
git add src/components/SubmitProgressDialog.tsx
git commit -m "feat: add submit progress dialog with retry"
```

---

### Task 21: Store — Create diff store

**Files:**
- Create: `src/store/diff.ts`

- [ ] **Step 1: Create diff store**

```typescript
interface DiffRow {
  issueKey: string
  issueName: string
  localHours: number
  remoteHours: number
  delta: number
  status: 'match' | 'mismatch' | 'local-only' | 'remote-only'
  localWorklogs: DdsTask[]
  remoteWorklogs: DdsJiraWorklog[]
}

interface DiffState {
  rows: DiffRow[]
  loading: boolean
  expandedIssue: string | null

  loadDiff: (year: number, month: number) => Promise<void>
  toggleExpand: (issueKey: string) => void
  pushMissing: (issueKey: string) => Promise<void>
  pullFromJira: (issueKey: string) => Promise<void>
}
```

`loadDiff()`:
1. Read local tasks for period from `useTasksStore`
2. Read remote worklogs from `useTasksStore.worklogs`
3. Group both by issue_key
4. Compare hours, compute deltas, classify status

- [ ] **Step 2: Commit**

```bash
git add src/store/diff.ts
git commit -m "feat: create diff store for local vs remote comparison"
```

---

### Task 22: UI — Difference View

**Files:**
- Create: `src/components/DiffView.tsx`
- Create: `src/components/DiffDetailRow.tsx`
- Modify: `src/store/app.ts` (add 'diff' to Tab type)
- Modify: `src/App.tsx` (register diff tab)

- [ ] **Step 1: Add 'diff' tab to app store**

In `src/store/app.ts`, extend Tab type:
```typescript
type Tab = 'llama-time' | 'sources' | 'custom-inputs' | 'mappings' | 'wool-insights' | 'logs-history' | 'diff'
```

- [ ] **Step 2: Create DiffView**

Main component with:
1. **Period selector** — reuses month picker pattern from LlamaTimeTab
2. **Summary table** — columns: Issue Key | Issue Name | Local Hours | Jira Hours | Delta
3. **Row highlighting** — green (`match`), yellow (`mismatch`), red (`local-only` / `remote-only`)
4. **Actions column** — "Push" for local-only, "Pull" for remote-only
5. **Click row to expand** — shows DiffDetailRow

- [ ] **Step 3: Create DiffDetailRow**

Expandable row showing:
- Left column: local worklogs (date, duration, description)
- Right column: remote worklogs (date, duration, description)
- Matched pairs highlighted, orphans marked

- [ ] **Step 4: Register in App.tsx**

Add DiffView to the tab routing in `App.tsx`. Add a toolbar icon (ArrowLeftRight from lucide-react) to access it.

- [ ] **Step 5: Verify diff view**

Run `pnpm dev`. Sync data. Navigate to diff tab. See comparison table. Click row to expand. Push/Pull actions work.

- [ ] **Step 6: Commit**

```bash
git add src/components/DiffView.tsx src/components/DiffDetailRow.tsx src/store/app.ts src/App.tsx
git commit -m "feat: add difference view comparing local vs Jira worklogs"
```

---

## Phase 3: v0.4 — Polish & History

---

### Task 23: UI — Timesheet History tab (tentative)

**Files:**
- Create: `src/components/TimesheetHistoryTab.tsx`
- Modify: `src/App.tsx`

> **Note:** This feature is tentative. Implement only if v0.3 Difference View doesn't cover this need.

- [ ] **Step 1: Create TimesheetHistoryTab**

Table showing submitted months from `submit_history`:
- Columns: Period | Total Hours | Submit Date | Status | Actions (expand)
- Click to expand: same summary as pre-submit review (issue-level breakdown)
- Status: "Submitted" / "Modified after submit" (compare local task updated_at vs submitted_at)

- [ ] **Step 2: Register tab**

Add to `App.tsx` tab routing. Update `Tab` type in `app.ts` if not already done.

- [ ] **Step 3: Commit**

```bash
git add src/components/TimesheetHistoryTab.tsx src/App.tsx
git commit -m "feat: add timesheet history tab (tentative)"
```

---

### Task 24: Audit Log — Enhance persistence and UI

**Files:**
- Modify: `src/store/activity-log.ts`
- Modify: `src/components/QuickActionsCard.tsx` or wherever activity log is rendered

- [ ] **Step 1: Ensure all actions are logged**

Verify that the following actions call `logAction()`:
- Sync events (already done in sync.ts)
- Submit to Jira (add in submit store)
- Manual edits (add in tasks store updateTask)
- Mapping changes (already done in mappings store)
- Connection changes (check jira/tempo/calendar stores)
- Hide/unhide events (add in tasks store toggleHideEvent)

- [ ] **Step 2: Enhance audit log UI**

Add to the existing activity log display:
- Search input (filter by message text)
- Type filter dropdown (sync | mapping | submit | connection | input | settings | export)
- Status filter (success | error | info | pending)
- Pagination or virtual scroll for large logs

- [ ] **Step 3: Commit**

```bash
git add src/store/activity-log.ts src/store/tasks.ts src/store/submit.ts src/components/QuickActionsCard.tsx
git commit -m "feat: enhance audit log with comprehensive tracking and filtering"
```

---

### Task 25: Export — Create export utilities and button

**Files:**
- Create: `src/lib/export.ts`
- Create: `src/components/ExportButton.tsx`
- Modify: `src/components/LlamaTimeTab.tsx` (add to toolbar)

- [ ] **Step 1: Create export utilities**

```typescript
export function exportToCsv(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return
  const headers = Object.keys(data[0])
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = String(row[h] ?? '')
      return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
    }).join(','),
  )
  const csv = [headers.join(','), ...rows].join('\n')
  downloadBlob(csv, `${filename}.csv`, 'text/csv')
}

export function exportToJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  downloadBlob(json, `${filename}.json`, 'application/json')
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Create ExportButton**

Dropdown button with options:
- Export Tasks (CSV / JSON)
- Export Worklogs (CSV / JSON)
- Export Audit Log (CSV / JSON)
- Export Diff (CSV / JSON) — only visible when on diff tab

Each option calls the appropriate export function with current period data.

- [ ] **Step 3: Add to toolbar**

In `LlamaTimeTab.tsx`, add `<ExportButton />` to the toolbar near the sync button.

- [ ] **Step 4: Verify export**

Export tasks as CSV. Open file. Verify correct columns and data.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export.ts src/components/ExportButton.tsx src/components/LlamaTimeTab.tsx
git commit -m "feat: add CSV/JSON export for tasks, worklogs, audit log"
```

---

## Final: Lint & Type Check

### Task 26: Validate entire codebase

- [ ] **Step 1: Run type check**

```bash
pnpm build
```

Fix any TypeScript errors.

- [ ] **Step 2: Run linter**

```bash
pnpm lint
```

Fix any ESLint issues.

- [ ] **Step 3: Format**

```bash
pnpm format
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: fix lint and type errors after v0.2-v0.4 features"
```

# Alternative Calendar Views Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Month, Week, and Day calendar views alongside the existing timeline (renamed "List"), with a view switcher in the toolbar and per-view navigation controls.

**Architecture:** New `viewMode` state in app store. LlamaTimeTab switches between 4 views: existing TimelineChart (List) and 3 new components in `src/components/calendar-views/`. Week and Day share TimeColumn + EventBlock components. All views read from `useTasksStore`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Zustand, Lucide icons, shadcn/ui Button

---

### Task 1: Add viewMode and selectedDate to store

**Files:**
- Modify: `src/store/app.ts`

**Step 1: Add new state fields**

Add `viewMode` and `selectedDate` to the store. `viewMode` controls which calendar view is active. `selectedDate` is an ISO date string used for Week/Day navigation.

In `src/store/app.ts`, add to the `AppState` interface and initial state:

```typescript
// Add to type definition above AppState
export type ViewMode = 'month' | 'week' | 'day' | 'list'

// Add to AppState interface:
viewMode: ViewMode
setViewMode: (mode: ViewMode) => void
selectedDate: string
setSelectedDate: (date: string) => void
```

In the store creator, add:
```typescript
viewMode: 'list',
setViewMode: (viewMode) => set({ viewMode }),
selectedDate: new Date().toISOString().slice(0, 10),
setSelectedDate: (selectedDate) => set({ selectedDate }),
```

Do NOT persist `viewMode` or `selectedDate` (they reset on reload).

**Step 2: Verify it compiles**

Run: `pnpm build`

**Step 3: Commit**

```bash
git add src/store/app.ts
git commit -m "feat(views): add viewMode and selectedDate to app store"
```

---

### Task 2: Update LlamaTimeToolbar with view switcher

**Files:**
- Modify: `src/components/LlamaTimeTab.tsx` (the `LlamaTimeToolbar` function, lines 311-413)

**Step 1: Add view tabs and context controls to toolbar**

Import new dependencies at the top of LlamaTimeTab.tsx:
```typescript
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ViewMode } from '@/store/app'
```

Read `viewMode`, `setViewMode`, `selectedDate`, `setSelectedDate` from `useAppStore` inside `LlamaTimeToolbar`.

Replace the toolbar JSX (the outer `<div className="flex flex-col gap-2">`) with a new layout:

**Left side:** View mode tabs (Month | Week | Day | List) as Button group:
```tsx
<div className="flex items-center gap-1 rounded-lg border p-0.5">
  {(['month', 'week', 'day', 'list'] as ViewMode[]).map((mode) => (
    <Button
      key={mode}
      variant={viewMode === mode ? 'default' : 'ghost'}
      size="sm"
      className="h-7 px-3 text-xs capitalize"
      onClick={() => setViewMode(mode)}
    >
      {mode}
    </Button>
  ))}
</div>
```

**Right side:** Context-dependent controls:
- If `viewMode === 'list'` or `viewMode === 'month'`: show existing month/year pickers + Load Sources + Submit button
- If `viewMode === 'week'` or `viewMode === 'day'`: show `< Previous` | `Today` | `Next >` arrows + Load Sources

Navigation helpers (add inside `LlamaTimeToolbar`):
```typescript
const navigateDay = (offset: number) => {
  const d = new Date(selectedDate)
  d.setDate(d.getDate() + offset)
  setSelectedDate(d.toISOString().slice(0, 10))
}

const navigateWeek = (offset: number) => {
  const d = new Date(selectedDate)
  d.setDate(d.getDate() + offset * 7)
  setSelectedDate(d.toISOString().slice(0, 10))
}

const goToToday = () => {
  setSelectedDate(new Date().toISOString().slice(0, 10))
}
```

For week/day views, render:
```tsx
<div className="flex items-center gap-1">
  <Button variant="outline" size="sm" onClick={() => viewMode === 'week' ? navigateWeek(-1) : navigateDay(-1)}>
    <ChevronLeft className="h-4 w-4" />
  </Button>
  <Button variant="outline" size="sm" onClick={goToToday}>
    Today
  </Button>
  <Button variant="outline" size="sm" onClick={() => viewMode === 'week' ? navigateWeek(1) : navigateDay(1)}>
    <ChevronRight className="h-4 w-4" />
  </Button>
</div>
```

Keep the Load Sources button visible in all modes. Keep the Submit to JIRA button in list/month modes only.

**Step 2: Verify it compiles**

Run: `pnpm build`

**Step 3: Commit**

```bash
git add src/components/LlamaTimeTab.tsx
git commit -m "feat(views): add view mode switcher and navigation to toolbar"
```

---

### Task 3: Create EventBlock component

**Files:**
- Create: `src/components/calendar-views/EventBlock.tsx`

**Step 1: Create the shared event block component**

This component renders a single event as a positioned block for Week/Day views and a compact strip for Month view.

```tsx
import type { DdsTask } from '@/lib/duckdb/queries'

const SOURCE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  jira_worklog: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/50',
    text: 'text-green-700 dark:text-green-300',
  },
  custom_input: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/50',
    text: 'text-orange-700 dark:text-orange-300',
  },
  gcal: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-700 dark:text-blue-300',
  },
}

function getColors(source: string, isMapped: boolean) {
  const c = SOURCE_COLORS[source] ?? SOURCE_COLORS.gcal
  if (!isMapped && source === 'gcal') {
    return { ...c, border: 'border-dashed border-blue-400/60' }
  }
  return c
}

interface EventBlockProps {
  task: DdsTask
  style?: React.CSSProperties
  className?: string
  compact?: boolean
  onClick?: (task: DdsTask) => void
}

export function EventBlock({ task, style, className = '', compact, onClick }: EventBlockProps) {
  const colors = getColors(task.source, !!task.issue_key)
  const title = task.description ?? '(no title)'

  if (compact) {
    return (
      <button
        className={`w-full truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight border ${colors.bg} ${colors.border} ${colors.text} ${className}`}
        style={style}
        onClick={() => onClick?.(task)}
        title={title}
      >
        {title}
      </button>
    )
  }

  return (
    <button
      className={`absolute overflow-hidden rounded border px-1.5 py-0.5 text-left text-xs leading-tight ${colors.bg} ${colors.border} ${colors.text} ${className}`}
      style={{ ...style, minHeight: 20 }}
      onClick={() => onClick?.(task)}
      title={title}
    >
      <span className="font-medium truncate block">{title}</span>
    </button>
  )
}
```

**Step 2: Verify it compiles**

Run: `pnpm build`

**Step 3: Commit**

```bash
git add src/components/calendar-views/EventBlock.tsx
git commit -m "feat(views): add shared EventBlock component"
```

---

### Task 4: Create TimeColumn component

**Files:**
- Create: `src/components/calendar-views/TimeColumn.tsx`

**Step 1: Create the shared time axis component**

This renders the Y-axis hour labels for Week and Day views.

```tsx
interface TimeColumnProps {
  startHour?: number
  endHour?: number
  hourHeight: number
}

export function TimeColumn({ startHour = 0, endHour = 24, hourHeight }: TimeColumnProps) {
  const hours = []
  for (let h = startHour; h < endHour; h++) {
    hours.push(h)
  }

  return (
    <div className="shrink-0 w-14 border-r" style={{ paddingTop: hourHeight / 2 }}>
      {hours.map((h) => (
        <div
          key={h}
          className="relative text-right pr-2 text-xs text-muted-foreground"
          style={{ height: hourHeight }}
        >
          <span className="absolute -top-2 right-2">
            {String(h).padStart(2, '0')}:00
          </span>
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Verify it compiles**

Run: `pnpm build`

**Step 3: Commit**

```bash
git add src/components/calendar-views/TimeColumn.tsx
git commit -m "feat(views): add shared TimeColumn component"
```

---

### Task 5: Create WeekCalendarView

**Files:**
- Create: `src/components/calendar-views/WeekCalendarView.tsx`

**Step 1: Create the week view component**

This is the most complex new component. It renders 7 day columns with a time axis. Read the existing EventDetailDialog import from TimelineChart to reuse it.

Key logic:
- Compute week start (Monday) from `selectedDate`
- Filter tasks to the visible week
- For each day column: position events absolutely based on start time and duration
- Handle overlapping events by computing concurrent groups and dividing width
- All-day section at top for events without specific times or > 12h duration

The component receives the same props as the current timeline: `tasks`, `issues`, `onTaskUpdate`, `onAddTask`.

```tsx
import { useMemo, useState } from 'react'
import { EventBlock } from '@/components/calendar-views/EventBlock'
import { TimeColumn } from '@/components/calendar-views/TimeColumn'
import type { DdsJiraIssue, DdsJiraWorklog, DdsTask } from '@/lib/duckdb/queries'

const HOUR_HEIGHT = 60
const WORK_START = 7
const WORK_END = 20
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMonday(dateStr: string): Date {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

function parseDuration(dur: string): number {
  const hMatch = dur.match(/(\d+)h/)
  const mMatch = dur.match(/(\d+)m/)
  if (hMatch || mMatch) {
    return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0)
  }
  const n = Number(dur)
  return n > 0 ? Math.round(n / 60) : 0
}

function isAllDay(task: DdsTask): boolean {
  if (!task.start_time) return true
  return parseDuration(task.duration) >= 720
}

interface PositionedEvent {
  task: DdsTask
  top: number
  height: number
  left: number
  width: number
}

function layoutEvents(
  dayTasks: DdsTask[],
  startHour: number,
  hourHeight: number,
): PositionedEvent[] {
  const timed = dayTasks
    .filter((t) => !isAllDay(t) && t.start_time)
    .map((t) => {
      const d = new Date(t.start_time!)
      const startMin = d.getHours() * 60 + d.getMinutes()
      const dur = parseDuration(t.duration)
      return {
        task: t,
        startMin,
        endMin: startMin + dur,
        top: ((startMin - startHour * 60) / 60) * hourHeight,
        height: Math.max(20, (dur / 60) * hourHeight),
      }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  // Compute concurrent groups for overlap handling
  const result: PositionedEvent[] = []
  const columns: { endMin: number }[][] = []

  for (const ev of timed) {
    let placed = false
    for (let col = 0; col < columns.length; col++) {
      const last = columns[col][columns[col].length - 1]
      if (ev.startMin >= last.endMin) {
        columns[col].push(ev)
        result.push({ ...ev, left: col, width: 1 })
        placed = true
        break
      }
    }
    if (!placed) {
      columns.push([ev])
      result.push({ ...ev, left: columns.length - 1, width: 1 })
    }
  }

  const totalCols = columns.length || 1
  return result.map((ev) => ({
    ...ev,
    left: (ev.left / totalCols) * 100,
    width: (1 / totalCols) * 100,
  }))
}

interface WeekCalendarViewProps {
  selectedDate: string
  tasks: DdsTask[]
  worklogs: DdsJiraWorklog[]
  issues: DdsJiraIssue[]
  onTaskClick: (task: DdsTask) => void
}

export function WeekCalendarView({
  selectedDate,
  tasks,
  worklogs,
  issues,
  onTaskClick,
}: WeekCalendarViewProps) {
  const monday = useMemo(() => getMonday(selectedDate), [selectedDate])

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [monday])

  const tasksByDay = useMemo(() => {
    const map: Map<string, DdsTask[]> = new Map()
    for (const day of weekDays) {
      map.set(day.toISOString().slice(0, 10), [])
    }
    for (const t of tasks) {
      if (!t.start_time) continue
      const key = new Date(t.start_time).toISOString().slice(0, 10)
      map.get(key)?.push(t)
    }
    return map
  }, [tasks, weekDays])

  const startHour = WORK_START
  const endHour = WORK_END
  const totalHours = endHour - startHour

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Day headers */}
      <div className="flex shrink-0 border-b">
        <div className="w-14 shrink-0 border-r" />
        {weekDays.map((day, i) => {
          const dateStr = day.toISOString().slice(0, 10)
          const isToday = dateStr === today
          return (
            <div
              key={i}
              className={`flex-1 border-r py-2 text-center text-sm ${isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}
            >
              <div>{DAY_NAMES[i]}</div>
              <div className={`text-lg ${isToday ? 'text-primary' : ''}`}>{day.getDate()}</div>
            </div>
          )
        })}
      </div>

      {/* All-day section */}
      <div className="flex shrink-0 border-b">
        <div className="w-14 shrink-0 border-r flex items-center justify-end pr-2">
          <span className="text-[10px] text-muted-foreground">all-day</span>
        </div>
        {weekDays.map((day, i) => {
          const dateStr = day.toISOString().slice(0, 10)
          const allDayTasks = (tasksByDay.get(dateStr) ?? []).filter(isAllDay)
          return (
            <div key={i} className="flex-1 border-r p-0.5 min-h-8 space-y-0.5">
              {allDayTasks.map((t) => (
                <EventBlock key={t.task_id} task={t} compact onClick={onTaskClick} />
              ))}
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="flex flex-1 min-h-0 overflow-y-auto">
        <TimeColumn startHour={startHour} endHour={endHour} hourHeight={HOUR_HEIGHT} />
        {weekDays.map((day, i) => {
          const dateStr = day.toISOString().slice(0, 10)
          const dayTasks = (tasksByDay.get(dateStr) ?? []).filter((t) => !isAllDay(t))
          const positioned = layoutEvents(dayTasks, startHour, HOUR_HEIGHT)

          return (
            <div key={i} className="relative flex-1 border-r">
              {/* Hour grid lines */}
              {Array.from({ length: totalHours }, (_, h) => (
                <div
                  key={h}
                  className="border-b border-border/40"
                  style={{ height: HOUR_HEIGHT }}
                />
              ))}
              {/* Events */}
              {positioned.map((ev) => (
                <EventBlock
                  key={ev.task.task_id}
                  task={ev.task}
                  style={{
                    top: ev.top,
                    left: `${ev.left}%`,
                    width: `${ev.width}%`,
                    height: ev.height,
                  }}
                  onClick={onTaskClick}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 2: Verify it compiles**

Run: `pnpm build`

**Step 3: Commit**

```bash
git add src/components/calendar-views/WeekCalendarView.tsx
git commit -m "feat(views): add WeekCalendarView with time grid and event positioning"
```

---

### Task 6: Create DayCalendarView

**Files:**
- Create: `src/components/calendar-views/DayCalendarView.tsx`

**Step 1: Create the day view component**

Similar to Week but single column. Reuses TimeColumn and EventBlock.

```tsx
import { useMemo } from 'react'
import { EventBlock } from '@/components/calendar-views/EventBlock'
import { TimeColumn } from '@/components/calendar-views/TimeColumn'
import type { DdsJiraIssue, DdsJiraWorklog, DdsTask } from '@/lib/duckdb/queries'

const HOUR_HEIGHT = 60
const WORK_START = 7
const WORK_END = 20
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function parseDuration(dur: string): number {
  const hMatch = dur.match(/(\d+)h/)
  const mMatch = dur.match(/(\d+)m/)
  if (hMatch || mMatch) {
    return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0)
  }
  const n = Number(dur)
  return n > 0 ? Math.round(n / 60) : 0
}

function isAllDay(task: DdsTask): boolean {
  if (!task.start_time) return true
  return parseDuration(task.duration) >= 720
}

interface PositionedEvent {
  task: DdsTask
  top: number
  height: number
  left: number
  width: number
}

function layoutEvents(
  dayTasks: DdsTask[],
  startHour: number,
  hourHeight: number,
): PositionedEvent[] {
  const timed = dayTasks
    .filter((t) => !isAllDay(t) && t.start_time)
    .map((t) => {
      const d = new Date(t.start_time!)
      const startMin = d.getHours() * 60 + d.getMinutes()
      const dur = parseDuration(t.duration)
      return {
        task: t,
        startMin,
        endMin: startMin + dur,
        top: ((startMin - startHour * 60) / 60) * hourHeight,
        height: Math.max(20, (dur / 60) * hourHeight),
      }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  const result: PositionedEvent[] = []
  const columns: { endMin: number }[][] = []

  for (const ev of timed) {
    let placed = false
    for (let col = 0; col < columns.length; col++) {
      const last = columns[col][columns[col].length - 1]
      if (ev.startMin >= last.endMin) {
        columns[col].push(ev)
        result.push({ ...ev, left: col, width: 1 })
        placed = true
        break
      }
    }
    if (!placed) {
      columns.push([ev])
      result.push({ ...ev, left: columns.length - 1, width: 1 })
    }
  }

  const totalCols = columns.length || 1
  return result.map((ev) => ({
    ...ev,
    left: (ev.left / totalCols) * 100,
    width: (1 / totalCols) * 100,
  }))
}

interface DayCalendarViewProps {
  selectedDate: string
  tasks: DdsTask[]
  worklogs: DdsJiraWorklog[]
  issues: DdsJiraIssue[]
  onTaskClick: (task: DdsTask) => void
}

export function DayCalendarView({
  selectedDate,
  tasks,
  worklogs,
  issues,
  onTaskClick,
}: DayCalendarViewProps) {
  const date = useMemo(() => new Date(selectedDate), [selectedDate])
  const dateStr = selectedDate

  const dayTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!t.start_time) return false
      return new Date(t.start_time).toISOString().slice(0, 10) === dateStr
    })
  }, [tasks, dateStr])

  const allDayTasks = useMemo(() => dayTasks.filter(isAllDay), [dayTasks])
  const timedTasks = useMemo(() => dayTasks.filter((t) => !isAllDay(t)), [dayTasks])

  const startHour = WORK_START
  const endHour = WORK_END
  const totalHours = endHour - startHour
  const positioned = useMemo(
    () => layoutEvents(timedTasks, startHour, HOUR_HEIGHT),
    [timedTasks, startHour],
  )

  const today = new Date().toISOString().slice(0, 10)
  const isToday = dateStr === today

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Day header */}
      <div className="shrink-0 border-b px-4 py-3">
        <div className={`text-2xl font-bold ${isToday ? 'text-primary' : ''}`}>
          {date.getDate()}. {MONTH_NAMES[date.getMonth()]} {date.getFullYear()}
        </div>
        <div className="text-sm text-muted-foreground">
          {DAY_NAMES[date.getDay()]}
        </div>
      </div>

      {/* All-day section */}
      {allDayTasks.length > 0 && (
        <div className="flex shrink-0 border-b">
          <div className="w-14 shrink-0 border-r flex items-center justify-end pr-2">
            <span className="text-[10px] text-muted-foreground">all-day</span>
          </div>
          <div className="flex-1 p-1 space-y-0.5">
            {allDayTasks.map((t) => (
              <EventBlock key={t.task_id} task={t} compact onClick={onTaskClick} />
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="flex flex-1 min-h-0 overflow-y-auto">
        <TimeColumn startHour={startHour} endHour={endHour} hourHeight={HOUR_HEIGHT} />
        <div className="relative flex-1">
          {/* Hour grid lines */}
          {Array.from({ length: totalHours }, (_, h) => (
            <div
              key={h}
              className="border-b border-border/40"
              style={{ height: HOUR_HEIGHT }}
            />
          ))}
          {/* Events */}
          {positioned.map((ev) => (
            <EventBlock
              key={ev.task.task_id}
              task={ev.task}
              style={{
                top: ev.top,
                left: `${ev.left}%`,
                width: `${ev.width}%`,
                height: ev.height,
              }}
              onClick={onTaskClick}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify it compiles**

Run: `pnpm build`

**Step 3: Commit**

```bash
git add src/components/calendar-views/DayCalendarView.tsx
git commit -m "feat(views): add DayCalendarView with time grid"
```

---

### Task 7: Create MonthCalendarView

**Files:**
- Create: `src/components/calendar-views/MonthCalendarView.tsx`

**Step 1: Create the month calendar grid**

CSS Grid with 7 columns. Each cell shows the day number and compact event list.

```tsx
import { useMemo } from 'react'
import { EventBlock } from '@/components/calendar-views/EventBlock'
import type { DdsJiraIssue, DdsJiraWorklog, DdsTask } from '@/lib/duckdb/queries'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface MonthCalendarViewProps {
  year: number
  month: number
  tasks: DdsTask[]
  worklogs: DdsJiraWorklog[]
  issues: DdsJiraIssue[]
  onTaskClick: (task: DdsTask) => void
}

export function MonthCalendarView({
  year,
  month,
  tasks,
  worklogs,
  issues,
  onTaskClick,
}: MonthCalendarViewProps) {
  const { cells, tasksByDate } = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()

    // Monday = 0 in our grid. JS getDay(): 0=Sun,1=Mon...
    const startDow = (firstDay.getDay() + 6) % 7 // convert to Mon=0
    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7

    const cells: { date: Date; inMonth: boolean }[] = []
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(year, month, 1 - startDow + i)
      cells.push({
        date: d,
        inMonth: d.getMonth() === month && d.getFullYear() === year,
      })
    }

    // Group tasks by date
    const tasksByDate = new Map<string, DdsTask[]>()
    for (const t of tasks) {
      if (!t.start_time) continue
      const key = new Date(t.start_time).toISOString().slice(0, 10)
      if (!tasksByDate.has(key)) tasksByDate.set(key, [])
      tasksByDate.get(key)!.push(t)
    }

    return { cells, tasksByDate }
  }, [year, month, tasks])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Day-of-week headers */}
      <div className="grid shrink-0 grid-cols-7 border-b">
        {DAY_HEADERS.map((name) => (
          <div
            key={name}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid flex-1 grid-cols-7 auto-rows-fr overflow-y-auto">
        {cells.map((cell, i) => {
          const dateStr = cell.date.toISOString().slice(0, 10)
          const isToday = dateStr === today
          const dayTasks = tasksByDate.get(dateStr) ?? []

          return (
            <div
              key={i}
              className={`border-b border-r p-1 min-h-24 ${!cell.inMonth ? 'bg-muted/30' : ''}`}
            >
              <div
                className={`mb-0.5 text-sm ${isToday ? 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold' : cell.inMonth ? 'font-medium' : 'text-muted-foreground'}`}
              >
                {cell.date.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 4).map((t) => (
                  <EventBlock key={t.task_id} task={t} compact onClick={onTaskClick} />
                ))}
                {dayTasks.length > 4 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{dayTasks.length - 4} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 2: Verify it compiles**

Run: `pnpm build`

**Step 3: Commit**

```bash
git add src/components/calendar-views/MonthCalendarView.tsx
git commit -m "feat(views): add MonthCalendarView with calendar grid"
```

---

### Task 8: Wire views into LlamaTimeTab

**Files:**
- Modify: `src/components/LlamaTimeTab.tsx` (the `LlamaTimeTab` function)

**Step 1: Import new views and add view switching logic**

Add imports at top:
```typescript
import { MonthCalendarView } from '@/components/calendar-views/MonthCalendarView'
import { WeekCalendarView } from '@/components/calendar-views/WeekCalendarView'
import { DayCalendarView } from '@/components/calendar-views/DayCalendarView'
```

Inside `LlamaTimeTab`, read `viewMode` and `selectedDate`:
```typescript
const viewMode = useAppStore((s) => s.viewMode)
const selectedDate = useAppStore((s) => s.selectedDate)
```

Add a `handleTaskClick` callback that opens the existing EventDetailDialog (or a simple alert for now — the EventDetailDialog is inside TimelineChart, so it may need to be extracted or we pass the task to a shared state):

For the MVP, add a state `clickedTask` and render EventDetailDialog conditionally. Since EventDetailDialog is currently embedded in TimelineChart, for the new views we'll need a standalone version. The simplest approach: render TimelineChart's dialog externally by tracking clicked task state.

In the JSX, inside the `hasData` Card, wrap the current content in a condition:

```tsx
{hasData && (
  <Card className="flex flex-1 min-h-0 flex-col">
    {viewMode === 'list' && (
      <>
        {/* Existing card header with zoom switcher + mini-timeline */}
        {/* ... existing list view content ... */}
      </>
    )}
    {viewMode === 'month' && (
      <MonthCalendarView
        year={selectedPeriod.year}
        month={selectedPeriod.month}
        tasks={allTasks}
        worklogs={worklogs}
        issues={issues}
        onTaskClick={(task) => { /* TODO: open detail dialog */ }}
      />
    )}
    {viewMode === 'week' && (
      <WeekCalendarView
        selectedDate={selectedDate}
        tasks={allTasks}
        worklogs={worklogs}
        issues={issues}
        onTaskClick={(task) => { /* TODO: open detail dialog */ }}
      />
    )}
    {viewMode === 'day' && (
      <DayCalendarView
        selectedDate={selectedDate}
        tasks={allTasks}
        worklogs={worklogs}
        issues={issues}
        onTaskClick={(task) => { /* TODO: open detail dialog */ }}
      />
    )}
  </Card>
)}
```

Move the existing list view content (card header with zoom switcher, day labels, scrollable body) inside the `viewMode === 'list'` block. Keep all existing hooks and state — they're only used when list view is active.

**Step 2: Verify it compiles and renders**

Run: `pnpm build`

**Step 3: Commit**

```bash
git add src/components/LlamaTimeTab.tsx
git commit -m "feat(views): wire Month/Week/Day views into LlamaTimeTab"
```

---

### Task 9: Final verification

**Step 1: Build**

Run: `pnpm build`
Expected: Clean build

**Step 2: Lint**

Run: `pnpm lint`
Expected: No new errors from our files

**Step 3: Manual smoke test**

Run: `pnpm dev`
Verify:
- View switcher shows Month | Week | Day | List tabs in toolbar
- List view works exactly as before (zoom, mini-timeline, sidebar)
- Month view shows calendar grid with events in colored strips
- Week view shows 7-day columns with time axis and positioned events
- Day view shows single day with time axis
- Navigation arrows work for Week/Day
- Today button jumps to current date
- Click event in Month/Week/Day opens detail (or placeholder)

**Step 4: Commit if fixes needed**

```bash
git add -A
git commit -m "fix(views): address build/lint issues from calendar views"
```

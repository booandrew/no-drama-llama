# Alternative Calendar Views — Design

## Overview

Add Month, Week, and Day calendar views alongside the existing timeline (renamed to "List" view). All views show the same data (tasks, worklogs, calendar events) and support full event interaction (click to open EventDetailDialog with Jira mapping).

## View Modes

### Month View (calendar grid)
- CSS Grid: 7 columns (Mon–Sun), 5-6 rows
- Each cell = one day, showing compact list of events
- Events as colored strips with name + time
- Colors by source: green (worklog), orange (custom input), blue (calendar)
- Multi-day events span across cells
- Days outside current month are grayed out
- Click event → EventDetailDialog

### Week View (time axis)
- 7 day columns + left Y-axis with hour labels (07:00–19:00, or 00:00–24:00 if night events)
- All-day section at top for full-day / untimed events
- Events as absolutely positioned blocks: Y = start time, height = duration
- Overlapping events share column width (Google Calendar style)
- Colors by source, dashed outline for unmapped
- Vertical scroll for full day range
- Click event → EventDetailDialog

### Day View
- Same as Week View but single column (full width)
- All-day section at top
- Events as positioned blocks
- More space = full event names, times, durations visible
- Optional mini-calendar in corner for quick day navigation
- Click event → EventDetailDialog

### List View (existing)
- Current horizontal Gantt-like timeline (renamed from default)
- Keeps existing zoom levels: Day/Week/2-Week/Month
- All existing features preserved (sidebar, mapping combobox, mini-timeline)

## Toolbar Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [Month] [Week] [Day] [List]     [context controls →]        │
│ ←─── view tabs (left) ───→      ←─── right side ───→        │
└──────────────────────────────────────────────────────────────┘
```

**Right-side controls by active view:**
- Month → month/year picker (existing dropdowns)
- Week → `< Previous` `Today` `Next >` arrows
- Day → `< Previous` `Today` `Next >` arrows
- List → zoom Day/Week/2Week/Month + month/year picker (existing)

## State

Add to store:
- `viewMode: 'month' | 'week' | 'day' | 'list'` — default 'list' (preserves current UX)
- `selectedDate: string` (ISO date) — for Week/Day navigation (which week/day is visible)

## New Files

- `src/components/calendar-views/MonthCalendarView.tsx` — month grid
- `src/components/calendar-views/WeekCalendarView.tsx` — week timeline
- `src/components/calendar-views/DayCalendarView.tsx` — day timeline (reuses Week logic)
- `src/components/calendar-views/TimeColumn.tsx` — shared time axis (Y-axis hours), used by Week and Day
- `src/components/calendar-views/EventBlock.tsx` — positioned event block, used by Week and Day

## Modified Files

- `src/components/LlamaTimeTab.tsx` — toolbar: add view switcher + context controls; body: switch by viewMode
- `src/store/app.ts` or `src/store/calendar.ts` — add viewMode + selectedDate

## Shared Logic

- All views read from `useTasksStore` (same data: tasks, worklogs, issues, dailyCapacity)
- EventDetailDialog reused from TimelineChart (extract if needed)
- Event colors: same as current timeline (WL=green, CI=orange, Cal=blue, unmapped=dashed)

## Technical Decisions

- Approach A: Separate components per view (not one "god component")
- Week and Day share TimeColumn + EventBlock components
- Pure CSS/DOM positioning for calendar views (no Recharts needed for Month/Week/Day)
- Navigation: arrows for Week/Day, month/year picker for Month/List

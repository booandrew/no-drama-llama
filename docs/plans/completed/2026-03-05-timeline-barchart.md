# Replace D3 Gantt Chart with Recharts Horizontal Bar Chart

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the custom D3.js `GanttChart` component with a horizontal stacked bar chart using Recharts + shadcn `ChartContainer`, preserving the same visual timeline of calendar events.

**Architecture:** Stacked horizontal bars with transparent gap segments for positioning. Each event name = Y-axis row. X-axis = minutes from month start. Gap segments are transparent/non-interactive, event segments are colored with tooltips. Zoom (1W/2W/1M) controls XAxis domain.

**Tech Stack:** React 19, TypeScript 5.9, Recharts 2.15.4 (already installed), shadcn/ui chart components, Tailwind CSS v4

## Overview

The current `src/components/GanttChart.tsx` renders a timeline of Google Calendar events using D3.js with imperative SVG manipulation. We replace it with a declarative Recharts-based component that uses shadcn's `ChartContainer`, `ChartTooltip`, etc.

The key insight: we model the timeline as a **stacked bar chart** where each row (event name) has alternating segments: `[gap_0, event_0, gap_1, event_1, ..., tail]`. Gap segments are transparent and create the correct positioning offsets.

## Context

- **Branch:** Will be created from `main`
- **Current Gantt:** `src/components/GanttChart.tsx` — 322 lines, D3.js, imperative SVG, has popover "Log Time" on click
- **PacaTimeTab:** `src/components/PacaTimeTab.tsx` — 183 lines, wraps GanttChart, has period selector, zoom toggle (1W/2W/1M), refresh button, manual ResizeObserver for dayWidth
- **Calendar store:** `src/store/calendar.ts` — provides `CalendarEvent[]` with `summary`, `start.dateTime`, `end.dateTime`
- **shadcn chart:** `src/components/ui/chart.tsx` — wraps Recharts `ResponsiveContainer`, provides `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartConfig`
- **Recharts 2.15.4** is already installed
- **D3** (`d3` + `@types/d3`) will be removed
- **CSS vars:** `--chart-1` through `--chart-5` for colors, `--destructive` for today marker
- **Code style:** no semicolons, single quotes, trailing commas, 100 char width, 2-space indent

## Validation Commands

```bash
pnpm build
pnpm lint
```

## Implementation Steps

### Task 1: Create TimelineChart component with data transformation

**Files:**
- Create: `src/components/TimelineChart.tsx`
- Reference: `src/store/calendar.ts` (for `CalendarEvent` type)
- Reference: `src/components/ui/chart.tsx` (for `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartConfig`)

- [x] Create `src/components/TimelineChart.tsx` with the following structure:

```tsx
import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import type { CalendarEvent } from '@/store/calendar'

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

const MINUTES_PER_DAY = 1440

interface TimelineChartProps {
  events: CalendarEvent[]
  year: number
  month: number
  domain?: [number, number]
}

interface SegmentMeta {
  name: string
  startTime: Date
  endTime: Date
  durationMin: number
}

function toMinuteOffset(
  dt: { dateTime?: string; date?: string } | undefined,
  monthStartMs: number,
): number {
  if (!dt) return 0
  const ms = new Date(dt.dateTime ?? dt.date ?? 0).getTime()
  return Math.max(0, Math.round((ms - monthStartMs) / 60000))
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function buildChartData(
  events: CalendarEvent[],
  year: number,
  month: number,
) {
  const monthStart = new Date(year, month, 1)
  const monthStartMs = monthStart.getTime()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalMinutes = daysInMonth * MINUTES_PER_DAY

  // Group by summary
  const grouped = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const name = e.summary ?? '(no title)'
    const list = grouped.get(name) ?? []
    list.push(e)
    grouped.set(name, list)
  }

  const taskNames = Array.from(grouped.keys()).sort()

  // Find max occurrences
  let maxSlots = 0
  for (const list of grouped.values()) {
    if (list.length > maxSlots) maxSlots = list.length
  }

  // Metadata for tooltips: segmentMeta[rowIndex][slotIndex]
  const segmentMeta: Map<string, SegmentMeta> = new Map()

  const data = taskNames.map((name) => {
    const occurrences = grouped.get(name)!
    const sorted = [...occurrences].sort((a, b) => {
      const aMs = new Date(a.start?.dateTime ?? a.start?.date ?? 0).getTime()
      const bMs = new Date(b.start?.dateTime ?? b.start?.date ?? 0).getTime()
      return aMs - bMs
    })

    const row: Record<string, string | number> = { name }
    let cursor = 0

    sorted.forEach((event, i) => {
      const startMin = toMinuteOffset(event.start, monthStartMs)
      const endMin = toMinuteOffset(event.end, monthStartMs)
      const clampedStart = Math.max(0, Math.min(totalMinutes, startMin))
      const clampedEnd = Math.max(0, Math.min(totalMinutes, endMin))
      const gap = Math.max(0, clampedStart - cursor)
      const duration = Math.max(0, clampedEnd - clampedStart)

      row[`gap_${i}`] = gap
      row[`event_${i}`] = duration
      cursor = clampedStart + duration

      // Store metadata for tooltip
      segmentMeta.set(`${name}::event_${i}`, {
        name,
        startTime: new Date(event.start?.dateTime ?? event.start?.date ?? 0),
        endTime: new Date(event.end?.dateTime ?? event.end?.date ?? 0),
        durationMin: duration,
      })
    })

    // Fill unused slots
    for (let i = sorted.length; i < maxSlots; i++) {
      row[`gap_${i}`] = 0
      row[`event_${i}`] = 0
    }

    row.tail = Math.max(0, totalMinutes - cursor)
    return row
  })

  return { data, taskNames, maxSlots, totalMinutes, segmentMeta }
}

export function TimelineChart({
  events,
  year,
  month,
  domain,
}: TimelineChartProps) {
  const { data, taskNames, maxSlots, totalMinutes, segmentMeta } = useMemo(
    () => buildChartData(events, year, month),
    [events, year, month],
  )

  // Build ChartConfig for colors
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {}
    taskNames.forEach((name, i) => {
      config[name] = {
        label: name.length > 20 ? name.slice(0, 18) + '...' : name,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }
    })
    return config
  }, [taskNames])

  // Color map: event name -> color
  const colorMap = useMemo(() => {
    const map = new Map<string, string>()
    taskNames.forEach((name, i) => {
      map.set(name, CHART_COLORS[i % CHART_COLORS.length])
    })
    return map
  }, [taskNames])

  // Today marker position (minutes from month start)
  const todayMinutes = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 1)
    if (now < monthStart || now >= monthEnd) return null
    return Math.round((now.getTime() - monthStart.getTime()) / 60000)
  }, [year, month])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const chartDomain = domain ?? [0, totalMinutes]

  // Generate day tick values
  const ticks = useMemo(() => {
    const t: number[] = []
    for (let d = 0; d < daysInMonth; d++) {
      t.push(d * MINUTES_PER_DAY)
    }
    return t
  }, [daysInMonth])

  if (taskNames.length === 0) return null

  const chartHeight = Math.max(200, taskNames.length * 44 + 60)

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
      <BarChart
        layout="vertical"
        data={data}
        stackOffset="none"
        margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
        barCategoryGap="20%"
      >
        <XAxis
          type="number"
          domain={chartDomain}
          ticks={ticks}
          tickFormatter={(val: number) => `${Math.floor(val / MINUTES_PER_DAY) + 1}`}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={180}
          tickFormatter={(val: string) =>
            val.length > 20 ? val.slice(0, 18) + '...' : val
          }
          axisLine={false}
          tickLine={false}
        />
        <ChartTooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            // Find the first visible (non-gap, non-tail) segment
            const eventEntry = payload.find(
              (p) =>
                p.dataKey &&
                typeof p.dataKey === 'string' &&
                p.dataKey.startsWith('event_') &&
                typeof p.value === 'number' &&
                p.value > 0,
            )
            if (!eventEntry) return null

            const rowName = eventEntry.payload?.name as string
            const key = `${rowName}::${eventEntry.dataKey}`
            const meta = segmentMeta.get(key)
            if (!meta) return null

            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
                <p className="font-medium">{meta.name}</p>
                <p className="text-muted-foreground">
                  {meta.startTime.toLocaleString('ru', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="text-muted-foreground">
                  {formatDuration(meta.durationMin)}
                </p>
              </div>
            )
          }}
        />
        {todayMinutes !== null && (
          <ReferenceLine
            x={todayMinutes}
            stroke="var(--destructive)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}
        {/* Render alternating gap + event Bar pairs */}
        {Array.from({ length: maxSlots }, (_, i) => [
          <Bar
            key={`gap_${i}`}
            dataKey={`gap_${i}`}
            stackId="a"
            fill="transparent"
            isAnimationActive={false}
            style={{ pointerEvents: 'none' }}
          />,
          <Bar
            key={`event_${i}`}
            dataKey={`event_${i}`}
            stackId="a"
            radius={[4, 4, 4, 4]}
            isAnimationActive={false}
            shape={(props: Record<string, unknown>) => {
              const { x, y, width, height, payload } = props as {
                x: number
                y: number
                width: number
                height: number
                payload: { name: string }
              }
              if (!width || width <= 0) return null
              return (
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx={4}
                  fill={colorMap.get(payload.name) ?? CHART_COLORS[0]}
                  opacity={0.85}
                  className="cursor-pointer hover:opacity-100"
                />
              )
            }}
          />,
        ]).flat()}
        {/* Tail gap to fill remaining space */}
        <Bar
          dataKey="tail"
          stackId="a"
          fill="transparent"
          isAnimationActive={false}
          style={{ pointerEvents: 'none' }}
        />
      </BarChart>
    </ChartContainer>
  )
}
```

- [x] Verify TypeScript compiles: `pnpm build`
- [x] Commit: `git add src/components/TimelineChart.tsx && git commit -m "feat: add TimelineChart component with Recharts stacked bars"`

---

### Task 2: Update PacaTimeTab to use TimelineChart

**Files:**
- Modify: `src/components/PacaTimeTab.tsx`
- Reference: `src/components/TimelineChart.tsx` (the new component)

- [x] In `src/components/PacaTimeTab.tsx`, make these changes:

1. **Replace import:** Change `import { GanttChart } from '@/components/GanttChart'` to `import { TimelineChart } from '@/components/TimelineChart'`

2. **Add state for window navigation:** Add `windowOffset` state for sub-month zoom views:
   ```tsx
   const [windowOffset, setWindowOffset] = useState(0)
   ```

3. **Remove ResizeObserver and dayWidth logic:** Delete these lines:
   - The `containerWidth` state and `wrapperRef` (keep the outer div ref only if needed for other purposes, otherwise remove)
   - The `useEffect` with `ResizeObserver`
   - The `daysInMonth`, `fixedWidth`, `dayWidth` calculations
   - The `FIXED_DAY_WIDTH`, `MIN_DAY_WIDTH`, `GANTT_MARGIN_LR` constants

4. **Compute `domain` from zoom + offset:** Add after the zoom state:
   ```tsx
   const daysInMonth = new Date(selectedPeriod.year, selectedPeriod.month + 1, 0).getDate()
   const MINUTES_PER_DAY = 1440
   const totalMinutes = daysInMonth * MINUTES_PER_DAY

   const zoomDays: Record<ZoomScale, number> = { '1w': 7, '2w': 14, '1m': daysInMonth }
   const windowDays = zoomDays[zoom]
   const maxOffset = Math.max(0, Math.ceil((daysInMonth - windowDays) / (zoom === '1w' ? 7 : 14)))

   const domainStart = windowOffset * (zoom === '1w' ? 7 : 14) * MINUTES_PER_DAY
   const domainEnd = Math.min(domainStart + windowDays * MINUTES_PER_DAY, totalMinutes)
   const domain: [number, number] = [domainStart, domainEnd]
   ```

5. **Reset windowOffset when zoom changes:**
   ```tsx
   const handleZoomChange = (v: string) => {
     if (v) {
       setZoom(v as ZoomScale)
       setWindowOffset(0)
     }
   }
   ```

6. **Add prev/next navigation buttons** next to the zoom toggle (only visible when zoom is not '1m'):
   ```tsx
   {zoom !== '1m' && (
     <>
       <Button
         variant="outline"
         size="sm"
         onClick={() => setWindowOffset((o) => Math.max(0, o - 1))}
         disabled={windowOffset === 0}
       >
         ←
       </Button>
       <Button
         variant="outline"
         size="sm"
         onClick={() => setWindowOffset((o) => Math.min(maxOffset, o + 1))}
         disabled={windowOffset >= maxOffset}
       >
         →
       </Button>
     </>
   )}
   ```
   Import `ChevronLeft` and `ChevronRight` from lucide-react is optional — plain arrows `←` `→` are fine.

7. **Replace GanttChart with TimelineChart:**
   ```tsx
   <TimelineChart
     events={events}
     year={selectedPeriod.year}
     month={selectedPeriod.month}
     domain={domain}
   />
   ```

8. **Update zoom ToggleGroup to use `handleZoomChange`:**
   ```tsx
   <ToggleGroup ... onValueChange={handleZoomChange}>
   ```

- [x] Verify build passes: `pnpm build`
- [x] Commit: `git add src/components/PacaTimeTab.tsx && git commit -m "feat: replace GanttChart with TimelineChart in PacaTimeTab"`

---

### Task 3: Remove old GanttChart and D3 dependencies

**Files:**
- Delete: `src/components/GanttChart.tsx`

- [x] Delete the old component: `rm src/components/GanttChart.tsx`
- [x] Remove D3 dependencies: `pnpm remove d3 @types/d3`
- [x] Verify no remaining D3 imports: search for `from 'd3'` or `from "d3"` across the codebase. There should be zero matches.
- [x] Verify build passes: `pnpm build`
- [x] Run lint: `pnpm lint`
- [x] Fix any lint issues if found
- [x] Commit: `git add -A && git commit -m "chore: remove GanttChart and D3 dependencies"`

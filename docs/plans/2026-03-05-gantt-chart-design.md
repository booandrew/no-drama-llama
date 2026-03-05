# Gantt Chart Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the table in PacaTime tab with a read-only D3.js Gantt chart showing Google Calendar events grouped by name, with days of the month on X axis.

**Architecture:** New `GanttChart` component renders an SVG via D3. Events from `useCalendarStore` are grouped by `summary` (Y axis rows), positioned by `start/end dateTime` on a time scale (X axis = month days). Colors cycle through existing `--chart-1..5` CSS variables.

**Tech Stack:** D3.js (new dep), React 19, TypeScript, Tailwind CSS v4 theme variables

---

### Task 1: Install D3 dependency

**Files:**
- Modify: `package.json`

**Step 1: Install d3 and types**

```bash
pnpm add d3 && pnpm add -D @types/d3
```

**Step 2: Verify install**

```bash
pnpm build
```

Expected: no errors

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add d3 dependency for Gantt chart"
```

---

### Task 2: Create GanttChart component

**Files:**
- Create: `src/components/GanttChart.tsx`

**Step 1: Create the component**

Create `src/components/GanttChart.tsx` with:

```tsx
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

import type { CalendarEvent } from '@/store/calendar'

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

const MARGIN = { top: 30, right: 20, bottom: 20, left: 180 }
const ROW_HEIGHT = 36
const BAR_HEIGHT = 22

interface GanttChartProps {
  events: CalendarEvent[]
  year: number
  month: number
}

export function GanttChart({ events, year, month }: GanttChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Time range: full month
    const timeMin = new Date(year, month, 1)
    const timeMax = new Date(year, month + 1, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    // Group events by summary
    const grouped = d3.group(events, (e) => e.summary ?? '(no title)')
    const taskNames = Array.from(grouped.keys()).sort()

    if (taskNames.length === 0) return

    // Dimensions
    const width = MARGIN.left + MARGIN.right + daysInMonth * 32
    const height = MARGIN.top + MARGIN.bottom + taskNames.length * ROW_HEIGHT

    svg.attr('width', width).attr('height', height)

    // Scales
    const xScale = d3
      .scaleTime()
      .domain([timeMin, timeMax])
      .range([MARGIN.left, width - MARGIN.right])

    const yScale = d3
      .scaleBand<string>()
      .domain(taskNames)
      .range([MARGIN.top, height - MARGIN.bottom])
      .padding(0.2)

    const colorMap = new Map(taskNames.map((name, i) => [name, CHART_COLORS[i % CHART_COLORS.length]]))

    // Grid lines (one per day)
    const g = svg.append('g')
    for (let day = 1; day <= daysInMonth; day++) {
      const x = xScale(new Date(year, month, day))
      g.append('line')
        .attr('x1', x)
        .attr('x2', x)
        .attr('y1', MARGIN.top)
        .attr('y2', height - MARGIN.bottom)
        .attr('stroke', 'var(--border)')
        .attr('stroke-width', 0.5)
    }

    // Horizontal row separators
    for (const name of taskNames) {
      const y = yScale(name)! + yScale.bandwidth()
      g.append('line')
        .attr('x1', MARGIN.left)
        .attr('x2', width - MARGIN.right)
        .attr('y1', y)
        .attr('y2', y)
        .attr('stroke', 'var(--border)')
        .attr('stroke-width', 0.5)
    }

    // X axis (day numbers)
    const xAxis = d3
      .axisTop(xScale)
      .ticks(d3.timeDay.every(1))
      .tickFormat((d) => d3.timeFormat('%-d')(d as Date))

    svg
      .append('g')
      .attr('transform', `translate(0,${MARGIN.top})`)
      .call(xAxis)
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g.selectAll('.tick text').attr('fill', 'var(--muted-foreground)').attr('font-size', '11px'),
      )
      .call((g) => g.selectAll('.tick line').attr('stroke', 'var(--border)'))

    // Y axis (task names)
    const yAxis = d3.axisLeft(yScale)

    svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},0)`)
      .call(yAxis)
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('.tick line').remove())
      .call((g) =>
        g
          .selectAll('.tick text')
          .attr('fill', 'var(--foreground)')
          .attr('font-size', '12px')
          .each(function () {
            // Truncate long names
            const el = d3.select(this)
            const text = el.text()
            if (text.length > 22) {
              el.text(text.slice(0, 20) + '...')
            }
          }),
      )

    // Today marker
    const today = new Date()
    if (today >= timeMin && today < timeMax) {
      const todayX = xScale(today)
      svg
        .append('line')
        .attr('x1', todayX)
        .attr('x2', todayX)
        .attr('y1', MARGIN.top)
        .attr('y2', height - MARGIN.bottom)
        .attr('stroke', 'var(--destructive)')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3')
    }

    // Event bars
    for (const event of events) {
      const name = event.summary ?? '(no title)'
      const startStr = event.start?.dateTime ?? event.start?.date
      const endStr = event.end?.dateTime ?? event.end?.date
      if (!startStr || !endStr) continue

      const start = new Date(startStr)
      const end = new Date(endStr)

      // Clamp to month boundaries
      const clampedStart = start < timeMin ? timeMin : start
      const clampedEnd = end > timeMax ? timeMax : end

      const x = xScale(clampedStart)
      const barWidth = Math.max(xScale(clampedEnd) - x, 4) // min 4px for short events
      const y = yScale(name)
      if (y === undefined) continue

      const barY = y + (yScale.bandwidth() - BAR_HEIGHT) / 2

      // Duration text for tooltip
      const diffMin = Math.round((end.getTime() - start.getTime()) / 60000)
      const h = Math.floor(diffMin / 60)
      const m = diffMin % 60
      const duration = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
      const timeStr = start.toLocaleString('ru', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })

      const bar = svg
        .append('rect')
        .attr('x', x)
        .attr('y', barY)
        .attr('width', barWidth)
        .attr('height', BAR_HEIGHT)
        .attr('rx', 4)
        .attr('fill', colorMap.get(name)!)
        .attr('opacity', 0.85)

      bar.append('title').text(`${name}\n${timeStr}\n${duration}`)
    }
  }, [events, year, month])

  return (
    <div className="overflow-x-auto">
      <svg ref={svgRef} className="min-w-full" />
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: no type errors

**Step 3: Commit**

```bash
git add src/components/GanttChart.tsx
git commit -m "feat: add GanttChart component with D3"
```

---

### Task 3: Replace table with GanttChart in PacaTimeTab

**Files:**
- Modify: `src/components/PacaTimeTab.tsx`

**Step 1: Replace the Table with GanttChart**

In `src/components/PacaTimeTab.tsx`:
- Remove Table imports (`Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`)
- Add import: `import { GanttChart } from '@/components/GanttChart'`
- Replace the entire `{events.length > 0 && (<Table>...</Table>)}` block (lines 132-176) with:

```tsx
{events.length > 0 && (
  <GanttChart
    events={events}
    year={selectedPeriod.year}
    month={selectedPeriod.month}
  />
)}
```

**Step 2: Verify build**

```bash
pnpm build
```

Expected: no errors

**Step 3: Visual verification**

```bash
pnpm dev
```

Open browser, navigate to PacaTime tab, select a month with events. Verify:
- Days shown on X axis
- Task names on Y axis
- Bars positioned correctly
- Tooltip on hover shows event name, time, duration
- Today marker visible (if current month)
- Dark/light theme colors work

**Step 4: Commit**

```bash
git add src/components/PacaTimeTab.tsx
git commit -m "feat: replace events table with Gantt chart in PacaTime"
```

---

### Task 4: Lint and final check

**Step 1: Run lint**

```bash
pnpm lint
```

Fix any issues.

**Step 2: Final build**

```bash
pnpm build
```

Expected: clean build, no warnings

**Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: lint fixes for Gantt chart"
```

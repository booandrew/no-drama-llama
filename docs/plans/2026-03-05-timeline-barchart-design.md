# Replace D3 Gantt Chart with Recharts Horizontal Bar Chart

**Date:** 2026-03-05
**Status:** Approved

## Goal

Replace the custom D3.js-based `GanttChart` component with a horizontal stacked bar chart built on Recharts + shadcn `ChartContainer`. Same visual behavior (event bars positioned by time), but using the standard shadcn/ui chart stack instead of imperative D3 SVG.

## Architecture

### Approach: Stacked bars with transparent gaps

For each event name (Y-axis row), sort all occurrences by time and build alternating segments:

```
[gap_0, event_0, gap_1, event_1, ..., tail_gap]
```

- **Gap segments**: transparent, non-interactive, create correct offsets via stacking
- **Event segments**: colored, interactive (tooltip on hover)
- Segment values = durations in minutes
- Recharts stacking (`stackId="a"`) positions each segment after the previous

### Recharts layout

```tsx
<ChartContainer config={chartConfig}>
  <BarChart layout="vertical" data={data} stackOffset="none">
    <XAxis type="number" domain={domain} tickFormatter={formatDay} />
    <YAxis type="category" dataKey="name" width={180} />
    <ChartTooltip content={<CustomTooltipContent />} />
    <ReferenceLine x={todayMinutes} stroke="var(--destructive)" strokeDasharray="4 3" />
    {/* Dynamic: alternating gap + event Bar pairs */}
    <Bar dataKey="gap_0" stackId="a" fill="transparent" />
    <Bar dataKey="event_0" stackId="a" fill="var(--color-event-name)" />
    ...
  </BarChart>
</ChartContainer>
```

### X axis

- Numeric: minutes from start of month
- Ticks every 1440 min (= 1 day), formatted as day numbers: `Math.floor(val / 1440) + 1`
- Domain controlled by zoom level

### Y axis

- Category: event names (grouped by `summary`)
- Truncated to ~20 chars

### Colors

Each unique event name gets a color from `--chart-1..5` (cycling), applied via `ChartConfig`.

### Today marker

`<ReferenceLine x={minutesSinceMonthStart} />` with destructive color and dashed stroke.

## Interactivity

### Tooltip (keep)

Custom `ChartTooltipContent` that filters out gap segments. Shows:
- Event name
- Date/time (formatted)
- Duration (e.g., "1h 30m")

### Popover "Log Time" (remove)

Removed in this iteration. Can be added back later via custom bar `shape` + click handler.

### Zoom controls (keep)

Toggle group 1W / 2W / 1M controls `XAxis domain`:
- **1M**: `[0, daysInMonth * 1440]`
- **2W**: 14-day sliding window with prev/next navigation
- **1W**: 7-day sliding window with prev/next navigation

State: `zoom` (scale) + `windowOffset` (which week/biweek to show).

## What changes

### Remove
- `d3` and `@types/d3` dependencies
- Popover "Log Time" from chart
- Manual `ResizeObserver` in `PacaTimeTab` (shadcn `ChartContainer` handles responsive)
- `dayWidth` calculation logic

### Keep
- Period selector (month/year)
- Zoom toggle (1W/2W/1M) + navigation for sub-month views
- Refresh button
- Today marker

### Files
- **Rewrite**: `src/components/GanttChart.tsx` -> `src/components/TimelineChart.tsx`
- **Modify**: `src/components/PacaTimeTab.tsx` (new import, remove ResizeObserver/dayWidth, add window navigation for zoom)

## Data transformation

```ts
function buildChartData(events: CalendarEvent[], year: number, month: number) {
  const monthStartMs = new Date(year, month, 1).getTime()
  const totalMinutes = daysInMonth * 1440

  // Group by summary, sort occurrences by start time
  const grouped = groupBy(events, e => e.summary ?? '(no title)')

  // Find max occurrences across all groups
  const maxSlots = Math.max(...Object.values(grouped).map(g => g.length))

  // For each group: build gap/event pairs
  return Object.entries(grouped).map(([name, occurrences]) => {
    const sorted = occurrences.sort(byStartTime)
    const row: Record<string, number> = { name }
    let cursor = 0

    sorted.forEach((event, i) => {
      const startMin = toMinuteOffset(event.start, monthStartMs)
      const endMin = toMinuteOffset(event.end, monthStartMs)
      row[`gap_${i}`] = startMin - cursor
      row[`event_${i}`] = endMin - startMin
      cursor = endMin
    })

    // Fill unused slots with 0
    for (let i = sorted.length; i < maxSlots; i++) {
      row[`gap_${i}`] = 0
      row[`event_${i}`] = 0
    }

    // Tail gap to fill remaining month
    row.tail = totalMinutes - cursor
    return row
  })
}
```

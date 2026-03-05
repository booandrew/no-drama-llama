import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CalendarEvent } from '@/store/calendar'

const MINUTES_PER_DAY = 1440

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

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

function buildChartData(events: CalendarEvent[], year: number, month: number) {
  const monthStart = new Date(year, month, 1)
  const monthStartMs = monthStart.getTime()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalMinutes = daysInMonth * MINUTES_PER_DAY

  const grouped = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const name = e.summary ?? '(no title)'
    const list = grouped.get(name) ?? []
    list.push(e)
    grouped.set(name, list)
  }

  const taskNames = Array.from(grouped.keys()).sort()

  let maxSlots = 0
  for (const list of grouped.values()) {
    if (list.length > maxSlots) maxSlots = list.length
  }

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

      segmentMeta.set(`${name}::event_${i}`, {
        name,
        startTime: new Date(event.start?.dateTime ?? event.start?.date ?? 0),
        endTime: new Date(event.end?.dateTime ?? event.end?.date ?? 0),
        durationMin: duration,
      })
    })

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

  const colorMap = useMemo(() => {
    const map = new Map<string, string>()
    taskNames.forEach((name, i) => {
      map.set(name, CHART_COLORS[i % CHART_COLORS.length])
    })
    return map
  }, [taskNames])

  const todayMinutes = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 1)
    if (now < monthStart || now >= monthEnd) return null
    return Math.round((now.getTime() - monthStart.getTime()) / 60000)
  }, [year, month])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const chartDomain = domain ?? [0, totalMinutes]

  // Generate day tick values (centered within each day)
  const ticks = useMemo(() => {
    const t: number[] = []
    const half = MINUTES_PER_DAY / 2
    for (let d = 0; d < daysInMonth; d++) {
      t.push(d * MINUTES_PER_DAY + half)
    }
    return t
  }, [daysInMonth])

  const [tooltip, setTooltip] = useState<{
    meta: SegmentMeta
    x: number
    y: number
  } | null>(null)

  const [selectedMeta, setSelectedMeta] = useState<SegmentMeta | null>(null)

  if (taskNames.length === 0) return null

  const chartHeight = Math.max(200, taskNames.length * 44 + 60)

  return (
    <>
      <div className="relative">
        <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
          <BarChart
            layout="vertical"
            data={data}
            stackOffset="none"
            margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
            barCategoryGap="20%"
          >
            <CartesianGrid vertical={true} horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              domain={chartDomain}
              allowDataOverflow={true}
              orientation="top"
              ticks={ticks}
              tickFormatter={(val: number) => `${Math.floor(val / MINUTES_PER_DAY) + 1}`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={180}
              tickFormatter={(val: string) => (val.length > 20 ? val.slice(0, 18) + '...' : val)}
              axisLine={false}
              tickLine={false}
            />
            {todayMinutes !== null && (
              <ReferenceLine
                x={todayMinutes}
                stroke="var(--destructive)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            )}
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
                shape={(shapeProps: unknown) => {
                  const { x, y, width, height, payload } = shapeProps as {
                    x: number
                    y: number
                    width: number
                    height: number
                    payload: { name: string }
                  }
                  if (!width || width <= 0) return <rect />
                  const metaKey = `${payload.name}::event_${i}`
                  const meta = segmentMeta.get(metaKey)
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
                      onClick={() => {
                        if (meta) {
                          setTooltip(null)
                          setSelectedMeta(meta)
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (!meta) return
                        const svgRect = (
                          e.currentTarget as SVGRectElement
                        ).getBoundingClientRect()
                        const chartEl = (e.currentTarget as SVGRectElement).closest(
                          '[data-slot="chart"]',
                        )
                        if (!chartEl) return
                        const containerRect = chartEl.getBoundingClientRect()
                        setTooltip({
                          meta,
                          x: svgRect.left - containerRect.left + svgRect.width / 2,
                          y: svgRect.top - containerRect.top,
                        })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )
                }}
              />,
            ]).flat()}
            <Bar
              dataKey="tail"
              stackId="a"
              fill="transparent"
              isAnimationActive={false}
              style={{ pointerEvents: 'none' }}
            />
          </BarChart>
        </ChartContainer>

        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-background px-3 py-2 text-sm shadow-md"
            style={{ left: tooltip.x, top: tooltip.y - 4 }}
          >
            <p className="font-medium">{tooltip.meta.name}</p>
            <p className="text-muted-foreground">
              {tooltip.meta.startTime.toLocaleString('ru', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' — '}
              {tooltip.meta.endTime.toLocaleString('ru', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <p className="text-muted-foreground">{formatDuration(tooltip.meta.durationMin)}</p>
          </div>
        )}
      </div>

      <Dialog
        open={!!selectedMeta}
        onOpenChange={(open: boolean) => {
          if (!open) setSelectedMeta(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedMeta?.name}</DialogTitle>
          </DialogHeader>
          {selectedMeta && (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Start</span>
                <span>
                  {selectedMeta.startTime.toLocaleString('ru', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">End</span>
                <span>
                  {selectedMeta.endTime.toLocaleString('ru', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">
                  Duration
                </span>
                <span>{formatDuration(selectedMeta.durationMin)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

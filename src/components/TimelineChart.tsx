import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bar, BarChart, ReferenceLine, XAxis, YAxis } from 'recharts'

import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CalendarEvent } from '@/store/calendar'

const MINUTES_PER_DAY = 1440

const BAR_COLOR = 'var(--chart-1)'

interface TimelineChartProps {
  events: CalendarEvent[]
  year: number
  month: number
  domain?: [number, number]
  hideYAxis?: boolean
}

interface SegmentMeta {
  name: string
  startTime: Date
  endTime: Date
  durationMin: number
  solid: boolean
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
        solid: Math.random() > 0.5,
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

export function TimelineChart({ events, year, month, domain, hideYAxis }: TimelineChartProps) {
  const { data, taskNames, maxSlots, totalMinutes, segmentMeta } = useMemo(
    () => buildChartData(events, year, month),
    [events, year, month],
  )

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {}
    taskNames.forEach((name) => {
      config[name] = {
        label: name.length > 20 ? name.slice(0, 18) + '...' : name,
        color: BAR_COLOR,
      }
    })
    return config
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

  // Day label ticks at noon (centered within each day)
  const ticks = useMemo(() => {
    const t: number[] = []
    const half = MINUTES_PER_DAY / 2
    for (let d = 0; d < daysInMonth; d++) {
      t.push(d * MINUTES_PER_DAY + half)
    }
    return t
  }, [daysInMonth])

  // Day boundary lines at midnight
  const dayBoundaries = useMemo(() => {
    const b: number[] = []
    for (let d = 0; d <= daysInMonth; d++) {
      b.push(d * MINUTES_PER_DAY)
    }
    return b
  }, [daysInMonth])

  const [tooltip, setTooltip] = useState<{
    meta: SegmentMeta
    clientX: number
    clientY: number
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
            margin={{ top: 10, right: 20, bottom: 10, left: hideYAxis ? 0 : 10 }}
            barCategoryGap="20%"
          >
            {dayBoundaries.map((min) => (
              <ReferenceLine
                key={`day-${min}`}
                x={min}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
            ))}
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
              width={hideYAxis ? 0 : 180}
              hide={hideYAxis}
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
                  const isSolid = meta?.solid ?? true
                  return (
                    <rect
                      x={isSolid ? x : x + 1}
                      y={isSolid ? y : y + 1}
                      width={isSolid ? width : Math.max(0, width - 2)}
                      height={isSolid ? height : Math.max(0, height - 2)}
                      rx={4}
                      fill={BAR_COLOR}
                      stroke={isSolid ? 'none' : BAR_COLOR}
                      strokeWidth={isSolid ? 0 : 1}
                      fillOpacity={isSolid ? 1 : 0.3}
                      strokeOpacity={isSolid ? 0 : 1}
                      className="cursor-pointer hover:fill-opacity-100 hover:stroke-opacity-100"
                      onClick={() => {
                        if (meta) {
                          setTooltip(null)
                          setSelectedMeta(meta)
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (!meta) return
                        const svgRect = (e.currentTarget as SVGRectElement).getBoundingClientRect()
                        setTooltip({
                          meta,
                          clientX: svgRect.left + svgRect.width / 2,
                          clientY: svgRect.top,
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

      </div>

      {tooltip &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border bg-background px-3 py-2 text-sm shadow-md"
            style={{ left: tooltip.clientX, top: tooltip.clientY - 4 }}
          >
            <p className="font-medium">{tooltip.meta.name}</p>
            <p className="text-muted-foreground">
              {tooltip.meta.startTime.toLocaleString('en-US', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' — '}
              {tooltip.meta.endTime.toLocaleString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <p className="text-muted-foreground">{formatDuration(tooltip.meta.durationMin)}</p>
          </div>,
          document.body,
        )}

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
                  {selectedMeta.startTime.toLocaleString('en-US', {
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
                  {selectedMeta.endTime.toLocaleString('en-US', {
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

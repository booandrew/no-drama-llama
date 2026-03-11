import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bar, BarChart, ReferenceLine, XAxis, YAxis } from 'recharts'

import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import type { DdsJiraIssue, DdsTask, TaskUpdate } from '@/lib/duckdb/queries'

const MINUTES_PER_DAY = 1440

const BAR_COLOR = 'var(--chart-1)'
const MIN_BAR_PX = 3

interface TimelineChartProps {
  tasks: DdsTask[]
  issues?: DdsJiraIssue[]
  onTaskUpdate?: (taskId: string, fields: TaskUpdate) => void
  year: number
  month: number
  domain?: [number, number]
  hideYAxis?: boolean
  hideXAxis?: boolean
  effectiveMinutesPerDay?: number
  workStartMinute?: number
  barColors?: string[]
}

interface SegmentMeta {
  name: string
  taskId: string
  issueKey: string | null
  issueName: string | null
  projectKey: string | null
  duration: string
  startTime: Date
  endTime: Date
  durationMin: number
  solid: boolean
  readOnly: boolean
}

function parseDuration(dur: string): number {
  const hMatch = dur.match(/(\d+)h/)
  const mMatch = dur.match(/(\d+)m/)
  if (hMatch || mMatch) {
    return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0)
  }
  // Raw seconds (e.g. "28800" from Jira API timeSpentSeconds)
  const n = Number(dur)
  return n > 0 ? Math.round(n / 60) : 0
}

function remapMinutes(absoluteMin: number, effectiveMpd: number, workStartMin: number): number {
  if (effectiveMpd >= MINUTES_PER_DAY) return absoluteMin
  const day = Math.floor(absoluteMin / MINUTES_PER_DAY)
  const timeInDay = absoluteMin % MINUTES_PER_DAY
  const adjusted = Math.max(0, Math.min(effectiveMpd, timeInDay - workStartMin))
  return day * effectiveMpd + adjusted
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function minutesToDurationStr(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function sourceTypeOrder(source: string): number {
  if (source === 'jira_worklog') return 0
  if (source === 'custom_input') return 1
  return 2
}

function buildChartData(
  tasks: DdsTask[],
  year: number,
  month: number,
  effectiveMpd: number,
  workStartMin: number,
) {
  const monthStart = new Date(year, month, 1)
  const monthStartMs = monthStart.getTime()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalMinutes = daysInMonth * effectiveMpd

  // Group by source-dependent key
  const grouped = new Map<string, DdsTask[]>()
  for (const t of tasks) {
    const desc = t.description ?? '(no title)'
    const typeOrd = sourceTypeOrder(t.source)
    let key: string
    if (typeOrd === 0) {
      key = `wl::${t.issue_key ?? desc}`
    } else if (typeOrd === 1) {
      key = `ci::${desc}`
    } else {
      key = `cal::${desc}::${t.issue_key ?? ''}`
    }
    const list = grouped.get(key) ?? []
    list.push(t)
    grouped.set(key, list)
  }

  // Sort: type group order, then mapped first, then alpha
  const sortedKeys = Array.from(grouped.keys()).sort((a, b) => {
    const aType = sourceTypeOrder(grouped.get(a)![0].source)
    const bType = sourceTypeOrder(grouped.get(b)![0].source)
    if (aType !== bType) return aType - bType
    const aIssue = grouped.get(a)![0].issue_key
    const bIssue = grouped.get(b)![0].issue_key
    if (!!aIssue !== !!bIssue) return aIssue ? -1 : 1
    const aName = grouped.get(a)![0].description ?? '(no title)'
    const bName = grouped.get(b)![0].description ?? '(no title)'
    return aName.localeCompare(bName)
  })

  const taskNames = sortedKeys.map((k) => grouped.get(k)![0].description ?? '(no title)')

  let maxSlots = 0
  for (const list of grouped.values()) {
    if (list.length > maxSlots) maxSlots = list.length
  }

  const segmentMeta: Map<string, SegmentMeta> = new Map()

  const data = sortedKeys.map((groupKey, rowIdx) => {
    const occurrences = grouped.get(groupKey)!
    const displayName = occurrences[0].description ?? '(no title)'
    const isReadOnly = occurrences[0].source === 'jira_worklog'
    const sorted = [...occurrences].sort((a, b) =>
      String(a.start_time ?? '').localeCompare(String(b.start_time ?? '')),
    )

    const row: Record<string, string | number> = { name: displayName, _rowIdx: rowIdx }
    let cursor = 0

    sorted.forEach((task, i) => {
      const durationMin = parseDuration(task.duration)
      const taskStartMs = task.start_time ? new Date(task.start_time).getTime() : 0
      const rawStartMin = Math.max(0, Math.round((taskStartMs - monthStartMs) / 60000))
      const startMin = remapMinutes(rawStartMin, effectiveMpd, workStartMin)
      const rawEndMin = rawStartMin + durationMin
      const endMin = remapMinutes(rawEndMin, effectiveMpd, workStartMin)
      const clampedStart = Math.max(0, Math.min(totalMinutes, startMin))
      const clampedEnd = Math.max(0, Math.min(totalMinutes, endMin))
      const gap = Math.max(0, clampedStart - cursor)
      const duration = Math.max(0, clampedEnd - clampedStart)

      row[`gap_${i}`] = gap
      row[`event_${i}`] = duration
      cursor = clampedStart + duration

      segmentMeta.set(`${rowIdx}::event_${i}`, {
        name: displayName,
        taskId: task.task_id,
        issueKey: task.issue_key,
        issueName: task.issue_name,
        projectKey: task.project_key,
        duration: task.duration,
        startTime: new Date(task.start_time),
        endTime: new Date(taskStartMs + durationMin * 60000),
        durationMin: duration,
        solid: !!task.issue_key,
        readOnly: isReadOnly,
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

function formatDateShort(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const QUICK_LOG_OPTIONS = [
  { label: '+30min', minutes: 30 },
  { label: '+1h', minutes: 60 },
  { label: '+2h', minutes: 120 },
] as const

function EventDetailDialog({
  meta,
  issues,
  onTaskUpdate,
  onClose,
}: {
  meta: SegmentMeta
  issues: DdsJiraIssue[]
  onTaskUpdate?: (taskId: string, fields: TaskUpdate) => void
  onClose: () => void
}) {
  const [selectedIssue, setSelectedIssue] = useState<string | null>(meta.issueKey)
  const currentMin = parseDuration(meta.duration)
  const [durationInput, setDurationInput] = useState(meta.duration)

  const issueItems = issues.map((i) => ({ key: i.issue_key, summary: i.issue_name }))

  const handleIssueChange = (val: string | null) => {
    setSelectedIssue(val)
    if (!onTaskUpdate) return
    const issue = issues.find((i) => i.issue_key === val)
    onTaskUpdate(meta.taskId, {
      issue_key: val,
      issue_name: issue?.issue_name ?? null,
      project_key: issue?.project_key ?? null,
    })
  }

  const handleDurationBlur = () => {
    if (!onTaskUpdate) return
    const parsed = parseDuration(durationInput)
    if (parsed > 0 && durationInput !== meta.duration) {
      onTaskUpdate(meta.taskId, { duration: minutesToDurationStr(parsed) })
    }
  }

  const handleQuickLog = (addMinutes: number) => {
    if (!onTaskUpdate) return
    const newMin = currentMin + addMinutes
    const newDur = minutesToDurationStr(newMin)
    setDurationInput(newDur)
    onTaskUpdate(meta.taskId, { duration: newDur })
  }

  return (
    <Dialog open onOpenChange={(open: boolean) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{meta.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 text-sm">
          {/* Date & Time */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-muted-foreground text-xs uppercase tracking-wide shrink-0">
                Start
              </span>
              <span className="text-right">{formatDateShort(meta.startTime)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-muted-foreground text-xs uppercase tracking-wide shrink-0">
                End
              </span>
              <span className="text-right">{formatDateShort(meta.endTime)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-muted-foreground text-xs uppercase tracking-wide shrink-0">
                Duration
              </span>
              <Input
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                onBlur={handleDurationBlur}
                disabled={meta.readOnly}
                className="h-7 w-24 text-right text-sm font-medium"
              />
            </div>
          </div>

          {/* Jira Issue Mapping */}
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
              Jira Issue
            </span>
            <Combobox
              value={selectedIssue}
              onValueChange={(val) => handleIssueChange(val as string | null)}
              disabled={meta.readOnly}
            >
              <ComboboxInput placeholder="Search issues..." className="h-9 w-full" disabled={meta.readOnly} />
              <ComboboxContent>
                <ComboboxList>
                  <ComboboxEmpty>No issues found</ComboboxEmpty>
                  {issueItems.map((issue) => (
                    <ComboboxItem key={issue.key} value={issue.key}>
                      <span className="font-medium">{issue.key}</span>
                      <span className="text-muted-foreground truncate">{issue.summary}</span>
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          {!meta.readOnly && (
            <>
              <Separator />

              {/* Quick Log Add */}
              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">
                  Quick Log Add
                </span>
                <div className="flex gap-2">
                  {QUICK_LOG_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      className="rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                      onClick={() => handleQuickLog(opt.minutes)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function TimelineChart({
  tasks,
  issues,
  onTaskUpdate,
  year,
  month,
  domain,
  hideYAxis,
  hideXAxis,
  effectiveMinutesPerDay,
  workStartMinute,
  barColors,
}: TimelineChartProps) {
  const effectiveMpd = effectiveMinutesPerDay ?? MINUTES_PER_DAY
  const workStartMin = workStartMinute ?? 0

  const { data, taskNames, maxSlots, totalMinutes, segmentMeta } = useMemo(
    () => buildChartData(tasks, year, month, effectiveMpd, workStartMin),
    [tasks, year, month, effectiveMpd, workStartMin],
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
    const rawMin = Math.round((now.getTime() - monthStart.getTime()) / 60000)
    return remapMinutes(rawMin, effectiveMpd, workStartMin)
  }, [year, month, effectiveMpd, workStartMin])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const chartDomain = domain ?? [0, totalMinutes]

  // Day label ticks at noon (centered within each day)
  const ticks = useMemo(() => {
    const t: number[] = []
    const half = effectiveMpd / 2
    for (let d = 0; d < daysInMonth; d++) {
      t.push(d * effectiveMpd + half)
    }
    return t
  }, [daysInMonth, effectiveMpd])

  // Day boundary lines at midnight
  const dayBoundaries = useMemo(() => {
    const b: number[] = []
    for (let d = 0; d <= daysInMonth; d++) {
      b.push(d * effectiveMpd)
    }
    return b
  }, [daysInMonth, effectiveMpd])

  const [tooltip, setTooltip] = useState<{
    meta: SegmentMeta
    clientX: number
    clientY: number
  } | null>(null)

  const [selectedMeta, setSelectedMeta] = useState<SegmentMeta | null>(null)

  if (taskNames.length === 0) return null

  const chartHeight = hideXAxis
    ? Math.max(200, taskNames.length * 44 + 20)
    : Math.max(200, taskNames.length * 44 + 60)

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
              tickFormatter={(val: number) => `${Math.floor(val / effectiveMpd) + 1}`}
              axisLine={false}
              tickLine={false}
              hide={hideXAxis}
              height={hideXAxis ? 0 : undefined}
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
                    payload: { name: string; _rowIdx: number }
                  }
                  if (!width || width <= 0) return <rect />
                  const metaKey = `${payload._rowIdx}::event_${i}`
                  const meta = segmentMeta.get(metaKey)
                  const isSolid = meta?.solid ?? true
                  const w = Math.max(MIN_BAR_PX, width)
                  const barX = width < MIN_BAR_PX ? x - (MIN_BAR_PX - width) / 2 : x
                  const rowColor = barColors?.[payload._rowIdx] ?? BAR_COLOR
                  return (
                    <rect
                      x={isSolid ? barX : barX + 1}
                      y={isSolid ? y : y + 1}
                      width={isSolid ? w : Math.max(0, w - 2)}
                      height={isSolid ? height : Math.max(0, height - 2)}
                      rx={4}
                      fill={rowColor}
                      stroke={isSolid ? 'none' : rowColor}
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

      {selectedMeta && (
        <EventDetailDialog
          meta={selectedMeta}
          issues={issues ?? []}
          onTaskUpdate={onTaskUpdate}
          onClose={() => setSelectedMeta(null)}
        />
      )}
    </>
  )
}

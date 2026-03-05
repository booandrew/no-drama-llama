import { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import { CalendarIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
  const axesRef = useRef<SVGGElement>(null)

  const { taskNames, width, height, bars } = useMemo(() => {
    const timeMin = new Date(year, month, 1)
    const timeMax = new Date(year, month + 1, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const grouped = d3.group(events, (e) => e.summary ?? '(no title)')
    const taskNames = Array.from(grouped.keys()).sort()

    const width = MARGIN.left + MARGIN.right + daysInMonth * 32
    const height = MARGIN.top + MARGIN.bottom + taskNames.length * ROW_HEIGHT

    const xScale = d3
      .scaleTime()
      .domain([timeMin, timeMax])
      .range([MARGIN.left, width - MARGIN.right])

    const yScale = d3
      .scaleBand<string>()
      .domain(taskNames)
      .range([MARGIN.top, height - MARGIN.bottom])
      .padding(0.2)

    const colorMap = new Map(
      taskNames.map((name, i) => [name, CHART_COLORS[i % CHART_COLORS.length]]),
    )

    const bars = events
      .map((event, idx) => {
        const name = event.summary ?? '(no title)'
        const startStr = event.start?.dateTime ?? event.start?.date
        const endStr = event.end?.dateTime ?? event.end?.date
        if (!startStr || !endStr) return null

        const start = new Date(startStr)
        const end = new Date(endStr)
        const clampedStart = start < timeMin ? timeMin : start
        const clampedEnd = end > timeMax ? timeMax : end

        const x = xScale(clampedStart)
        const barWidth = Math.max(xScale(clampedEnd) - x, 4)
        const y = yScale(name)
        if (y === undefined) return null
        const barY = y + (yScale.bandwidth() - BAR_HEIGHT) / 2

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
        const dateObj = new Date(start)
        const timeValue = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`

        return {
          key: `${event.id}-${idx}`,
          name,
          x,
          barY,
          barWidth,
          color: colorMap.get(name)!,
          timeStr,
          duration,
          dateObj,
          timeValue,
        }
      })
      .filter((b) => b !== null)

    return { taskNames, width, height, bars }
  }, [events, year, month])

  // D3 renders axes, grid, and today marker
  useEffect(() => {
    if (!axesRef.current || taskNames.length === 0) return

    const g = d3.select(axesRef.current)
    g.selectAll('*').remove()

    const timeMin = new Date(year, month, 1)
    const timeMax = new Date(year, month + 1, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const xScale = d3
      .scaleTime()
      .domain([timeMin, timeMax])
      .range([MARGIN.left, width - MARGIN.right])

    const yScale = d3
      .scaleBand<string>()
      .domain(taskNames)
      .range([MARGIN.top, height - MARGIN.bottom])
      .padding(0.2)

    // Vertical grid lines (one per day)
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

    g.append('g')
      .attr('transform', `translate(0,${MARGIN.top})`)
      .call(xAxis)
      .call((sel) => sel.select('.domain').remove())
      .call((sel) =>
        sel
          .selectAll('.tick text')
          .attr('fill', 'var(--muted-foreground)')
          .attr('font-size', '11px'),
      )
      .call((sel) => sel.selectAll('.tick line').attr('stroke', 'var(--border)'))

    // Y axis (task names)
    const yAxis = d3.axisLeft(yScale)

    g.append('g')
      .attr('transform', `translate(${MARGIN.left},0)`)
      .call(yAxis)
      .call((sel) => sel.select('.domain').remove())
      .call((sel) => sel.selectAll('.tick line').remove())
      .call((sel) =>
        sel
          .selectAll('.tick text')
          .attr('fill', 'var(--foreground)')
          .attr('font-size', '12px')
          .each(function () {
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
      g.append('line')
        .attr('x1', todayX)
        .attr('x2', todayX)
        .attr('y1', MARGIN.top)
        .attr('y2', height - MARGIN.bottom)
        .attr('stroke', 'var(--destructive)')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3')
    }
  }, [year, month, taskNames, width, height])

  if (taskNames.length === 0) return null

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="min-w-full">
          <g ref={axesRef} />
          {bars.map((bar) => (
            <Popover key={bar.key}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <rect
                      x={bar.x}
                      y={bar.barY}
                      width={bar.barWidth}
                      height={BAR_HEIGHT}
                      rx={4}
                      fill={bar.color}
                      opacity={0.85}
                      className="cursor-pointer hover:opacity-100"
                    />
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{bar.name}</p>
                  <p>{bar.timeStr}</p>
                  <p>{bar.duration}</p>
                </TooltipContent>
              </Tooltip>
              <PopoverContent className="w-auto">
                <PopoverHeader>
                  <PopoverTitle>Log Time</PopoverTitle>
                </PopoverHeader>
                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Date & Time</Label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="flex-1 justify-start font-normal">
                            <CalendarIcon className="mr-2 size-4" />
                            {bar.dateObj.toLocaleDateString('ru', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={bar.dateObj}
                            defaultMonth={bar.dateObj}
                          />
                        </PopoverContent>
                      </Popover>
                      <Input type="time" defaultValue={bar.timeValue} className="w-24" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`name-${bar.key}`}>Event Name</Label>
                    <Input id={`name-${bar.key}`} defaultValue={bar.name} readOnly />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`task-${bar.key}`}>Task Mapping</Label>
                    <Input id={`task-${bar.key}`} placeholder="e.g. CIP-33" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Quick Duration</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        +30 min
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        +1h
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        +2h
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ))}
        </svg>
      </div>
    </TooltipProvider>
  )
}

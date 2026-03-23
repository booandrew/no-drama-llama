import { useMemo } from 'react'
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

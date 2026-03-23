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

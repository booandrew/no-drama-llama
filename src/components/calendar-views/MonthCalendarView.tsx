import { useMemo } from 'react'
import { EventBlock } from '@/components/calendar-views/EventBlock'
import type { DdsJiraIssue, DdsJiraWorklog, DdsTask } from '@/lib/duckdb/queries'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface MonthCalendarViewProps {
  year: number
  month: number
  tasks: DdsTask[]
  worklogs: DdsJiraWorklog[]
  issues: DdsJiraIssue[]
  onTaskClick: (task: DdsTask) => void
}

export function MonthCalendarView({
  year,
  month,
  tasks,
  onTaskClick,
}: MonthCalendarViewProps) {
  const { cells, tasksByDate } = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()

    // Monday = 0 in our grid. JS getDay(): 0=Sun,1=Mon...
    const startDow = (firstDay.getDay() + 6) % 7 // convert to Mon=0
    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7

    const cells: { date: Date; inMonth: boolean }[] = []
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(year, month, 1 - startDow + i)
      cells.push({
        date: d,
        inMonth: d.getMonth() === month && d.getFullYear() === year,
      })
    }

    // Group tasks by date
    const tasksByDate = new Map<string, DdsTask[]>()
    for (const t of tasks) {
      if (!t.start_time) continue
      const key = new Date(t.start_time).toISOString().slice(0, 10)
      if (!tasksByDate.has(key)) tasksByDate.set(key, [])
      tasksByDate.get(key)!.push(t)
    }

    return { cells, tasksByDate }
  }, [year, month, tasks])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Day-of-week headers */}
      <div className="grid shrink-0 grid-cols-7 border-b">
        {DAY_HEADERS.map((name) => (
          <div
            key={name}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid flex-1 grid-cols-7 auto-rows-fr overflow-y-auto">
        {cells.map((cell, i) => {
          const dateStr = cell.date.toISOString().slice(0, 10)
          const isToday = dateStr === today
          const dayTasks = tasksByDate.get(dateStr) ?? []

          return (
            <div
              key={i}
              className={`border-b border-r p-1 min-h-24 ${!cell.inMonth ? 'bg-muted/30' : ''}`}
            >
              <div
                className={`mb-0.5 text-sm ${isToday ? 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold' : cell.inMonth ? 'font-medium' : 'text-muted-foreground'}`}
              >
                {cell.date.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 4).map((t) => (
                  <EventBlock key={t.task_id} task={t} compact onClick={onTaskClick} />
                ))}
                {dayTasks.length > 4 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{dayTasks.length - 4} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { CalendarDays, PencilLine, ScrollText, type LucideIcon } from 'lucide-react'

export type RowType = 'worklog' | 'custom' | 'calendar'

export const SOURCE_TYPE_LEGEND: { type: RowType; fullLabel: string }[] = [
  { type: 'worklog', fullLabel: 'Jira Worklog' },
  { type: 'custom', fullLabel: 'Manual Input' },
  { type: 'calendar', fullLabel: 'Google Calendar' },
]

export const SOURCE_TYPE_CONFIG: Record<
  RowType,
  { fullLabel: string; barColor: string; className: string; icon: LucideIcon }
> = {
  worklog: {
    fullLabel: 'Jira Worklog',
    barColor: '#22c55e',
    className: 'bg-green-500/20 text-green-700 dark:text-green-400',
    icon: ScrollText,
  },
  custom: {
    fullLabel: 'Manual Input',
    barColor: '#f97316',
    className: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
    icon: PencilLine,
  },
  calendar: {
    fullLabel: 'Google Calendar',
    barColor: '#3b82f6',
    className: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
    icon: CalendarDays,
  },
}

export function getRowType(source: string): RowType {
  if (source === 'jira_worklog') return 'worklog'
  if (source === 'custom_input') return 'custom'
  return 'calendar'
}

export function getSourceLabel(source: string) {
  return SOURCE_TYPE_CONFIG[getRowType(source)].fullLabel
}

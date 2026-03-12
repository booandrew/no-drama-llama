import type { DdsTask } from '@/lib/duckdb/queries'

const SOURCE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  jira_worklog: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/50',
    text: 'text-green-700 dark:text-green-300',
  },
  custom_input: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/50',
    text: 'text-orange-700 dark:text-orange-300',
  },
  gcal: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-700 dark:text-blue-300',
  },
}

function getColors(source: string, isMapped: boolean) {
  const c = SOURCE_COLORS[source] ?? SOURCE_COLORS.gcal
  if (!isMapped && source === 'gcal') {
    return { ...c, border: 'border-dashed border-blue-400/60' }
  }
  return c
}

interface EventBlockProps {
  task: DdsTask
  style?: React.CSSProperties
  className?: string
  compact?: boolean
  onClick?: (task: DdsTask) => void
}

export function EventBlock({ task, style, className = '', compact, onClick }: EventBlockProps) {
  const colors = getColors(task.source, !!task.issue_key)
  const title = task.description ?? '(no title)'

  if (compact) {
    return (
      <button
        className={`w-full truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight border ${colors.bg} ${colors.border} ${colors.text} ${className}`}
        style={style}
        onClick={() => onClick?.(task)}
        title={title}
      >
        {title}
      </button>
    )
  }

  return (
    <button
      className={`absolute overflow-hidden rounded border px-1.5 py-0.5 text-left text-xs leading-tight ${colors.bg} ${colors.border} ${colors.text} ${className}`}
      style={{ ...style, minHeight: 20 }}
      onClick={() => onClick?.(task)}
      title={title}
    >
      <span className="font-medium truncate block">{title}</span>
    </button>
  )
}

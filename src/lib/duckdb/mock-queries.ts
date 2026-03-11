import type {
  SrcJiraIssue,
  SrcJiraWorklog,
  SrcCalendarEvent,
  SrcTempoWorkloadDay,
  SrcTempoHoliday,
  DdsJiraIssue,
  DdsJiraWorklog,
  DdsCalendarEvent,
  DdsTempoDailyCapacity,
  DdsCustomInput,
  DdsTask,
  TaskUpdate,
  AuditLogEntry,
} from './queries'
import {
  mockSrcJiraIssues,
  mockSrcJiraWorklogs,
  mockSrcCalendarEvents,
  mockSrcTempoWorkloadDays,
  mockSrcTempoHolidays,
  mockDdsJiraIssues,
  mockDdsJiraWorklogs,
  mockDdsCalendarEvents,
  mockDdsTempoDailyCapacity,
  mockDdsCustomInputs,
  mockDdsTasks,
} from '@/lib/mock-data'

function filterByDateRange<T>(rows: T[], field: keyof T, start: string, end: string): T[] {
  return rows.filter((r) => {
    const val = r[field]
    if (typeof val !== 'string') return false
    return val >= start && val < end
  })
}

export function readSrcJiraIssues(): Promise<(SrcJiraIssue & { loaded_at: string })[]> {
  const sorted = [...mockSrcJiraIssues].sort((a, b) => a.key.localeCompare(b.key))
  return Promise.resolve(sorted)
}

export function readSrcJiraWorklogs(
  dateStart: string,
  dateEnd: string,
): Promise<(SrcJiraWorklog & { loaded_at: string })[]> {
  const filtered = filterByDateRange(mockSrcJiraWorklogs, 'started', dateStart, dateEnd)
  return Promise.resolve(filtered.sort((a, b) => a.started.localeCompare(b.started)))
}

export function readSrcCalendarEvents(
  dateStart: string,
  dateEnd: string,
): Promise<(SrcCalendarEvent & { loaded_at: string })[]> {
  const filtered = mockSrcCalendarEvents.filter((e) => {
    if (!e.startDateTime) return false
    return e.startDateTime >= dateStart && e.startDateTime < dateEnd
  })
  return Promise.resolve(
    filtered.sort((a, b) => (a.startDateTime ?? '').localeCompare(b.startDateTime ?? '')),
  )
}

export function readSrcTempoWorkloadDays(): Promise<
  (SrcTempoWorkloadDay & { loaded_at: string })[]
> {
  const sorted = [...mockSrcTempoWorkloadDays].sort(
    (a, b) => a.scheme_id.localeCompare(b.scheme_id) || a.day - b.day,
  )
  return Promise.resolve(sorted)
}

export function readSrcTempoHolidays(
  dateStart: string,
  dateEnd: string,
): Promise<(SrcTempoHoliday & { loaded_at: string })[]> {
  const filtered = filterByDateRange(mockSrcTempoHolidays, 'date', dateStart, dateEnd)
  return Promise.resolve(filtered.sort((a, b) => a.date.localeCompare(b.date)))
}

export function readDdsJiraIssues(): Promise<DdsJiraIssue[]> {
  const sorted = [...mockDdsJiraIssues].sort((a, b) => a.issue_key.localeCompare(b.issue_key))
  return Promise.resolve(sorted)
}

export function readDdsJiraWorklogs(dateStart: string, dateEnd: string): Promise<DdsJiraWorklog[]> {
  const filtered = filterByDateRange(mockDdsJiraWorklogs, 'started', dateStart, dateEnd)
  return Promise.resolve(filtered.sort((a, b) => a.started.localeCompare(b.started)))
}

export function readDdsCalendarEvents(
  dateStart: string,
  dateEnd: string,
): Promise<DdsCalendarEvent[]> {
  const filtered = mockDdsCalendarEvents.filter((e) => {
    if (!e.start_time) return false
    return e.start_time >= dateStart && e.start_time < dateEnd
  })
  return Promise.resolve(
    filtered.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')),
  )
}

export function readDdsTempoDailyCapacity(
  dateStart: string,
  dateEnd: string,
): Promise<DdsTempoDailyCapacity[]> {
  const filtered = filterByDateRange(mockDdsTempoDailyCapacity, 'date', dateStart, dateEnd)
  return Promise.resolve(filtered.sort((a, b) => a.date.localeCompare(b.date)))
}

export function readDdsCustomInputs(
  dateStart: string,
  dateEnd: string,
): Promise<DdsCustomInput[]> {
  const filtered = mockDdsCustomInputs.filter((ci) => {
    if (!ci.start_time) return false
    return ci.start_time >= dateStart && ci.start_time < dateEnd
  })
  return Promise.resolve(
    filtered.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')),
  )
}

export function readDdsTasks(dateStart: string, dateEnd: string): Promise<DdsTask[]> {
  const filtered = mockDdsTasks.filter((t) => {
    if (!t.start_time) return false
    return t.start_time >= dateStart && t.start_time < dateEnd
  })
  // Keep only the latest revision per task_id
  const latestByTaskId = new Map<string, DdsTask>()
  for (const t of filtered) {
    const existing = latestByTaskId.get(t.task_id)
    if (!existing || t.revision > existing.revision) {
      latestByTaskId.set(t.task_id, t)
    }
  }
  const deduped = Array.from(latestByTaskId.values())
  return Promise.resolve(
    deduped.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')),
  )
}

export async function updateTask(taskId: string, fields: TaskUpdate): Promise<void> {
  for (const t of mockDdsTasks) {
    if (t.task_id === taskId) {
      if ('issue_key' in fields) t.issue_key = fields.issue_key ?? null
      if ('issue_name' in fields) t.issue_name = fields.issue_name ?? null
      if ('project_key' in fields) t.project_key = fields.project_key ?? null
      if ('duration' in fields) t.duration = fields.duration!
    }
  }
}

function parseDurationToMin(dur: string): number {
  const hMatch = dur.match(/(\d+)h/)
  const mMatch = dur.match(/(\d+)m/)
  if (hMatch || mMatch) {
    return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0)
  }
  const n = Number(dur)
  return n > 0 ? Math.round(n / 60) : 0
}

export async function createTask(task: Omit<DdsTask, 'revision'>): Promise<void> {
  // If source is custom_input, also create the DdsCustomInput entry
  if (task.source === 'custom_input') {
    const durationMin = parseDurationToMin(task.duration)
    const useHours = durationMin >= 60 && durationMin % 60 === 0
    mockDdsCustomInputs.push({
      id: task.task_id,
      input: task.description ?? '',
      duration: useHours ? durationMin / 60 : durationMin,
      time_unit: useHours ? 'hours' : 'minutes',
      start_time: task.start_time,
    })
  }
  mockDdsTasks.push({ ...task, revision: 0 })
}

// ── Audit Log (mock) ────────────────────────────────────────────────

const mockAuditLog: AuditLogEntry[] = []

export async function insertAuditLogEntry(entry: {
  id: string
  type: string
  status: string
  message: string
  details?: string
}): Promise<void> {
  mockAuditLog.push({
    id: entry.id,
    timestamp: new Date().toISOString(),
    type: entry.type,
    status: entry.status,
    message: entry.message,
    details: entry.details ?? null,
  })
}

export async function updateAuditLogEntry(
  id: string,
  updates: { status?: string; message?: string; details?: string },
): Promise<void> {
  const entry = mockAuditLog.find((e) => e.id === id)
  if (!entry) return
  if (updates.status !== undefined) entry.status = updates.status
  if (updates.message !== undefined) entry.message = updates.message
  if (updates.details !== undefined) entry.details = updates.details
}

export async function readAuditLogEntries(limit = 200): Promise<AuditLogEntry[]> {
  return mockAuditLog.slice(-limit)
}

export async function clearAuditLog(): Promise<void> {
  mockAuditLog.length = 0
}

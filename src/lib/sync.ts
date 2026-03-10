import {
  upsertSrcJiraIssues,
  upsertSrcJiraWorklogs,
  upsertSrcCalendarEvents,
  upsertSrcTempoWorkloadDays,
  upsertSrcTempoHolidays,
  upsertDdsJiraIssues,
  upsertDdsJiraWorklogs,
  upsertDdsCalendarEvents,
  upsertDdsTempoDailyCapacity,
  upsertTasksWithMappings,
  nextTaskRevision,
  cascadeJiraIssueAttributes,
} from '@/lib/duckdb/queries'
import type {
  DdsJiraIssue,
  DdsJiraWorklog,
  DdsCalendarEvent,
  DdsTempoDailyCapacity,
  SrcTempoWorkloadDay,
  SrcTempoHoliday,
} from '@/lib/duckdb/queries'
import { fetchIssues, fetchIssuesByIds, fetchWorklogs } from '@/lib/jira'
import { fetchTempoWorklogs, fetchUserSchedule } from '@/lib/tempo'
import { useCalendarStore } from '@/store/calendar'
import { useJiraStore } from '@/store/jira'
import { useTempoStore } from '@/store/tempo'

// ── Calendar API ──────────────────────────────────────────────────────

const CALENDAR_API = '/gcal-api/calendar/v3/calendars/primary/events'

interface GCalRawEvent {
  id: string
  iCalUID?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  summary?: string
  description?: string
  visibility?: string
  htmlLink?: string
}

async function fetchCalendarEvents(
  dateStart: string,
  dateEnd: string,
): Promise<GCalRawEvent[]> {
  const all: GCalRawEvent[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      timeMin: new Date(dateStart).toISOString(),
      timeMax: new Date(dateEnd).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(`${CALENDAR_API}?${params}`)

    if (!res.ok) {
      if (res.status === 401) {
        useCalendarStore.getState().setExpired()
        throw new Error('Google Calendar token expired')
      }
      throw new Error(`Calendar API error: ${res.status}`)
    }

    const data = await res.json()
    all.push(...(data.items ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return all
}

// ── Helpers ───────────────────────────────────────────────────────────

function diffMinutes(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
}

// ── Sync: Jira Issues ─────────────────────────────────────────────────

export async function syncJiraIssues() {
  const issues = await fetchIssues()

  // Upsert raw source
  await upsertSrcJiraIssues(
    issues.map((i) => ({
      id: i.id,
      key: i.key,
      summary: i.summary,
      project_key: i.projectKey,
      self: `https://jira.atlassian.com/browse/${i.key}`,
    })),
  )

  // Upsert DDS
  const ddsIssues: DdsJiraIssue[] = issues.map((i) => ({
    issue_id: i.id,
    issue_key: i.key,
    issue_name: i.summary,
    project_key: i.projectKey,
    link: `https://jira.atlassian.com/browse/${i.key}`,
  }))
  await upsertDdsJiraIssues(ddsIssues)

  // Cascade attributes to downstream tables
  await cascadeJiraIssueAttributes(ddsIssues)
}

// ── Sync: Jira Worklogs ──────────────────────────────────────────────

export async function syncJiraWorklogs(dateStart: string, dateEnd: string) {
  const tempoStatus = useTempoStore.getState().status
  const accountId = useJiraStore.getState().accountId

  let worklogs: import('@/lib/jira').JiraWorklog[]
  let issues: import('@/lib/jira').JiraIssue[]

  if (tempoStatus === 'connected' && accountId) {
    // Tempo connected — fetch worklogs from Tempo API, then resolve issues from Jira
    const tempo = await fetchTempoWorklogs(accountId, dateStart, dateEnd)
    worklogs = tempo.worklogs
    issues = await fetchIssuesByIds(tempo.issueIds)
  } else {
    // Tempo not connected — use Jira-native worklog flow
    const result = await fetchWorklogs(dateStart, dateEnd)
    worklogs = result.worklogs
    issues = result.issues
  }

  // Upsert raw source
  await upsertSrcJiraWorklogs(worklogs)

  // Backfill issues found via worklog search into DDS
  if (issues.length > 0) {
    await upsertSrcJiraIssues(
      issues.map((i) => ({
        id: i.id,
        key: i.key,
        summary: i.summary,
        project_key: i.projectKey,
        self: `https://jira.atlassian.com/browse/${i.key}`,
      })),
    )
    const newDdsIssues: DdsJiraIssue[] = issues.map((i) => ({
      issue_id: i.id,
      issue_key: i.key,
      issue_name: i.summary,
      project_key: i.projectKey,
      link: `https://jira.atlassian.com/browse/${i.key}`,
    }))
    await upsertDdsJiraIssues(newDdsIssues)
    await cascadeJiraIssueAttributes(newDdsIssues)
  }

  // Build issue lookup for keys
  const issueMap = new Map(issues.map((i) => [i.id, i]))

  // Upsert DDS
  const ddsWorklogs: DdsJiraWorklog[] = worklogs.map((w) => {
    const issue = issueMap.get(w.issueId)
    return {
      worklog_id: w.id,
      issue_id: w.issueId,
      issue_key: issue?.key ?? '',
      started: w.started,
      time_spent: w.timeSpent,
      comment: w.comment,
      link: issue ? `https://jira.atlassian.com/browse/${issue.key}` : null,
    }
  })
  await upsertDdsJiraWorklogs(ddsWorklogs)
}

// ── Sync: Google Calendar Events ─────────────────────────────────────

export async function syncCalendarEvents(dateStart: string, dateEnd: string) {
  const { status, setExpired } = useCalendarStore.getState()
  if (status !== 'connected' && status !== 'done' && status !== 'loading') {
    setExpired()
    throw new Error('Google Calendar not connected')
  }

  const rawEvents = await fetchCalendarEvents(dateStart, dateEnd)

  // Upsert raw source
  await upsertSrcCalendarEvents(
    rawEvents.map((e) => ({
      id: e.id,
      iCalUID: e.iCalUID ?? null,
      startDateTime: e.start?.dateTime ?? e.start?.date ?? null,
      endDateTime: e.end?.dateTime ?? e.end?.date ?? null,
      summary: e.summary ?? null,
      description: e.description ?? null,
      visibility: e.visibility ?? null,
      htmlLink: e.htmlLink ?? null,
    })),
  )

  // Upsert DDS calendar events
  const ddsEvents: DdsCalendarEvent[] = rawEvents.map((e) => ({
    id: e.id,
    event_cross_cal_id: e.iCalUID ?? null,
    start_time: e.start?.dateTime ?? e.start?.date ?? null,
    end_time: e.end?.dateTime ?? e.end?.date ?? null,
    summary: e.summary ?? null,
    description: e.description ?? null,
    link: e.htmlLink ?? null,
  }))
  await upsertDdsCalendarEvents(ddsEvents)

  // Upsert DDS tasks from calendar events
  const revision = await nextTaskRevision()
  const ddsTasks = rawEvents
    .filter((e) => e.start?.dateTime && e.end?.dateTime)
    .map((e) => ({
      task_id: e.id,
      description: e.summary ?? null,
      duration: `${diffMinutes(e.start!.dateTime!, e.end!.dateTime!)}m`,
      start_time: e.start!.dateTime!,
      issue_key: null,
      issue_name: null,
      project_key: null,
      revision,
      source: 'gcal',
      source_id: e.id,
    }))
  await upsertTasksWithMappings(ddsTasks)
}

// ── Sync: Tempo Capacity ─────────────────────────────────────────────

export async function syncTempoCapacity(dateStart: string, dateEnd: string) {
  const { status } = useTempoStore.getState()
  if (status !== 'connected') {
    throw new Error('Tempo not connected')
  }

  // Fetch user schedule (workload + holidays) via user-level endpoint
  let workloadSchemes: import('@/lib/tempo').TempoWorkloadScheme[] = []
  let holidaySchemes: import('@/lib/tempo').TempoHolidayScheme[] = []
  try {
    const schedule = await fetchUserSchedule(dateStart, dateEnd)
    workloadSchemes = schedule.workload
    holidaySchemes = schedule.holidays
  } catch (e) {
    console.warn('[Tempo] User schedule unavailable, using 8h Mon-Fri default:', e)
    workloadSchemes = [
      {
        id: 0,
        name: 'Default (8h Mon-Fri)',
        days: [1, 2, 3, 4, 5].map((day) => ({ day, requiredSeconds: 28800 })),
      },
    ]
  }
  const srcWorkloadDays: SrcTempoWorkloadDay[] = workloadSchemes.flatMap((s) =>
    s.days.map((d) => ({
      scheme_id: String(s.id),
      scheme_name: s.name,
      day: d.day,
      required_seconds: d.requiredSeconds,
    })),
  )
  await upsertSrcTempoWorkloadDays(srcWorkloadDays)

  const srcHolidays: SrcTempoHoliday[] = holidaySchemes.flatMap((s) =>
    s.holidays.map((h) => ({
      scheme_id: String(s.id),
      holiday_id: String(h.id),
      name: h.name,
      date: h.date,
      duration_seconds: h.durationSeconds,
      type: h.type,
    })),
  )
  await upsertSrcTempoHolidays(srcHolidays)

  // Build DDS: daily capacity for each date in period
  // Use first workload scheme as the default
  const dayMap = new Map<number, number>()
  if (workloadSchemes.length > 0) {
    for (const d of workloadSchemes[0].days) {
      dayMap.set(d.day, d.requiredSeconds)
    }
  }

  // Build holiday lookup by date
  const holidayMap = new Map<string, { name: string; durationSeconds: number }>()
  for (const h of srcHolidays) {
    holidayMap.set(h.date, { name: h.name, durationSeconds: h.duration_seconds })
  }

  const dailyCapacity: DdsTempoDailyCapacity[] = []
  const current = new Date(dateStart)
  const endDate = new Date(dateEnd)

  while (current < endDate) {
    const dateStr = current.toISOString().slice(0, 10)
    const dow = current.getDay()
    const baseSeconds = dayMap.get(dow) ?? 0
    const holiday = holidayMap.get(dateStr)

    dailyCapacity.push({
      date: dateStr,
      day_of_week: dow,
      required_seconds: holiday ? Math.max(0, baseSeconds - holiday.durationSeconds) : baseSeconds,
      is_holiday: !!holiday,
      holiday_name: holiday?.name ?? null,
    })

    current.setDate(current.getDate() + 1)
  }

  await upsertDdsTempoDailyCapacity(dailyCapacity)
}

// ── Sync All ──────────────────────────────────────────────────────────

export interface SyncAllResult {
  jiraIssues: boolean
  jiraWorklogs: boolean
  calendarEvents: boolean
  tempoCapacity: boolean
  errors: string[]
}

export async function syncAll(dateStart: string, dateEnd: string): Promise<SyncAllResult> {
  const result: SyncAllResult = {
    jiraIssues: false,
    jiraWorklogs: false,
    calendarEvents: false,
    tempoCapacity: false,
    errors: [],
  }

  // Jira issues first (worklogs depend on them)
  try {
    await syncJiraIssues()
    result.jiraIssues = true
  } catch (e) {
    result.errors.push(`Jira Issues: ${(e as Error).message}`)
  }

  // Run worklogs, calendar, and tempo in parallel
  const [wl, cal, tempo] = await Promise.allSettled([
    syncJiraWorklogs(dateStart, dateEnd),
    syncCalendarEvents(dateStart, dateEnd),
    syncTempoCapacity(dateStart, dateEnd),
  ])

  if (wl.status === 'fulfilled') result.jiraWorklogs = true
  else result.errors.push(`Jira Worklogs: ${wl.reason?.message ?? wl.reason}`)

  if (cal.status === 'fulfilled') result.calendarEvents = true
  else result.errors.push(`Calendar: ${cal.reason?.message ?? cal.reason}`)

  if (tempo.status === 'fulfilled') result.tempoCapacity = true
  else result.errors.push(`Tempo: ${tempo.reason?.message ?? tempo.reason}`)

  return result
}

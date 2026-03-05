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
  DdsTask,
} from '@/lib/duckdb/queries'

// ── Helpers ────────────────────────────────────────────────────────────

function workingDays(year: number, month: number): string[] {
  const days: string[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    const dow = d.getDay()
    if (dow >= 1 && dow <= 5) {
      days.push(d.toISOString().slice(0, 10))
    }
    d.setDate(d.getDate() + 1)
  }
  return days
}

function allDays(year: number, month: number): string[] {
  const days: string[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return days
}

/** Seeded pseudo-random for deterministic data */
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

const rand = seededRandom(42)

const LOADED_AT = '2026-02-15T10:00:00.000Z'
const JIRA_BASE = 'https://example.atlassian.net'

// ── Jira Issues (~30 across 3 projects) ────────────────────────────────

const PROJECTS = [
  { key: 'ALPHA', count: 12 },
  { key: 'BETA', count: 10 },
  { key: 'GAMMA', count: 8 },
] as const

const ISSUE_SUMMARIES: Record<string, string[]> = {
  ALPHA: [
    'Set up CI/CD pipeline',
    'Design database schema',
    'Implement user authentication',
    'Add password reset flow',
    'Create landing page',
    'API rate limiting',
    'Write unit tests for auth module',
    'Fix login redirect bug',
    'Add logging middleware',
    'Performance profiling',
    'Set up staging environment',
    'Documentation for onboarding',
  ],
  BETA: [
    'Dashboard analytics widget',
    'Export CSV reports',
    'Notification preferences',
    'Mobile responsive layout',
    'Dark mode support',
    'Search autocomplete',
    'Pagination component',
    'User avatar upload',
    'Accessibility audit',
    'Upgrade React to v19',
  ],
  GAMMA: [
    'Payment gateway integration',
    'Invoice PDF generation',
    'Subscription management',
    'Refund workflow',
    'Tax calculation engine',
    'Stripe webhook handler',
    'Billing email templates',
    'Currency conversion',
  ],
}

interface IssueEntry {
  id: string
  key: string
  summary: string
  project_key: string
}

const issues: IssueEntry[] = []
let issueIdCounter = 10001

for (const proj of PROJECTS) {
  for (let i = 0; i < proj.count; i++) {
    issues.push({
      id: String(issueIdCounter++),
      key: `${proj.key}-${i + 1}`,
      summary: ISSUE_SUMMARIES[proj.key][i],
      project_key: proj.key,
    })
  }
}

export const mockSrcJiraIssues: (SrcJiraIssue & { loaded_at: string })[] = issues.map((iss) => ({
  id: iss.id,
  key: iss.key,
  summary: iss.summary,
  project_key: iss.project_key,
  self: `${JIRA_BASE}/rest/api/3/issue/${iss.id}`,
  loaded_at: LOADED_AT,
}))

export const mockDdsJiraIssues: DdsJiraIssue[] = issues.map((iss) => ({
  issue_id: iss.id,
  issue_key: iss.key,
  issue_name: iss.summary,
  project_key: iss.project_key,
  link: `${JIRA_BASE}/browse/${iss.key}`,
}))

// ── Jira Worklogs (Jan–Feb) ───────────────────────────────────────────

const worklogWorkingDays = [...workingDays(2026, 0), ...workingDays(2026, 1)]
let worklogIdCounter = 50001

export const mockSrcJiraWorklogs: (SrcJiraWorklog & { loaded_at: string })[] = []
export const mockDdsJiraWorklogs: DdsJiraWorklog[] = []

for (const day of worklogWorkingDays) {
  // 2-4 worklogs per day, spread across random issues
  const count = 2 + Math.floor(rand() * 3)
  for (let i = 0; i < count; i++) {
    const issue = issues[Math.floor(rand() * issues.length)]
    const hours = 1 + Math.floor(rand() * 3)
    const hour = 9 + i * 2
    const started = `${day}T${String(hour).padStart(2, '0')}:00:00.000+0000`
    const id = String(worklogIdCounter++)
    const comment = `Worked on ${issue.summary.toLowerCase()}`

    mockSrcJiraWorklogs.push({
      id,
      issueId: issue.id,
      started,
      timeSpent: `${hours}h`,
      comment,
      self: `${JIRA_BASE}/rest/api/3/issue/${issue.id}/worklog/${id}`,
      loaded_at: LOADED_AT,
    })

    mockDdsJiraWorklogs.push({
      worklog_id: id,
      issue_id: issue.id,
      issue_key: issue.key,
      started,
      time_spent: `${hours}h`,
      comment,
      link: `${JIRA_BASE}/browse/${issue.key}?focusedId=${id}`,
    })
  }
}

// ── Calendar Events (Jan–Feb, 2-5 per working day, some 0) ────────────

const MEETING_TITLES = [
  'Team standup',
  'Sprint planning',
  'Code review session',
  'Design sync',
  'Architecture discussion',
  '1:1 with manager',
  'Product demo',
  'Retrospective',
  'Backlog grooming',
  'Customer call',
  'Tech debt discussion',
  'Onboarding session',
  'Lunch and learn',
  'Pair programming',
  'Release planning',
]

let calEventIdCounter = 80001

export const mockSrcCalendarEvents: (SrcCalendarEvent & { loaded_at: string })[] = []
export const mockDdsCalendarEvents: DdsCalendarEvent[] = []

const calWorkingDays = [...workingDays(2026, 0), ...workingDays(2026, 1)]

for (const day of calWorkingDays) {
  // ~15% chance of zero events
  if (rand() < 0.15) continue

  const count = 2 + Math.floor(rand() * 4) // 2-5
  const usedHours = new Set<number>()

  for (let i = 0; i < count; i++) {
    let startHour: number
    do {
      startHour = 9 + Math.floor(rand() * 8) // 9-16
    } while (usedHours.has(startHour))
    usedHours.add(startHour)

    // 2h to 7h in 30-min steps: [120, 150, 180, ..., 420]
    const durationSteps = Array.from({ length: 11 }, (_, i) => 120 + i * 30)
    const durationMin = durationSteps[Math.floor(rand() * durationSteps.length)]
    const endHour = startHour + Math.floor(durationMin / 60)
    const endMin = durationMin % 60

    const id = `cal_${calEventIdCounter++}`
    const title = MEETING_TITLES[Math.floor(rand() * MEETING_TITLES.length)]
    const startDT = `${day}T${String(startHour).padStart(2, '0')}:00:00-05:00`
    const endDT = `${day}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00-05:00`

    mockSrcCalendarEvents.push({
      id,
      iCalUID: `${id}@google.com`,
      startDateTime: startDT,
      endDateTime: endDT,
      summary: title,
      description: null,
      visibility: 'default',
      htmlLink: `https://calendar.google.com/calendar/event?eid=${id}`,
      loaded_at: LOADED_AT,
    })

    mockDdsCalendarEvents.push({
      id,
      event_cross_cal_id: `${id}@google.com`,
      start_time: startDT,
      end_time: endDT,
      summary: title,
      description: null,
      link: `https://calendar.google.com/calendar/event?eid=${id}`,
    })
  }
}

// ── Tempo Workload Days (Mon-Fri 8h, Sat-Sun 0h) ─────────────────────

const SCHEME_ID = 'scheme_1'

export const mockSrcTempoWorkloadDays: (SrcTempoWorkloadDay & { loaded_at: string })[] = [
  0, 1, 2, 3, 4, 5, 6,
].map((day) => ({
  scheme_id: SCHEME_ID,
  scheme_name: 'Default Workload Scheme',
  day,
  required_seconds: day >= 1 && day <= 5 ? 28800 : 0, // 8h = 28800s
  loaded_at: LOADED_AT,
}))

// ── Tempo Holidays ────────────────────────────────────────────────────

export const mockSrcTempoHolidays: (SrcTempoHoliday & { loaded_at: string })[] = [
  {
    scheme_id: SCHEME_ID,
    holiday_id: 'hol_1',
    name: "New Year's Day",
    date: '2026-01-01',
    duration_seconds: 28800,
    type: 'FIXED',
    loaded_at: LOADED_AT,
  },
  {
    scheme_id: SCHEME_ID,
    holiday_id: 'hol_2',
    name: 'Martin Luther King Jr. Day',
    date: '2026-01-19',
    duration_seconds: 28800,
    type: 'FIXED',
    loaded_at: LOADED_AT,
  },
]

// ── DDS Tempo Daily Capacity (Jan–Feb) ────────────────────────────────

const holidayMap = new Map(mockSrcTempoHolidays.map((h) => [h.date, h.name]))

export const mockDdsTempoDailyCapacity: DdsTempoDailyCapacity[] = []

for (const day of [...allDays(2026, 0), ...allDays(2026, 1)]) {
  const d = new Date(day + 'T00:00:00')
  const dow = d.getDay()
  const isHoliday = holidayMap.has(day)
  const isWeekday = dow >= 1 && dow <= 5

  mockDdsTempoDailyCapacity.push({
    date: day,
    day_of_week: dow,
    required_seconds: isWeekday && !isHoliday ? 28800 : 0,
    is_holiday: isHoliday,
    holiday_name: holidayMap.get(day) ?? null,
  })
}

// ── DDS Tasks (15 per month: 5 with issue data, 10 without) ──────────

const TASK_DESCRIPTIONS = [
  'Team standup',
  'Sprint planning',
  'Code review session',
  'Design sync',
  'Architecture discussion',
  '1:1 with manager',
  'Product demo',
  'Retrospective',
  'Backlog grooming',
  'Customer call',
  'Tech debt discussion',
  'Onboarding session',
  'Lunch and learn',
  'Pair programming',
  'Release planning',
]

const TASK_DURATIONS = [60, 90, 120, 60, 90, 30, 60, 120, 60, 90, 60, 30, 60, 120, 90]

// 5 with issue data per month, 10 without
const MONTH_ISSUES: (IssueEntry | null)[] = [
  issues[0], // ALPHA-1
  issues[6], // ALPHA-7
  issues[1], // ALPHA-2
  issues[12], // BETA-1
  issues[22], // GAMMA-1
  null, null, null, null, null,
  null, null, null, null, null,
]

function generateMonthTasks(year: number, month: number, idOffset: number): DdsTask[] {
  const days = workingDays(year, month)
  return TASK_DESCRIPTIONS.map((desc, i) => {
    const day = days[Math.floor((i * days.length) / 15)]
    const hour = 9 + (i % 8)
    const durationMin = TASK_DURATIONS[i]
    const durationStr = durationMin >= 60 ? `${Math.round(durationMin / 60)}h` : `${durationMin}m`
    const startDT = `${day}T${String(hour).padStart(2, '0')}:00:00-05:00`
    const issue = MONTH_ISSUES[i]

    return {
      task_id: `task_${idOffset + i}`,
      description: desc,
      duration: durationStr,
      start_time: startDT,
      issue_key: issue?.key ?? null,
      issue_name: issue?.summary ?? null,
      project_key: issue?.project_key ?? null,
      revision: 1,
      source: 'gcal',
      source_id: `cal_${80001 + idOffset - 90001 + i}`,
    }
  })
}

export const mockDdsTasks: DdsTask[] = [
  ...generateMonthTasks(2026, 0, 90001),
  ...generateMonthTasks(2026, 1, 90016),
]

import { useTempoStore } from '@/store/tempo'

function headers() {
  return {
    Accept: 'application/json',
  }
}

// ── Types ─────────────────────────────────────────────────────────────

export interface TempoWorkloadScheme {
  id: number
  name: string
  days: { day: number; requiredSeconds: number }[]
}

export interface TempoHolidayScheme {
  id: number
  name: string
  holidays: {
    id: number
    name: string
    date: string
    durationSeconds: number
    type: string
  }[]
}

interface DaySchedule {
  date: string
  requiredSeconds: number
  type: 'WORKING_DAY' | 'NON_WORKING_DAY' | 'HOLIDAY' | 'HOLIDAY_AND_NON_WORKING_DAY'
  holiday?: {
    id: number
    name: string
    date: string
    durationSeconds: number
    schemeId: number
    type: string
  }
}

interface DayScheduleResults {
  results: DaySchedule[]
  metadata: { count: number; offset: number; limit: number }
}

// ── API ───────────────────────────────────────────────────────────────

function handleAuth(res: Response) {
  if (res.status === 401) {
    useTempoStore.getState().setExpired()
    throw new Error('Tempo API token expired or revoked')
  }
  if (res.status === 403) {
    throw new Error('Tempo: insufficient permissions (403)')
  }
}

export async function fetchUserSchedule(
  dateStart: string,
  dateEnd: string,
): Promise<{ workload: TempoWorkloadScheme[]; holidays: TempoHolidayScheme[] }> {
  const params = new URLSearchParams({
    from: dateStart.slice(0, 10),
    to: dateEnd.slice(0, 10),
  })
  const res = await fetch(`/tempo-api/4/user-schedule?${params}`, {
    headers: headers(),
  })
  handleAuth(res)
  if (!res.ok) throw new Error(`Tempo user schedule: ${res.status}`)
  const data: DayScheduleResults = await res.json()

  // Build workload: aggregate requiredSeconds per day-of-week from working days
  const dayTotals = new Map<number, { sum: number; count: number }>()
  for (const d of data.results) {
    const dow = new Date(d.date).getDay()
    const entry = dayTotals.get(dow) ?? { sum: 0, count: 0 }
    entry.sum += d.requiredSeconds
    entry.count += 1
    dayTotals.set(dow, entry)
  }
  const workloadDays: { day: number; requiredSeconds: number }[] = []
  for (const [day, { sum, count }] of dayTotals) {
    workloadDays.push({ day, requiredSeconds: Math.round(sum / count) })
  }
  const workload: TempoWorkloadScheme[] = [{ id: 0, name: 'User Schedule', days: workloadDays }]

  // Collect holidays
  const holidayMap = new Map<number, TempoHolidayScheme['holidays'][number]>()
  let schemeId = 0
  for (const d of data.results) {
    if (d.holiday) {
      schemeId = d.holiday.schemeId
      holidayMap.set(d.holiday.id, {
        id: d.holiday.id,
        name: d.holiday.name,
        date: d.holiday.date,
        durationSeconds: d.holiday.durationSeconds,
        type: d.holiday.type,
      })
    }
  }
  const holidays: TempoHolidayScheme[] =
    holidayMap.size > 0
      ? [{ id: schemeId, name: 'User Holiday Scheme', holidays: [...holidayMap.values()] }]
      : []

  return { workload, holidays }
}

// ── Worklogs ─────────────────────────────────────────────────────────

interface TempoWorklogResult {
  tempoWorklogId: number
  jiraWorklogId?: number
  issue: { id: number }
  timeSpentSeconds: number
  startDate: string
  startTime?: string
  description?: string
}

interface TempoWorklogResponse {
  results: TempoWorklogResult[]
  metadata: { count: number; offset: number; limit: number }
}

export interface TempoWorklogs {
  worklogs: import('@/lib/jira').JiraWorklog[]
  issueIds: string[]
}

export async function fetchTempoWorklogs(
  accountId: string,
  dateStart: string,
  dateEnd: string,
): Promise<TempoWorklogs> {
  const limit = 1000
  let offset = 0
  const all: TempoWorklogResult[] = []

  while (true) {
    const params = new URLSearchParams({
      from: dateStart.slice(0, 10),
      to: dateEnd.slice(0, 10),
      limit: String(limit),
      offset: String(offset),
    })
    const res = await fetch(`/tempo-api/4/worklogs/user/${accountId}?${params}`, {
      headers: headers(),
    })
    handleAuth(res)
    if (!res.ok) throw new Error(`Tempo worklogs: ${res.status}`)

    const data: TempoWorklogResponse = await res.json()
    all.push(...data.results)
    if (data.results.length < limit) break
    offset += limit
  }

  const issueIdSet = new Set<string>()
  const worklogs = all.map((w) => {
    const issueId = String(w.issue.id)
    issueIdSet.add(issueId)
    return {
      id: String(w.jiraWorklogId ?? w.tempoWorklogId),
      issueId,
      started: `${w.startDate}T${w.startTime || '00:00:00'}.000+0000`,
      timeSpent: String(w.timeSpentSeconds),
      comment: w.description != null ? JSON.stringify(w.description) : null,
      self: '',
    }
  })

  return { worklogs, issueIds: [...issueIdSet] }
}

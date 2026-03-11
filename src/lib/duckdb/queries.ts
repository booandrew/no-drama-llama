import { getConnection } from './init'
import { isMutation } from './mutation'

// ── Helpers ────────────────────────────────────────────────────────────

async function exec(sql: string) {
  const conn = getConnection()
  const result = await conn.query(sql)
  if (isMutation(sql)) await conn.query('FORCE CHECKPOINT;')
  return result
}

function escSql(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return `'${s.replace(/'/g, "''")}'`
}

// ── Row Types ──────────────────────────────────────────────────────────

// Source layer
export interface SrcJiraIssue {
  id: string
  key: string
  summary: string
  project_key: string
  self: string
}

export interface SrcJiraWorklog {
  id: string
  issueId: string
  started: string
  timeSpent: string
  comment: string | null
  self: string
}

export interface SrcCalendarEvent {
  id: string
  iCalUID: string | null
  startDateTime: string | null
  endDateTime: string | null
  summary: string | null
  description: string | null
  visibility: string | null
  htmlLink: string | null
}

// DDS layer
export interface DdsJiraIssue {
  issue_id: string
  issue_key: string
  issue_name: string
  project_key: string
  link: string | null
}

export interface DdsJiraWorklog {
  worklog_id: string
  issue_id: string
  issue_key: string
  started: string
  time_spent: string
  comment: string | null
  link: string | null
}

export interface DdsCalendarEvent {
  id: string
  event_cross_cal_id: string | null
  start_time: string | null
  end_time: string | null
  summary: string | null
  description: string | null
  link: string | null
}

// Tempo source layer
export interface SrcTempoWorkloadDay {
  scheme_id: string
  scheme_name: string | null
  day: number
  required_seconds: number
}

export interface SrcTempoHoliday {
  scheme_id: string
  holiday_id: string
  name: string
  date: string
  duration_seconds: number
  type: string
}

// Tempo DDS layer
export interface DdsTempoDailyCapacity {
  date: string
  day_of_week: number
  required_seconds: number
  is_holiday: boolean
  holiday_name: string | null
}

export interface DdsCustomInput {
  id: string
  input: string
  duration: number | null
  time_unit: string | null
  start_time: string
}

export interface DdsTask {
  task_id: string
  description: string | null
  duration: string
  start_time: string
  issue_key: string | null
  issue_name: string | null
  project_key: string | null
  revision: number
  source: string
  source_id: string | null
}

// ── Generic upsert ────────────────────────────────────────────────────

async function upsertRows(table: string, rows: Record<string, unknown>[], conflictColumn: string) {
  if (rows.length === 0) return

  const cols = Object.keys(rows[0])
  const colList = cols.join(', ')
  const updateSet = cols
    .filter((c) => c !== conflictColumn)
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(', ')

  // Batch in chunks of 100
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const values = chunk.map((r) => `(${cols.map((c) => escSql(r[c])).join(', ')})`).join(',\n')

    await exec(`
      INSERT INTO ${table} (${colList})
      VALUES ${values}
      ON CONFLICT (${conflictColumn}) DO UPDATE SET ${updateSet}
    `)
  }
}

// ── Generic read ──────────────────────────────────────────────────────

async function readRows<T>(
  table: string,
  opts?: { where?: string; orderBy?: string },
): Promise<T[]> {
  let sql = `SELECT * FROM ${table}`
  if (opts?.where) sql += ` WHERE ${opts.where}`
  if (opts?.orderBy) sql += ` ORDER BY ${opts.orderBy}`

  const result = await exec(sql)
  return result.toArray().map((row) => row.toJSON() as T)
}

// ── Source Layer: Upsert ──────────────────────────────────────────────

export async function upsertSrcJiraIssues(rows: SrcJiraIssue[]) {
  await upsertRows(
    'src_jira_issues',
    rows.map((r) => ({ ...r, loaded_at: new Date().toISOString() })),
    'id',
  )
}

export async function upsertSrcJiraWorklogs(rows: SrcJiraWorklog[]) {
  await upsertRows(
    'src_jira_worklogs',
    rows.map((r) => ({ ...r, loaded_at: new Date().toISOString() })),
    'id',
  )
}

export async function upsertSrcCalendarEvents(rows: SrcCalendarEvent[]) {
  // src_calendar_events has no PK — delete+insert for the given IDs
  if (rows.length === 0) return
  const ids = rows.map((r) => escSql(r.id)).join(', ')
  await exec(`DELETE FROM src_calendar_events WHERE id IN (${ids})`)

  const cols = [
    'id',
    'iCalUID',
    'startDateTime',
    'endDateTime',
    'summary',
    'description',
    'visibility',
    'htmlLink',
    'loaded_at',
  ]
  const values = rows
    .map((r) => {
      const vals = [
        r.id,
        r.iCalUID,
        r.startDateTime,
        r.endDateTime,
        r.summary,
        r.description,
        r.visibility,
        r.htmlLink,
        new Date().toISOString(),
      ]
      return `(${vals.map(escSql).join(', ')})`
    })
    .join(',\n')

  await exec(`INSERT INTO src_calendar_events (${cols.join(', ')}) VALUES ${values}`)
}

// ── DDS Layer: Upsert ─────────────────────────────────────────────────

export async function upsertDdsJiraIssues(rows: DdsJiraIssue[]) {
  await upsertRows('dds_jira_issues', rows as unknown as Record<string, unknown>[], 'issue_id')
}

export async function upsertDdsJiraWorklogs(rows: DdsJiraWorklog[]) {
  await upsertRows('dds_jira_worklogs', rows as unknown as Record<string, unknown>[], 'worklog_id')
}

export async function upsertDdsCalendarEvents(rows: DdsCalendarEvent[]) {
  // dds_calendar_events has no PK — delete+insert
  if (rows.length === 0) return
  const ids = rows.map((r) => escSql(r.id)).join(', ')
  await exec(`DELETE FROM dds_calendar_events WHERE id IN (${ids})`)

  const cols = [
    'id',
    'event_cross_cal_id',
    'start_time',
    'end_time',
    'summary',
    'description',
    'link',
  ]
  const values = rows
    .map(
      (r) =>
        `(${[r.id, r.event_cross_cal_id, r.start_time, r.end_time, r.summary, r.description, r.link].map(escSql).join(', ')})`,
    )
    .join(',\n')

  await exec(`INSERT INTO dds_calendar_events (${cols.join(', ')}) VALUES ${values}`)
}

export async function upsertDdsTasks(rows: DdsTask[]) {
  if (rows.length === 0) return

  // dds_tasks has unique index on (task_id, revision) — delete+insert
  for (const r of rows) {
    await exec(
      `DELETE FROM dds_tasks WHERE task_id = ${escSql(r.task_id)} AND revision = ${escSql(r.revision)}`,
    )
  }

  const cols = [
    'task_id',
    'description',
    'duration',
    'start_time',
    'issue_key',
    'issue_name',
    'project_key',
    'revision',
    'source',
    'source_id',
  ]
  const values = rows
    .map(
      (r) =>
        `(${[r.task_id, r.description, r.duration, r.start_time, r.issue_key, r.issue_name, r.project_key, r.revision, r.source, r.source_id].map(escSql).join(', ')})`,
    )
    .join(',\n')

  await exec(`INSERT INTO dds_tasks (${cols.join(', ')}) VALUES ${values}`)
}

// ── Tempo Layer: Upsert ───────────────────────────────────────────────

export async function upsertSrcTempoWorkloadDays(rows: SrcTempoWorkloadDay[]) {
  if (rows.length === 0) return
  // Composite PK (scheme_id, day) — delete+insert per scheme
  const schemeIds = [...new Set(rows.map((r) => r.scheme_id))]
  for (const sid of schemeIds) {
    await exec(`DELETE FROM src_tempo_workload_days WHERE scheme_id = ${escSql(sid)}`)
  }
  const cols = ['scheme_id', 'scheme_name', 'day', 'required_seconds', 'loaded_at']
  const values = rows
    .map(
      (r) =>
        `(${[r.scheme_id, r.scheme_name, r.day, r.required_seconds, new Date().toISOString()].map(escSql).join(', ')})`,
    )
    .join(',\n')
  await exec(`INSERT INTO src_tempo_workload_days (${cols.join(', ')}) VALUES ${values}`)
}

export async function upsertSrcTempoHolidays(rows: SrcTempoHoliday[]) {
  if (rows.length === 0) return
  // Composite PK (scheme_id, holiday_id) — delete+insert per scheme
  const schemeIds = [...new Set(rows.map((r) => r.scheme_id))]
  for (const sid of schemeIds) {
    await exec(`DELETE FROM src_tempo_holidays WHERE scheme_id = ${escSql(sid)}`)
  }
  const cols = ['scheme_id', 'holiday_id', 'name', 'date', 'duration_seconds', 'type', 'loaded_at']
  const values = rows
    .map(
      (r) =>
        `(${[r.scheme_id, r.holiday_id, r.name, r.date, r.duration_seconds, r.type, new Date().toISOString()].map(escSql).join(', ')})`,
    )
    .join(',\n')
  await exec(`INSERT INTO src_tempo_holidays (${cols.join(', ')}) VALUES ${values}`)
}

export async function upsertDdsTempoDailyCapacity(rows: DdsTempoDailyCapacity[]) {
  if (rows.length === 0) return
  await upsertRows('dds_tempo_daily_capacity', rows as unknown as Record<string, unknown>[], 'date')
}

// ── Tempo Layer: Read ─────────────────────────────────────────────────

export function readSrcTempoWorkloadDays() {
  return readRows<SrcTempoWorkloadDay & { loaded_at: string }>('src_tempo_workload_days', {
    orderBy: 'scheme_id, day',
  })
}

export function readSrcTempoHolidays(dateStart: string, dateEnd: string) {
  return readRows<SrcTempoHoliday & { loaded_at: string }>('src_tempo_holidays', {
    where: `date >= ${escSql(dateStart)} AND date < ${escSql(dateEnd)}`,
    orderBy: 'date',
  })
}

export function readDdsTempoDailyCapacity(dateStart: string, dateEnd: string) {
  return readRows<DdsTempoDailyCapacity>('dds_tempo_daily_capacity', {
    where: `date >= ${escSql(dateStart)} AND date < ${escSql(dateEnd)}`,
    orderBy: 'date',
  })
}

// ── Cascade: Jira Issue attributes to downstream tables ───────────────

export async function cascadeJiraIssueAttributes(issues: DdsJiraIssue[]) {
  for (const issue of issues) {
    const name = escSql(issue.issue_name)
    const pkey = escSql(issue.project_key)
    const ikey = escSql(issue.issue_key)

    await exec(
      `UPDATE dds_jira_worklogs SET issue_key = ${ikey} WHERE issue_id = ${escSql(issue.issue_id)}`,
    )
    await exec(
      `UPDATE dds_tasks SET issue_name = ${name}, project_key = ${pkey} WHERE issue_key = ${ikey}`,
    )
    await exec(`UPDATE rpt_jira_timesheet SET issue_name = ${name} WHERE issue_key = ${ikey}`)
  }
}

// ── Read Operations ───────────────────────────────────────────────────

export function readSrcJiraIssues() {
  return readRows<SrcJiraIssue & { loaded_at: string }>('src_jira_issues', {
    orderBy: 'key',
  })
}

export function readSrcJiraWorklogs(dateStart: string, dateEnd: string) {
  return readRows<SrcJiraWorklog & { loaded_at: string }>('src_jira_worklogs', {
    where: `started >= ${escSql(dateStart)} AND started < ${escSql(dateEnd)}`,
    orderBy: 'started',
  })
}

export function readSrcCalendarEvents(dateStart: string, dateEnd: string) {
  return readRows<SrcCalendarEvent & { loaded_at: string }>('src_calendar_events', {
    where: `startDateTime >= ${escSql(dateStart)} AND startDateTime < ${escSql(dateEnd)}`,
    orderBy: 'startDateTime',
  })
}

export function readDdsJiraIssues() {
  return readRows<DdsJiraIssue>('dds_jira_issues', {
    orderBy: 'issue_key',
  })
}

export function readDdsJiraWorklogs(dateStart: string, dateEnd: string) {
  return readRows<DdsJiraWorklog>('dds_jira_worklogs', {
    where: `started >= ${escSql(dateStart)} AND started < ${escSql(dateEnd)}`,
    orderBy: 'started',
  })
}

export function readDdsCalendarEvents(dateStart: string, dateEnd: string) {
  return readRows<DdsCalendarEvent>('dds_calendar_events', {
    where: `start_time >= ${escSql(dateStart)} AND start_time < ${escSql(dateEnd)}`,
    orderBy: 'start_time',
  })
}

export function readDdsTasks(dateStart: string, dateEnd: string) {
  return readRows<DdsTask>('dds_tasks', {
    where: `start_time >= ${escSql(dateStart)} AND start_time < ${escSql(dateEnd)}`,
    orderBy: 'start_time',
  })
}

// ── Custom Inputs CRUD ──────────────────────────────────────────────

export async function upsertDdsCustomInputs(rows: DdsCustomInput[]) {
  await upsertRows('dds_custom_inputs', rows as unknown as Record<string, unknown>[], 'id')
}

export function readDdsCustomInputs(dateStart: string, dateEnd: string) {
  return readRows<DdsCustomInput>('dds_custom_inputs', {
    where: `start_time >= ${escSql(dateStart)} AND start_time < ${escSql(dateEnd)}`,
    orderBy: 'start_time',
  })
}

export async function deleteDdsCustomInput(id: string) {
  await exec(`DELETE FROM dds_custom_inputs WHERE id = ${escSql(id)}`)
  await exec(`DELETE FROM dds_tasks WHERE source = 'custom_input' AND source_id = ${escSql(id)}`)
  await exec(`UPDATE rpt_jira_timesheet SET is_deleted = TRUE WHERE task_id = ${escSql(id)}`)
}

export async function nextTaskRevision(): Promise<number> {
  const result = await exec(`SELECT value FROM _meta WHERE key = 'task_revision'`)
  const current = parseInt(result.toArray()[0]?.toJSON().value ?? '0', 10)
  const next = current + 1
  await exec(`UPDATE _meta SET value = '${next}' WHERE key = 'task_revision'`)
  return next
}

// ── Keyword-Issue Mappings CRUD ──────────────────────────────────────

export interface MapKeywordIssue {
  id: string
  key_words: string[]
  issue_key: string
  issue_name: string | null
  project_key: string | null
}

export async function readMapKeywordIssues(): Promise<MapKeywordIssue[]> {
  const result = await exec('SELECT * FROM map_keyword_issue ORDER BY project_key, issue_key')
  return result.toArray().map((row) => {
    const r = row.toJSON()
    return {
      ...r,
      key_words: typeof r.key_words === 'string' ? JSON.parse(r.key_words) : r.key_words,
    } as MapKeywordIssue
  })
}

export async function upsertMapKeywordIssue(row: MapKeywordIssue) {
  const existing = await exec(`SELECT id FROM map_keyword_issue WHERE id = ${escSql(row.id)}`)
  if (existing.toArray().length > 0) {
    await exec(
      `UPDATE map_keyword_issue SET
        key_words = ${escSql(JSON.stringify(row.key_words))},
        issue_key = ${escSql(row.issue_key)},
        issue_name = ${escSql(row.issue_name)},
        project_key = ${escSql(row.project_key)}
      WHERE id = ${escSql(row.id)}`,
    )
  } else {
    await exec(
      `INSERT INTO map_keyword_issue (id, key_words, issue_key, issue_name, project_key)
       VALUES (${escSql(row.id)}, ${escSql(JSON.stringify(row.key_words))}, ${escSql(row.issue_key)}, ${escSql(row.issue_name)}, ${escSql(row.project_key)})`,
    )
  }
}

export async function deleteMapKeywordIssue(id: string) {
  await exec(`DELETE FROM map_keyword_issue WHERE id = ${escSql(id)}`)
}

// ── Task Upsert Orchestrator ─────────────────────────────────────────

function applyKeywordMappings(
  tasks: DdsTask[],
  mappings: MapKeywordIssue[],
  dbIssueKeys: Map<string, string | null>,
): void {
  for (const task of tasks) {
    // Skip if DB already has a non-null issue_key for this task
    if (dbIssueKeys.has(task.task_id) && dbIssueKeys.get(task.task_id) != null) continue
    // Skip if task already has issue_key set (e.g. from caller)
    if (task.issue_key) continue
    if (!task.description) continue

    const descLower = task.description.toLowerCase()
    for (const m of mappings) {
      if (m.key_words.some((kw) => descLower.includes(kw.toLowerCase()))) {
        task.issue_key = m.issue_key
        task.issue_name = m.issue_name
        task.project_key = m.project_key
        break
      }
    }
  }
}

async function syncTimesheetForTasks(tasks: DdsTask[]): Promise<void> {
  for (const task of tasks) {
    if (task.issue_key) {
      // Upsert into rpt_jira_timesheet by task_id
      const existing = await exec(
        `SELECT id FROM rpt_jira_timesheet WHERE task_id = ${escSql(task.task_id)}`,
      )
      if (existing.toArray().length > 0) {
        await exec(
          `UPDATE rpt_jira_timesheet SET
            issue_key = ${escSql(task.issue_key)},
            issue_name = ${escSql(task.issue_name ?? '')},
            time_spent = ${escSql(task.duration)},
            started = ${escSql(task.start_time)},
            comment = ${escSql(task.description)},
            is_deleted = FALSE
          WHERE task_id = ${escSql(task.task_id)}`,
        )
      } else {
        await exec(
          `INSERT INTO rpt_jira_timesheet (task_id, issue_key, issue_name, time_spent, started, comment, is_deleted)
           VALUES (${escSql(task.task_id)}, ${escSql(task.issue_key)}, ${escSql(task.issue_name ?? '')}, ${escSql(task.duration)}, ${escSql(task.start_time)}, ${escSql(task.description)}, FALSE)`,
        )
      }
    } else {
      // No issue_key — mark as deleted if row exists
      await exec(
        `UPDATE rpt_jira_timesheet SET is_deleted = TRUE WHERE task_id = ${escSql(task.task_id)}`,
      )
    }
  }
}

export async function upsertTasksWithMappings(tasks: DdsTask[]): Promise<void> {
  if (tasks.length === 0) return

  // Query existing issue_keys from DB for incoming task_ids
  const taskIds = tasks.map((t) => escSql(t.task_id)).join(', ')
  const result = await exec(
    `SELECT task_id, issue_key FROM dds_tasks WHERE task_id IN (${taskIds})
     ORDER BY revision DESC`,
  )
  const dbIssueKeys = new Map<string, string | null>()
  for (const row of result.toArray()) {
    const r = row.toJSON() as { task_id: string; issue_key: string | null }
    // Only keep the first (latest revision) per task_id
    if (!dbIssueKeys.has(r.task_id)) {
      dbIssueKeys.set(r.task_id, r.issue_key)
    }
  }

  // Load keyword mappings and apply
  const mappings = await readMapKeywordIssues()
  applyKeywordMappings(tasks, mappings, dbIssueKeys)

  // Write tasks
  await upsertDdsTasks(tasks)

  // Cascade to timesheet
  await syncTimesheetForTasks(tasks)
}

// ── Single-task update ───────────────────────────────────────────────

export interface TaskUpdate {
  issue_key?: string | null
  issue_name?: string | null
  project_key?: string | null
  duration?: string
}

export async function updateTask(taskId: string, fields: TaskUpdate): Promise<void> {
  const sets: string[] = []
  if ('issue_key' in fields) sets.push(`issue_key = ${escSql(fields.issue_key)}`)
  if ('issue_name' in fields) sets.push(`issue_name = ${escSql(fields.issue_name)}`)
  if ('project_key' in fields) sets.push(`project_key = ${escSql(fields.project_key)}`)
  if ('duration' in fields) sets.push(`duration = ${escSql(fields.duration)}`)
  if (sets.length === 0) return
  await exec(`UPDATE dds_tasks SET ${sets.join(', ')} WHERE task_id = ${escSql(taskId)}`)
  const result = await exec(
    `SELECT * FROM dds_tasks WHERE task_id = ${escSql(taskId)} ORDER BY revision DESC LIMIT 1`,
  )
  const rows = result.toArray().map((r) => r.toJSON() as DdsTask)
  if (rows.length > 0) await syncTimesheetForTasks(rows)
}

export async function customInputToTask(input: DdsCustomInput, revision: number): Promise<void> {
  const task: DdsTask = {
    task_id: input.id,
    description: input.input,
    duration:
      input.duration != null
        ? `${input.duration}${input.time_unit === 'minutes' ? 'm' : 'h'}`
        : '0h',
    start_time: input.start_time,
    issue_key: null,
    issue_name: null,
    project_key: null,
    revision,
    source: 'custom_input',
    source_id: input.id,
  }
  await upsertTasksWithMappings([task])
}

export async function clearAllData() {
  const conn = getConnection()
  const tables = await conn.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'`,
  )
  for (let i = 0; i < tables.numRows; i++) {
    const name = tables.getChildAt(0)!.get(i)
    await conn.query(`DELETE FROM "${name}"`)
  }
  await conn.query('FORCE CHECKPOINT;')
}

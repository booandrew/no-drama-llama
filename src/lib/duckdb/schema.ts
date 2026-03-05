import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'

const SCHEMA_VERSION = '1'

async function exec(conn: AsyncDuckDBConnection, sql: string): Promise<void> {
  await conn.query(sql)
}

/**
 * Create all application tables (idempotent).
 * Layers: _meta → Sources → DDS → Reports → Mappings
 */
export async function runSchema(conn: AsyncDuckDBConnection): Promise<void> {
  // ── _meta ──────────────────────────────────────────────────────────
  await exec(
    conn,
    `CREATE TABLE IF NOT EXISTS _meta (
      key VARCHAR PRIMARY KEY,
      value VARCHAR NOT NULL
    )`,
  )
  await exec(
    conn,
    `INSERT INTO _meta SELECT 'schema_version', '${SCHEMA_VERSION}'
     WHERE NOT EXISTS (SELECT 1 FROM _meta WHERE key = 'schema_version')`,
  )
  await exec(
    conn,
    `INSERT INTO _meta SELECT 'task_revision', '0'
     WHERE NOT EXISTS (SELECT 1 FROM _meta WHERE key = 'task_revision')`,
  )

  // ── Sources Layer ──────────────────────────────────────────────────
  await exec(
    conn,
    `CREATE TABLE IF NOT EXISTS src_jira_issues (
      id VARCHAR PRIMARY KEY,
      key VARCHAR NOT NULL,
      summary VARCHAR NOT NULL,
      project_key VARCHAR NOT NULL,
      self VARCHAR NOT NULL,
      loaded_at TIMESTAMP DEFAULT current_timestamp
    )`,
  )

  await exec(
    conn,
    `CREATE TABLE IF NOT EXISTS src_jira_worklogs (
      id VARCHAR PRIMARY KEY,
      issueId VARCHAR NOT NULL,
      started VARCHAR NOT NULL,
      timeSpent VARCHAR NOT NULL,
      comment JSON,
      self VARCHAR NOT NULL,
      loaded_at TIMESTAMP DEFAULT current_timestamp
    )`,
  )

  await exec(
    conn,
    `CREATE TABLE IF NOT EXISTS src_tempo_workload_days (
      scheme_id VARCHAR NOT NULL,
      scheme_name VARCHAR,
      day INTEGER NOT NULL,
      required_seconds INTEGER NOT NULL,
      loaded_at TIMESTAMP DEFAULT current_timestamp,
      PRIMARY KEY (scheme_id, day)
    )`,
  )

  await exec(
    conn,
    `CREATE TABLE IF NOT EXISTS src_tempo_holidays (
      scheme_id VARCHAR NOT NULL,
      holiday_id VARCHAR NOT NULL,
      name VARCHAR NOT NULL,
      date DATE NOT NULL,
      duration_seconds INTEGER NOT NULL,
      type VARCHAR NOT NULL,
      loaded_at TIMESTAMP DEFAULT current_timestamp,
      PRIMARY KEY (scheme_id, holiday_id)
    )`,
  )

  await exec(
    conn,
    `CREATE TABLE IF NOT EXISTS src_calendar_events (
      id VARCHAR NOT NULL,
      iCalUID VARCHAR,
      startDateTime VARCHAR,
      endDateTime VARCHAR,
      summary VARCHAR,
      description VARCHAR,
      visibility VARCHAR,
      htmlLink VARCHAR,
      loaded_at TIMESTAMP DEFAULT current_timestamp
    )`,
  )

  // ── DDS Layer ──────────────────────────────────────────────────────
  await exec(
    conn,
    `CREATE TABLE IF NOT EXISTS dds_jira_issues (
      issue_id VARCHAR PRIMARY KEY,
      issue_key VARCHAR NOT NULL,
      issue_name VARCHAR NOT NULL,
      project_key VARCHAR NOT NULL,
      link VARCHAR
    )`,
  )

  await exec(
    conn,
    `CREATE TABLE IF NOT EXISTS dds_jira_worklogs (
      worklog_id VARCHAR PRIMARY KEY,
      issue_id VARCHAR NOT NULL,
      issue_key VARCHAR NOT NULL,
      started VARCHAR NOT NULL,
      time_spent VARCHAR NOT NULL,
      comment VARCHAR,
      link VARCHAR
    )`,
  )

  await exec(
    conn,
    `CREATE TABLE IF NOT EXISTS dds_calendar_events (
      id VARCHAR NOT NULL,
      event_cross_cal_id VARCHAR,
      start_time VARCHAR,
      end_time VARCHAR,
      summary VARCHAR,
      description VARCHAR,
      link VARCHAR
    )`,
  )

  await exec(
    conn,
    `CREATE TABLE IF NOT EXISTS dds_tempo_daily_capacity (
      date DATE PRIMARY KEY,
      day_of_week INTEGER NOT NULL,
      required_seconds INTEGER NOT NULL,
      is_holiday BOOLEAN DEFAULT false,
      holiday_name VARCHAR
    )`,
  )

  await exec(
    conn,
    `CREATE TABLE IF NOT EXISTS dds_custom_inputs (
      id VARCHAR DEFAULT gen_random_uuid()::VARCHAR PRIMARY KEY,
      input VARCHAR NOT NULL,
      duration DOUBLE,
      time_unit VARCHAR,
      start_time TIMESTAMP NOT NULL
    )`,
  )

  await exec(
    conn,
    `CREATE TABLE IF NOT EXISTS dds_tasks (
      id VARCHAR DEFAULT gen_random_uuid()::VARCHAR,
      task_id VARCHAR NOT NULL,
      description VARCHAR,
      duration VARCHAR NOT NULL,
      start_time TIMESTAMP NOT NULL,
      issue_key VARCHAR,
      issue_name VARCHAR,
      project_key VARCHAR,
      revision INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT current_timestamp,
      source VARCHAR NOT NULL,
      source_id VARCHAR
    )`,
  )
  await exec(
    conn,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_dds_tasks ON dds_tasks(task_id, revision)`,
  )

  // ── Reports Layer ──────────────────────────────────────────────────
  await exec(
    conn,
    `CREATE TABLE IF NOT EXISTS rpt_jira_timesheet (
      id VARCHAR DEFAULT gen_random_uuid()::VARCHAR,
      task_id VARCHAR NOT NULL,
      issue_key VARCHAR NOT NULL,
      issue_name VARCHAR NOT NULL,
      time_spent VARCHAR NOT NULL,
      started VARCHAR NOT NULL,
      worklog_id VARCHAR,
      is_deleted BOOLEAN DEFAULT false,
      comment VARCHAR
    )`,
  )
  await exec(
    conn,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_rpt_timesheet ON rpt_jira_timesheet(task_id)`,
  )

  // ── Mappings Layer ─────────────────────────────────────────────────
  await exec(
    conn,
    `CREATE TABLE IF NOT EXISTS map_keyword_issue (
      id VARCHAR DEFAULT gen_random_uuid()::VARCHAR,
      key_words JSON NOT NULL,
      issue_key VARCHAR NOT NULL,
      issue_name VARCHAR,
      project_key VARCHAR
    )`,
  )
  await exec(
    conn,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_map_keyword ON map_keyword_issue(project_key, issue_key)`,
  )

  if (import.meta.env.DEV) {
    console.debug(`[DuckDB] Schema ready (v${SCHEMA_VERSION})`)
  }
}

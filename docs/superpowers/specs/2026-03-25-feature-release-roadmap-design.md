# No Drama Llama — Feature Release Roadmap

**Date:** 2026-03-25
**Status:** Draft
**Approach:** Core Loop First — build the end-to-end workflow incrementally

---

## Overview

This roadmap organizes 14 features into 4 release phases. Each phase is independently useful and builds on the previous one. The core principle: **log → map → submit** must work before anything else matters.

### Release Summary

| Release | Theme | Key Features |
|---------|-------|-------------|
| **v0.2** | Core Logging Loop | Hide events, Add Log everywhere, enhanced Mappings |
| **v0.3** | Close the Loop | Submit to Jira/Tempo, Difference View |
| **v0.4** | Polish & History | Timesheet History (tentative), Audit Log, Export Reports |
| **v0.5+** | Scale & Intelligence | AI Tasks, More Sources, Integrations, Security, Mobile |

---

## v0.2 — Core Logging Loop

**Goal:** User can see only relevant events, add time logs from anywhere, and map them to Jira issues.

### 1. Hide Non-Work Events

Per-event manual toggle. No auto-detection, no rules — user simply marks events as hidden.

**Behavior:**
- "Eye" toggle icon on `EventBlock` across all calendar views (month, week, day, list)
- Hidden events stored in DuckDB table `map_hidden_events` (event_id, hidden_at)
- "Show hidden" toggle in toolbar reveals hidden events greyed out
- Hidden events excluded from duration calculations and submit flow

**Data model:**
```sql
CREATE TABLE map_hidden_events (
  event_id VARCHAR PRIMARY KEY, -- matches dds_calendar_events.event_id (Google Calendar event ID)
  hidden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Schema migration:** Add table to `src/lib/duckdb/schema.ts`, bump `SCHEMA_VERSION`. Existing DuckDB instances get the table on next init via migration path.

### 2. Add Log Button (everywhere)

Universal entry point for manual time logging. Click → modal opens.

**Entry points:**
- **Floating Action Button (FAB):** bottom-right corner, always visible regardless of active view
- **Context-aware triggers:** clicking empty space in day/week grid pre-fills date+time; clicking "+" on a month cell pre-fills the date
- **Task list view:** "Add Log" row at the bottom of each day group

**Modal:**
- Reuses/extends existing `CustomInputForm`
- Fields: description, duration, date/time, Jira issue (searchable dropdown with recent issues)
- UI/UX skills (ui-ux-design, frontend-design, ui-ux-pro-max) to be invoked during implementation

### 3. Enhanced Mappings Tab

Enhance the existing `MappingsTab` with two new sections alongside the current keyword→issue rules.

**Section 1 — Rules (existing):**
- Keyword→issue mapping, unchanged

**Section 2 — Manual Overrides:**
- Table showing event_name → issue assignments the user made manually
- Stored in `map_event_issue_override` (event_name_pattern, issue_key, issue_name, created_at)
- When a user manually assigns an issue to a calendar event, the pair is remembered here
- Future events with the same name auto-inherit the assignment

**Section 3 — AI Suggestions:**
- "Suggest Mappings" button appears when unmapped events exist
- Fuzzy-matches event names to Jira issue names
- Results shown as a list: event name | suggested issue | confidence | approve/reject buttons
- Approved suggestions become manual overrides

**Data model:**
```sql
CREATE TABLE map_event_issue_override (
  event_name_pattern VARCHAR NOT NULL,
  issue_key VARCHAR NOT NULL,
  issue_name VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_name_pattern, issue_key)
);
```

**AI matching approach:** Client-side string similarity (e.g. Levenshtein / trigram via a lightweight JS library). No LLM call needed — issue names and event names are short strings where fuzzy matching is sufficient. Avoids network dependency and bundle bloat.

**Schema migration:** Add table to `src/lib/duckdb/schema.ts`, bump `SCHEMA_VERSION`.

---

## v0.3 — Close the Loop

**Goal:** User can submit logged hours to Jira/Tempo and see what differs between local and remote.

### 4. Submit to Jira

End-to-end submission of local worklogs to Jira or Tempo.

**Pre-submit review screen:**
- Table grouped by issue: issue key | issue name | total hours | worklog count | date range
- Color-coded: green = mapped, red = unmapped (blocks submit)
- Unmapped items shown with inline "Assign issue" action

**Validation gate:**
- All tasks must be mapped to an issue before submit is enabled
- Unmapped count shown prominently

**Target selection:**
- Auto-detect available connections: Tempo connected → default to Tempo API; only Jira → use Jira REST `/issue/{key}/worklog`
- User can override via dropdown

**Submit flow:**
1. Confirmation dialog with summary
2. Progress bar per worklog
3. Success/failure summary with retry for failed items
4. Partial submit supported: user can select which days/issues to submit (checkbox per row)

**Post-submit status:**
- Month gets a status badge: "Submitted" or "Modified after submit"
- Status is informational, NOT a lock — user can freely edit past months
- Editing a submitted month updates status to "Modified after submit"
- Submit is repeatable: user can edit → see diff → re-submit

**Data model:**
```sql
-- Track submission events
CREATE TABLE submit_history (
  submit_id VARCHAR PRIMARY KEY,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  target VARCHAR NOT NULL, -- 'tempo' | 'jira'
  worklog_count INTEGER,
  total_hours DOUBLE,
  status VARCHAR DEFAULT 'submitted' -- 'submitted' | 'partial' | 'failed'
);
```

**Schema migration:** Add table to `src/lib/duckdb/schema.ts`, bump `SCHEMA_VERSION`.

**Error handling:** Failed submissions persist partial state in `submit_history` with status='partial'. User can retry failed items from the success/failure summary screen. If offline mid-submission, completed items are recorded; remaining items stay pending for retry.

### 5. Difference View

Side-by-side comparison of local state vs what's in Jira/Tempo.

**Summary level:**
- Table: Issue Key | Issue Name | Local Hours | Jira Hours | Delta
- Row highlighting: green (match), yellow (partial mismatch), red (missing on one side)
- Period selector: same month picker as main calendar

**Drill-down:**
- Click a row → expand to show individual worklogs on both sides
- Matched pairs shown together, orphans highlighted

**Actions from diff view:**
- "Push missing to Jira" — submit items only in local
- "Pull from Jira" — import items only in Jira as `custom_input` tasks in local DdsTask table (source: 'jira_pull')

**Access:** New tab or sub-view accessible from toolbar (split arrows icon).

---

## v0.4 — Polish & History

**Goal:** Traceability and data portability.

### 6. Timesheet History (tentative)

> **Note:** This feature is tentative — may be cut if the Difference View covers the same need.

- Tab showing previously submitted months
- Each row: period | total hours | submit date | status (submitted / modified since)
- Click to expand → same summary table as pre-submit review
- Data source: local submit_history + optionally re-fetch from Jira/Tempo API

### 7. Audit Log

Enhance the existing `activity-log` store for full traceability.

- Track: syncs, submits, manual edits, mapping changes, connection events
- Searchable/filterable table: timestamp | action type | details | status
- Persisted to DuckDB `audit_log` table (already exists in schema)
- Exportable (feeds into Export Reports)

### 8. Export Reports

CSV & JSON export from any data view.

- "Export" button in toolbar with format picker (CSV / JSON)
- Works on: tasks, worklogs, diff view, audit log
- Optional date range filter for exports

---

## v0.5+ — Scale & Intelligence

**Goal:** Broader integrations, smarter automation, security, mobile. Each item gets its own brainstorming cycle when prioritized.

| Feature | Description | Notes |
|---------|-------------|-------|
| **AI-powered Tasks** | Intelligent task forming, editing, and analysis | Builds on AI suggestions from v0.2 mappings |
| **More Sources** | Slack, Notion, and more | New data sources → same DdsTask pipeline |
| **Custom Input Integrations** | Google Sheets, Chrome Extension, Slack, Telegram | External entry points for time logging |
| **Secret Gating** | PIN/password/crypto for long-lived API keys | Security layer on existing token storage |
| **Custom Reports** | Visual report builder | Extends v0.4 Export Reports |
| **Sync & Mobile** | Cross-device sync, mobile-friendly UI | Responsive redesign + potential PWA |

---

## Dependencies

```
v0.2 Hide Events ──┐
v0.2 Add Log ──────┤──→ v0.3 Submit to Jira ──→ v0.4 Timesheet History
v0.2 Mappings ─────┘
                     ──→ v0.3 Difference View (independent — uses sync infrastructure)

v0.4 Audit Log (independent — tracks all actions)
v0.4 Export Reports (benefits from Audit Log as one exportable view)
```

- Submit requires events to be filterable (Hide), loggable (Add Log), and mappable (Mappings)
- Difference View is independent of Submit — compares local state vs remote Jira/Tempo via existing sync infrastructure
- Timesheet History requires Submit (shows what was submitted)
- Audit Log is independent — tracks syncs, edits, mappings, connections regardless of Submit
- Export Reports benefits from Audit Log (one of the exportable views) but doesn't hard-depend on it

---

## Existing Codebase Touchpoints

| Feature | Existing Code | Work Needed |
|---------|--------------|-------------|
| Hide Events | `EventBlock.tsx`, calendar views | New toggle + DuckDB table |
| Add Log | `CustomInputForm.tsx`, `tasks.ts` store | FAB component + context-aware triggers |
| Mappings | `MappingsTab.tsx`, `MappingForm.tsx`, `mappings.ts` store | Add overrides section + AI suggestions |
| Submit | Disabled button in toolbar, `jira.ts`/`tempo.ts` API clients | Full submit flow + review screen |
| Diff View | `sync.ts` already fetches both sides | New comparison UI + reconciliation logic |
| Audit Log | `activity-log.ts` store, `audit_log` DuckDB table | Enhance persistence + UI |
| Export | None | New utility + toolbar button |

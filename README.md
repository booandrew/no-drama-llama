# NoDramaLLama

**Your AI-powered timesheet sidekick.** Stop dreading time logging. Let the llama handle the drama.

NoDramaLLama is a fully client-side web app that helps you track, manage, and log working hours. It pulls raw activity from Google Calendar, Jira, and custom inputs, stores everything locally in DuckDB WASM, and syncs approved time entries to Jira — all without a backend server.

### Key features

- **100% client-side** — no backend, all data lives in the browser via DuckDB WASM
- **Import from multiple sources** — Google Calendar(s), Jira issues, Custom Inputs (quick action events tracker)
- **DWH-like data pipeline** — Sources → DDS → Reports, with full history and revision tracking
- **Three time-period modes** — work with your data by DAY, WEEK, or MONTH
- **Keyword-to-issue mappings** — configure rules to auto-map activities to Jira projects and issues
- **One-click sync to Jira** — push approved worklogs straight to Jira Cloud
- **Your keys, your data** — API tokens stored in localStorage; nothing leaves the browser except direct API calls

---

## Why

If you've ever worked in consulting, you know the pain:

- **"What did I even do on Tuesday?"** — reconstructing a week from memory is a losing game
- **"Which Jira issue does this meeting belong to?"** — mapping calendar events to project codes is tedious busywork
- **"I need to split 8 hours across 4 projects"** — percentage math at 6 PM on a Friday is nobody's idea of fun

NoDramaLLama exists so you never have to solve these problems manually again.

---

## How it works

```
  Select period (Day / Week / Month)
      |
      v
  Load data sources
  (Google Calendar, Jira issues, Custom Inputs)
      |
      v
  Raw Data Layer (Sources as-is from APIs)
      |
      v
  DDS: Tasks table (structured, classified, with durations)
  Uses keyword-to-issue mappings + user edits
      |
      v
  Reports: Jira Timesheet table
      |
      v
  Review & edit in UI
      |
      v
  Sync to Jira (create/update/delete worklogs)
```

---

## Architecture

**Client-only SPA — no backend.** Motivation: data privacy. All credentials, tokens, and data stay in the browser.

| Layer                | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| **Frontend**         | React 19 + TypeScript 5.9, Vite 7, shadcn/ui (New York), Tailwind CSS v4 |
| **Storage**          | DuckDB WASM — all data stored in-browser with SQL query capability       |
| **Auth**             | OAuth 2.0 with PKCE (Jira, Google) — tokens in localStorage             |
| **Data Sources**     | Jira Cloud, Google Calendar(s), Custom Inputs                            |
| **Target System**    | Jira Cloud (native worklogs via REST API v3)                             |
| **Data Pipeline**    | Sources (Raw) → DDS (Tasks) → Reports (Jira Timesheet)                  |
| **Mappings**         | User-defined keyword → project/issue rules for auto-classification       |

### Data layers (DWH-like)

The app follows a classic data warehouse pattern:

1. **Raw Data Layer (Sources)** — data loaded as-is from external APIs, with full history
2. **DDS (Detailed Data Store)** — core `TASK_VERSIONS` table with global revision tracking
3. **Reports Layer** — Jira Timesheet table, aggregated and ready for sync
4. **Mappings** — user-defined keyword-to-project/issue classifiers used in data transformations

### Task versioning

Tasks use an append-only `TASK_VERSIONS` table with a **global revision counter** (shared across all tasks):

- **Current state** — for each `task_id`, the row with `max(revision)`
- **Edit a task** — insert new row with `revision = global_max + 1`
- **Snapshot at revision N** — for each `task_id`, row with `max(revision) WHERE revision <= N`
- **Restore to revision N** — `DELETE WHERE revision > N`

---

## Data sources

| Source               | Description                                                  | Status       |
| -------------------- | ------------------------------------------------------------ | ------------ |
| **Jira Cloud**       | Issues (summary, status, project, time tracking)             | In progress  |
| **Google Calendar**  | Events from one or more calendars (supports multiple connections) | Working      |
| **Custom Inputs**    | Quick action events: text + auto-timestamp, optional duration/issue/project | Planned      |

### Custom Inputs

A special type of data source where the user proactively registers events:

- **From external integrations**: text string (mandatory) + automatic timestamp
- **From built-in app UI**: text string (mandatory) + optional duration, Jira issue, project + automatic timestamp

---

## Target system

**Jira Cloud** (same instance as the Jira data source)

- Uses Jira Cloud REST API v3 native worklogs (`/issue/{key}/worklog`)
- All write calls use `?adjustEstimate=leave&notifyUsers=false`
- Rate limits: 20 writes per 2s / 100 writes per 30s per issue

---

## Screens / UX

User works in three data-period modes: **DAY**, **WEEK**, **MONTH**.

| Screen                    | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| **Settings / Connectors** | Configure OAuth connections (Jira, Google Calendar), manage API tokens  |
| **Tasks UI**              | Create, update, delete tasks; view DDS data; manage keyword mappings    |
| **Reports UI**            | View aggregated timesheet data, stats with graphs, detailed/aggregated views |
| **Sync to Jira UI**       | Review timesheet diff, push approved worklogs to Jira                   |

User can see all data in UI: all sources, DDS tables, reports tables, and mappings.

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v9+)

### Install & run

```bash
git clone https://github.com/booandrew/no-drama-llama.git
cd no-drama-llama
pnpm install
pnpm dev
```

The dev server starts at `http://localhost:5173`. Click "Connect Google Calendar" to authorize via Google OAuth and fetch your calendar events.

### Available scripts

| Command          | Description                                |
| ---------------- | ------------------------------------------ |
| `pnpm dev`       | Start Vite dev server with HMR             |
| `pnpm build`     | TypeScript type-check + production build   |
| `pnpm lint`      | Run ESLint                                 |
| `pnpm format`    | Prettier (src/**/*.{ts,tsx,css})            |
| `pnpm preview`   | Preview production build locally           |

### Environment variables

Create a `.env.local` file with:

```env
VITE_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
```

Additional variables will be needed as more connectors are implemented:
- Jira OAuth client ID
- LLM API key (for future AI-powered task mapping)

---

## OAuth approach

Standard **OAuth 2.0 Authorization Code Flow with PKCE** — designed for public clients (no backend secret needed).

1. User clicks "Connect Jira" or "Connect Google Calendar"
2. Redirect to provider's OAuth consent screen
3. Provider redirects back with auth code
4. Exchange code for access + refresh tokens (client-side, PKCE protects this)
5. Store tokens in localStorage

Token refresh happens automatically — `expiresAt` is checked before each API call.

---

## Privacy & Security

- **No backend** — the app is a fully client-side SPA. No server stores your data or credentials.
- **Tokens in localStorage** — API keys and OAuth tokens are stored locally in the browser.
- **XSS protection** — the app must be absolutely protected against XSS attacks to safeguard stored credentials.
- **Direct API calls only** — data is sent directly to Jira Cloud and Google APIs from the browser. No intermediary servers.

---

## Tech stack

| Technology            | Role                            |
| --------------------- | ------------------------------- |
| React 19              | UI framework                    |
| TypeScript 5.9        | Type safety                     |
| Vite 7                | Build tool & dev server         |
| Tailwind CSS v4       | Styling                         |
| shadcn/ui (New York)  | Component library               |
| DuckDB WASM           | In-browser SQL database         |
| React Hook Form + Zod | Form handling & validation      |
| Recharts              | Data visualization              |
| Lucide React          | Icons                           |
| pnpm                  | Package manager                 |

---

## Future improvements

- Export reports for manual sync (CSV, JSON)
- AI-powered task forming, editing, and analyzing (Anthropic via LiteLLM)
- Pin/password-protected secrets (encrypted API keys in localStorage)
- Additional data sources: GitHub(s), GitLab(s), Slack, Notion
- Custom Input integrations: Google Sheets, Chrome Extension, Slack, Telegram
- Custom reports UI (creation, exporting, sharing)
- Additional target systems (TBD)

---

## Contributing

Contributions welcome! This project is in early stages.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Open a PR

---

## License

[MIT](LICENSE)

---

`I_PROMISE_I_DIDNT_PRE_CODE_THIS`

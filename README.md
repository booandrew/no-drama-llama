# NoDramaLLama

**Your AI-powered timesheet sidekick.** Stop dreading time logging. Let the llama handle the drama.

NoDramaLLama is a web app that pulls your raw activity from calendars, Jira, and other sources, then uses AI to map, normalize, and prepare time entries — so you can review a clean diff and sync to Jira Tempo in one click.

### Key features

- **Import from anywhere** — Google Calendar, Jira issues, Git commits, quick manual input
- **AI-assisted mapping** — chat with AI to resolve ambiguous entries, split time, match activities to Jira issues
- **Diff before you sync** — see exactly what will be logged vs. what's already in Tempo
- **One-click sync** — push approved entries straight to Jira Tempo Timesheets
- **Your keys, your data** — bring your own API tokens; nothing is stored on third-party servers

---

## Why

If you've ever worked in consulting, you know the pain:

- **"What did I even do on Tuesday?"** — reconstructing a week from memory is a losing game
- **"Which Jira issue does this meeting belong to?"** — mapping calendar events to project codes is tedious busywork
- **"I need to split 8 hours across 4 projects"** — percentage math at 6 PM on a Friday is nobody's idea of fun
- **Tempo says I logged 6h but I worked 9h** — the diff between reality and the system is always a surprise

NoDramaLLama exists so you never have to solve these problems manually again.

---

## How it works

```
  Select month
      |
      v
  Import raw activities
  (Calendar, Jira, Git, manual input)
      |
      v
  AI Chat: map, normalize, resolve conflicts
      |
      v
  Desired time log (issue + date + hours)
      |
      v
  Fetch actual Tempo worklogs
      |
      v
  Diff: desired vs. actual
      |
      v
  Review & edit
      |
      v
  Sync to Jira Tempo
```

---

## Architecture

> **Note:** The runtime architecture (fully client-side vs. lightweight backend proxy) is an **open question** currently being discussed by the team.

**What's decided:**

| Layer             | Description                                                            |
| ----------------- | ---------------------------------------------------------------------- |
| **Frontend**      | React 19 + TypeScript, Vite, shadcn/ui (New York), Tailwind CSS v4     |
| **Connectors**    | Pluggable adapters that pull raw events from external sources          |
| **AI layer**      | LLM-powered chat for mapping and normalization (Anthropic via LiteLLM) |
| **Target format** | Jira issue key + date + hours (Tempo Timesheets worklog)               |
| **Desired log**   | The "ideal" time entries generated from raw activities + AI            |
| **Actual log**    | What's currently in Tempo for the selected period                      |
| **Diff engine**   | Compares desired vs. actual, surfaces additions/changes/deletions      |

---

## Screens / UX

> **Open question:** Screen breakdown is conceptual and subject to change.

| Screen                    | Purpose                                                                          |
| ------------------------- | -------------------------------------------------------------------------------- |
| **Settings / Connectors** | Configure API tokens (Jira, Calendar, AI), manage connector settings             |
| **Month View**            | Select a time period, see imported raw activities, overview of logged hours      |
| **AI Chat Editor**        | Conversational interface to resolve mapping conflicts, split time, ask questions |
| **Diff & Sync**           | Side-by-side comparison of desired vs. actual entries; approve and push to Tempo |

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

### Available scripts

| Command        | Description                      |
| -------------- | -------------------------------- |
| `pnpm dev`     | Start Vite dev server with HMR   |
| `pnpm build`   | Type-check + production build    |
| `pnpm lint`    | Run ESLint                       |
| `pnpm preview` | Preview production build locally |

### Environment variables

> **TODO:** No `.env.example` exists yet. The following tokens will be needed once connectors are implemented:

- Jira / Tempo API token
- Google Calendar OAuth credentials (or API key)
- LLM API key (Anthropic via LiteLLM)

---

## Connectors

### Planned

| Connector           | Source                                  | Status              |
| ------------------- | --------------------------------------- | ------------------- |
| **Google Calendar** | Calendar events (meetings, blocks)      | Planned             |
| **Jira / Tempo**    | Issues, existing worklogs               | Planned             |
| **Git**             | Commit history per repo                 | Planned             |
| **Quick Input**     | Manual text entry ("2h on PROJECT-123") | Planned             |
| **Trello**          | Cards and activity                      | Under consideration |

---

## Privacy & Security

- **Your tokens stay local.** API keys and OAuth tokens are stored in the browser (localStorage / sessionStorage). No third-party backend stores your credentials.
- **AI sees your data.** When you use the AI chat for mapping, your activity summaries are sent to the configured LLM provider (Anthropic via LiteLLM). Review your provider's data policies.
- **Each user brings their own token.** There is no shared account — every team member configures their own Jira, Calendar, and AI credentials.
- **Not for financial or medical use.** NoDramaLLama is a productivity tool for time tracking. Don't use it for billing, invoicing, or anything requiring audit-grade accuracy without manual verification.

---

## FAQ

**Q: What if I have no calendar events or commits for a day?**
A: Use Quick Input to manually describe what you worked on. The AI can help structure free-text into proper time entries.

**Q: How does the AI know which Jira issue to map my meeting to?**
A: It uses context from your Jira project list, issue titles, and any hints you've provided in previous sessions. You always review and approve before sync.

**Q: Can I use this without Jira?**
A: Not yet. Jira Tempo is the only sync target right now. You could use it as a read-only planner (import + AI mapping) but there's nowhere to push the result without Jira.

**Q: Is my data sent to a server?**
A: Your data is sent to the LLM provider (Anthropic) for AI-assisted mapping. No other backend is involved. Tokens and activity data stay in your browser.

**Q: Can I export to CSV instead of syncing?**
A: Not yet, but it's a natural next step. For now, the only output target is Jira Tempo.

---

## Open questions

These are active design decisions not yet finalized:

- **Runtime architecture** — Fully client-side SPA with direct API calls, or a lightweight backend proxy to handle tokens and CORS?
- **Screen breakdown** — The current 4-screen model (Settings, Month View, AI Chat, Diff & Sync) is conceptual. Final UX may differ.
- **Data model** — Entity definitions (Raw Events, Desired Log, Actual Log, Mapping Hints) are not yet locked down.
- **Roadmap** — No formal roadmap exists yet. Feature priorities will emerge as the core flow is built.

---

## Contributing

Contributions welcome! This project is in early stages — check the [open questions](#open-questions) section for areas that need input.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Open a PR

---

## License

[MIT](LICENSE)

---

## Tech stack

| Technology            | Role                       |
| --------------------- | -------------------------- |
| React 19              | UI framework               |
| TypeScript 5.9        | Type safety                |
| Vite 7                | Build tool & dev server    |
| Tailwind CSS v4       | Styling                    |
| shadcn/ui (New York)  | Component library          |
| React Hook Form + Zod | Form handling & validation |
| Recharts              | Data visualization         |
| Lucide React          | Icons                      |
| pnpm                  | Package manager            |

---

`I_PROMISE_I_DIDNT_PRE_CODE_THIS`

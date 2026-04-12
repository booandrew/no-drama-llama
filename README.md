# NoDramaLLama

**Your AI-powered timesheet sidekick.** Stop dreading time logging. Let the llama handle the drama.

NoDramaLLama is a web app that pulls activity from Google Calendar and Jira, stores everything locally in DuckDB WASM, and syncs approved time entries to Jira Tempo Timesheets. Cloudflare Pages edge functions handle OAuth and API proxying.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [pnpm](https://pnpm.io/) v9+

### Install & run

```bash
git clone https://github.com/booandrew/no-drama-llama.git
cd no-drama-llama
pnpm install
pnpm dev
```

`pnpm dev` runs the app through Cloudflare Pages via Wrangler. Browse to `http://localhost:8788`.

If you only want the Vite dev server, run:

```bash
pnpm dev:vite
```

That starts Vite on `http://localhost:5173`.

### Environment variables

Create a `.env.local`:

```env
# Optional org label shown in the UI
VITE_ORG_NAME=<your-org-name>

# Org-level Google Calendar OAuth
VITE_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>

# Org-level Jira OAuth
VITE_JIRA_CLIENT_ID=<your-jira-oauth-client-id>
JIRA_CLIENT_SECRET=<your-jira-oauth-client-secret>
```

Notes:

- `VITE_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` enable org-level Google Calendar OAuth.
- `VITE_JIRA_CLIENT_ID` + `JIRA_CLIENT_SECRET` enable org-level Jira OAuth.
- Google Calendar also supports a personal OAuth app flow in the UI, where users provide their own client ID and client secret.
- Jira does not support a personal OAuth client flow in the UI. The fallback there is Jira site URL + email + API token.

### Scripts

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `pnpm dev`           | Wrangler Pages dev + Vite                |
| `pnpm dev:vite`      | Vite dev server only                     |
| `pnpm build`         | TypeScript type-check + production build |
| `pnpm lint`          | ESLint                                   |
| `pnpm format`        | Prettier (`src/**/*.{ts,tsx,css}`)        |
| `pnpm preview`       | Preview production build locally         |
| `pnpm preview:cf`    | Build and preview with Cloudflare Pages  |

## Tech stack

| Technology            | Role                           |
| --------------------- | ------------------------------ |
| React 19              | UI framework                   |
| TypeScript 5.9        | Type safety                    |
| Vite 7                | Build tool & dev server        |
| Tailwind CSS v4       | Styling                        |
| shadcn/ui (New York)  | Component library              |
| DuckDB WASM           | In-browser SQL database        |
| Zustand               | State management               |
| React Hook Form + Zod | Form handling & validation     |
| Recharts              | Data visualization             |
| Cloudflare Pages      | Hosting & edge functions       |
| pnpm                  | Package manager                |

## Contributing

Contributions welcome! This project is in early stages.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Open a PR

Please run `pnpm lint` and `pnpm format` before submitting.

## License

MIT

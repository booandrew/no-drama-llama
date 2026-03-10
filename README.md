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

The dev server starts at `http://localhost:5173`.

### Environment variables

Create a `.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
VITE_JIRA_CLIENT_ID=<your-jira-oauth-client-id>
```

Both are optional — users can enter their own OAuth client IDs in the UI if org-level ones aren't set.

### Scripts

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `pnpm dev`           | Vite dev server with HMR                 |
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

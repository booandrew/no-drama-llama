# AGENTS.md

## Commands

```bash
pnpm install        # install dependencies
pnpm dev            # Vite + wrangler (edge functions + HMR), browse on :8788
pnpm dev:vite       # Vite only (no edge functions)
pnpm build          # TypeScript type-check + Vite production build
pnpm lint           # ESLint (flat config)
pnpm format         # Prettier (src/**/*.{ts,tsx,css})
pnpm preview        # preview production build locally
pnpm preview:cf     # build + preview with Cloudflare Pages (wrangler)
```

## Tech stack

- **React 19 + TypeScript 5.9 + Vite 7** — ESM, SWC via `@vitejs/plugin-react-swc`
- **Tailwind CSS v4** — oklch CSS variables, dark/light theming via `next-themes`
- **shadcn/ui (New York)** — 56 components in `src/components/ui/`, add new ones via `pnpm dlx shadcn@latest add <name>`
- **Cloudflare Pages** — hosting + edge functions in `functions/` (wrangler)
- Path alias: `@/*` → `./src/*` (tsconfig + vite)
- Code style: no semicolons, single quotes, trailing commas, 100 char width, 2-space indent

## Libraries

| Library | Purpose |
| --- | --- |
| **zustand** | Global state (`src/store/*.ts`), curried `create<T>()(...)` pattern, access via selectors |
| **@duckdb/duckdb-wasm** + **apache-arrow** | In-browser SQL database, schema in `src/lib/duckdb/` |
| **react-hook-form** + **zod** | Form handling & validation |
| **recharts** | Charts, wrapped by `src/components/ui/chart.tsx` |
| **date-fns** | Date formatting & arithmetic |
| **matter-js** | Physics engine (llama bucket animation) |
| **sonner** | Toast notifications |
| **lucide-react** | Icons |
| **clsx** + **tailwind-merge** | `cn()` utility in `src/lib/utils.ts` |

## Directory structure

```
.
├── functions/              # Cloudflare Pages edge functions (Jira/Tempo API proxies, OAuth)
├── public/                 # static assets (favicons, manifest)
├── src/
│   ├── assets/             # SVG illustrations
│   ├── components/
│   │   ├── ui/             # shadcn/ui (DO NOT edit — regenerate via shadcn CLI)
│   │   └── insights/       # dashboard charts & visualizations
│   ├── hooks/              # custom React hooks
│   ├── lib/                # utilities, API clients, DuckDB init + schema
│   └── store/              # Zustand stores (one per domain: app, calendar, jira, tempo, etc.)
├── components.json         # shadcn/ui config
├── eslint.config.js
├── tsconfig.json           # project references (app + node)
├── tsconfig.app.json       # src/ TypeScript config
├── tsconfig.node.json      # node-side TypeScript config
└── vite.config.ts
```

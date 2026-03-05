# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NoDramaLLama — AI-powered timesheet sidekick. Pulls raw activity from Google Calendar, Jira, Git, then uses AI (Anthropic via LiteLLM) to map/normalize entries and sync to Jira Tempo Timesheets. Fully client-side: tokens stored in the browser.

## Commands

```bash
pnpm install        # Install dependencies
pnpm dev            # Vite dev server with HMR
pnpm build          # TypeScript type-check + Vite production build
pnpm lint           # ESLint (flat config)
pnpm format         # Prettier (src/**/*.{ts,tsx,css})
pnpm preview        # Preview production build locally
```

## Architecture

- **React 19 + TypeScript 5.9 + Vite 7** — ESM modules, SWC for fast builds
- **Tailwind CSS v4** with CSS variables (oklch color space), dark/light theming via `next-themes`
- **shadcn/ui (New York style)** — 58 pre-installed components in `src/components/ui/`, generated via `pnpm dlx shadcn@latest add <component>`
- **Form stack**: React Hook Form + Zod validation + `@hookform/resolvers`
- **Charts**: Recharts wrapped by `src/components/ui/chart.tsx`
- **Icons**: Lucide React

### Path aliases

`@/*` → `./src/*` (configured in both `tsconfig.json` and `vite.config.ts`)

### State management

- **Zustand** (`src/store/app.ts`) — global app state via `useAppStore` hook
- Use Zustand for any state shared across multiple components or that represents app-level concerns (auth, user preferences, fetched data caches, UI flags like sidebar open/closed)
- Use local `useState` only for ephemeral component-scoped state (form inputs, hover/focus, animation toggles)
- Store pattern: `create<T>()(...)` (curried TypeScript form per Zustand v5 docs)
- Access in components via selectors: `useAppStore((s) => s.fieldName)` — avoids unnecessary re-renders

### Key patterns

- **CVA (class-variance-authority)** for type-safe component variants (see `buttonVariants` in `button.tsx`)
- **Compound components**: Card, Form, Sidebar — composed from multiple named exports
- **`cn()` utility** (`src/lib/utils.ts`): merges class names via `clsx` + `tailwind-merge`
- **`useIsMobile` hook** (`src/hooks/use-mobile.ts`): media query check at 768px breakpoint
- **Data attributes** for styling: `data-slot`, `data-variant`, `data-size`

### Source layout

```
src/
├── App.tsx              # Root component
├── main.tsx             # React entry point
├── index.css            # Tailwind globals + CSS variables
├── components/ui/       # shadcn/ui components (do not edit manually — regenerate with shadcn CLI)
├── store/app.ts         # Zustand global store (useAppStore)
├── lib/utils.ts         # cn() utility
└── hooks/use-mobile.ts  # Mobile detection hook
```

## Code style

- **Prettier**: no semicolons, single quotes, trailing commas, 100 char width, 2-space indent
- **ESLint**: flat config with TypeScript + React Hooks + React Refresh rules
- **TypeScript strict mode**: `noUnusedLocals`, `noUnusedParameters` enabled

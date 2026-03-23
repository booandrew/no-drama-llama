# Quick Actions — Activity Log

## Overview

Replace the Quick Actions placeholder card with a real-time activity log that records all user actions in the application. The log lives in the right sidebar and can expand as an overlay to full sidebar height.

## Data Model

Zustand store `useActivityLogStore` (in-memory, no persist). Each entry:

- **id** — unique string (crypto.randomUUID)
- **timestamp** — Date
- **type** — `sync` | `mapping` | `submit` | `connection` | `input` | `settings` | `export`
- **status** — `success` | `error` | `info` | `pending`
- **message** — human-readable text, e.g. "Synced 42 events from Google Calendar"
- **details** — optional extra info (counts, links)

Max 100 entries, oldest removed automatically. Utility function `logAction(type, status, message, details?)` exposed from the store.

## UI Component: QuickActionsCard

### Collapsed (default)

- Card in right sidebar, below SummaryCard (280px width)
- Header: "Quick Actions" + expand button (Maximize2 icon)
- Last 5 entries as compact list
- Each entry: status icon + message text + relative time ("2m ago")
- Icon colors: green (success), red (error), blue (info), yellow (pending)

### Expanded (overlay)

- Card expands upward, overlaying SummaryCard, filling full sidebar height
- Header: "Quick Actions" + collapse button (Minimize2 icon)
- Full scrollable log
- Date grouping (if entries span multiple dates)
- Auto-scroll to newest entries

### Empty state

"No actions yet — start by connecting an integration."

## Integration Points

| Store / Component | What to log |
|---|---|
| `calendar.ts` → `fetchEvents()` | "Syncing Google Calendar..." → "Synced N events" / error |
| `jira.ts` → `loadAll()` | "Syncing Jira issues..." → "Loaded N issues" / error |
| `jira.ts` → `exchangeCode()`, `connectWithToken()` | "Connected to Jira" |
| `tempo.ts` | "Syncing Tempo..." → success/error |
| `custom-inputs.ts` → `addItem()`, `updateItem()`, `deleteItem()` | "Added/Updated/Deleted custom entry" |
| `mappings.ts` | "Mapped event X to issue Y" |
| `IntegrationsPopover` | "Connected/Disconnected Google Calendar" |
| `app.ts` → `toggleMockMode()` | "Switched to mock/real data" |

## New Files

- `src/store/activity-log.ts` — Zustand store
- `src/components/QuickActionsCard.tsx` — UI component

## Technical Decisions

- **Approach A**: Explicit `logAction()` calls (not middleware) for full control over messages
- **Persistence**: In-memory only, clears on page refresh
- **Visual style**: Matches app design system (shadcn/tailwind), not terminal-style
- **Expand behavior**: Overlay (absolute/fixed positioning), does not change page layout

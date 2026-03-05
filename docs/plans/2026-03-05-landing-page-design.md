# Landing Page Design — NoDramaLLama

## Goal

Internal pitch landing page for team/management. Fun tone, llama-themed. Key message: stop suffering at end of month filling timesheets.

## Approach

Long scroll-story landing page with 5 sections. Separate route (`/landing` or root `/`). All content in English.

## Animations

Inspired by SecondStack-landing:

- **Hero entrance**: CSS `@keyframes hero-in` — `blur(8px)` to `blur(0)`, `translateY(20px)` to `0`, `opacity 0` to `1`. Duration 1.3s, `cubic-bezier(0.16, 1, 0.3, 1)`. Cascading delays per element (600ms–1750ms).
- **Scroll fade-up**: IntersectionObserver + CSS transitions (`opacity`, `transform`). Triggers once at `threshold: 0.1`.
- **Accessibility**: `@media (prefers-reduced-motion: reduce)` disables all animations.

No external animation libraries. Pure CSS + IntersectionObserver.

## Sections

### 1. Hero (full viewport height)

- Large headline with cascading blur-in:
  - Line 1 (delay 600ms): **"No Drama."**
  - Line 2 (delay 750ms): **"Just Llama Time."**
  - Subheadline (delay 900ms): **"The AI sidekick that fills your timesheets so you don't have to."**
  - CTA button (delay 1100ms): **"Try it"** → navigates to app
  - Llama SVG (delay 1750ms): Jema Luis SVG with clip-path fill animation (bottom to top), representing logged hours progress

### 2. Pain Points

Heading: **"Sound familiar?"**

3 cards with fade-up on scroll:

| Card | Icon | Title | Description |
|------|------|-------|-------------|
| 1 | Calendar/panic | "End of month. Panic mode." | "It's the last day. You stare at an empty timesheet. What did you even do three weeks ago?" |
| 2 | Brain/thinking | "The guessing game" | "Was that meeting about Project A or Project B? Let me check my calendar... and Jira... and Git..." |
| 3 | Clock/wasted | "Hours wasted on hours" | "You spend 2 hours every month manually logging hours. The irony is not lost on us." |

### 3. How it Works

Heading: **"How it works"**

Horizontal 3-step flow with fade-up + cascading delays:

**Step 1: Collect** — Icon: sources (Calendar, Jira, Git logos)
"NoDramaLLama pulls your activity from Google Calendar, Jira issues & worklogs, and Git commits."

**Step 2: Map** — Icon: AI/brain
"AI (powered by Anthropic) automatically maps events to the right Jira issues. Smart, not magic."

**Step 3: Submit** — Icon: checkmark/tempo
"Review the mapped entries, tweak if needed, and submit to Jira Tempo in one click."

Arrow connectors between steps.

### 4. Features

Heading: **"What the llama can do"**

2x2 grid of feature cards with fade-up:

| Feature | Icon | Title | Description |
|---------|------|-------|-------------|
| 1 | Timeline | "Timeline View" | "Visual month timeline with zoom — see your entire month at a glance, zoom into any day." |
| 2 | BarChart | "Wool Insights" | "Analytics dashboard with project breakdowns, daily activity trends, and KPI tracking." |
| 3 | GitMerge | "Smart Mappings" | "AI maps calendar events and Git activity to Jira issues. Learns your patterns over time." |
| 4 | Shield | "Client-side Only" | "All tokens stay in your browser. No backend, no data leaves your machine. Zero drama." |

Optional: mouse-following border glow on hover (CSS variables + mousemove).

### 5. Footer CTA

- Headline: **"Stop the drama. Let the llama handle it."**
- CTA button: **"Start using NoDramaLLama"** → navigates to app
- Footer text: "NoDramaLLama &copy; 2026"

## Technical Implementation

- New file: `src/components/LandingPage.tsx`
- New CSS: animation keyframes in `src/index.css` or co-located
- Routing: conditional render in `App.tsx` based on URL or Zustand state
- Uses existing: shadcn/ui `Button`, `Card`, Jema Luis SVG asset, `cn()` utility
- Custom hook: `useScrollReveal()` wrapping IntersectionObserver for fade-up elements
- No new dependencies needed

## Color & Typography

- Existing project palette (oklch-based blue primary, dark/light themes)
- Open Sans font
- Large display headings for hero (text-5xl/6xl)
- Standard body text for descriptions

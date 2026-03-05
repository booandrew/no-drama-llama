# NoDramaLLama Landing Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a scroll-story landing page (5 sections) as a separate route within the existing React app. Internal pitch, fun llama-themed, all content in English.

**Architecture:** Single `LandingPage.tsx` component with section sub-components. Hash-based routing in `App.tsx` (`#landing` shows landing, default shows app). A `useScrollReveal` hook wraps IntersectionObserver for fade-up animations. CSS keyframes for hero blur-in entrance live in `src/index.css`.

**Tech Stack:** React 19, Tailwind CSS v4, shadcn/ui (Button, Card), Lucide icons, existing Jema Luis llama SVG. No new dependencies.

**Design doc:** `docs/plans/2026-03-05-landing-page-design.md`

---

### Task 1: Add CSS animation keyframes

**Files:**
- Modify: `src/index.css` (append after `@layer base` block, around line 193)

**Step 1: Add hero-in keyframes and utility classes**

Append this CSS to the end of `src/index.css`:

```css
/* ── Landing page animations ─────────────────────────────────── */
@keyframes hero-in {
  from {
    opacity: 0;
    filter: blur(8px);
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    filter: blur(0);
    transform: translateY(0);
  }
}

.hero-enter {
  opacity: 0;
  animation: hero-in 1.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.hero-enter-1 { animation-delay: 600ms; }
.hero-enter-2 { animation-delay: 750ms; }
.hero-enter-3 { animation-delay: 900ms; }
.hero-enter-4 { animation-delay: 1100ms; }
.hero-enter-5 { animation-delay: 1750ms; }

.fade-up {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.fade-up.visible {
  opacity: 1;
  transform: translateY(0);
}

@keyframes llama-fill {
  from { clip-path: inset(100% 0 0 0); }
  to   { clip-path: inset(0% 0 0 0); }
}
.llama-fill-animate {
  animation: llama-fill 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: 1750ms;
}

@media (prefers-reduced-motion: reduce) {
  .hero-enter,
  .fade-up,
  .llama-fill-animate {
    animation: none !important;
    transition: none !important;
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
    clip-path: none !important;
  }
}
```

**Step 2: Verify no syntax errors**

Run: `pnpm build`
Expected: builds without CSS errors.

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(landing): add hero-in, fade-up, and llama-fill CSS animations"
```

---

### Task 2: Create useScrollReveal hook

**Files:**
- Create: `src/hooks/use-scroll-reveal.ts`

**Step 1: Write the hook**

```ts
import { useEffect, useRef } from 'react'

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )

    const targets = el.querySelectorAll('.fade-up')
    targets.forEach((target) => observer.observe(target))

    return () => observer.disconnect()
  }, [])

  return ref
}
```

**Step 2: Verify types**

Run: `pnpm build`
Expected: compiles without type errors.

**Step 3: Commit**

```bash
git add src/hooks/use-scroll-reveal.ts
git commit -m "feat(landing): add useScrollReveal hook with IntersectionObserver"
```

---

### Task 3: Create LandingPage component — Hero section

**Files:**
- Create: `src/components/LandingPage.tsx`

**Step 1: Write the Hero section**

```tsx
import { ArrowRight } from 'lucide-react'

import llamaSvg from '@/assets/73897352_JEMA LUIS 283-03.svg'
import { Button } from '@/components/ui/button'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'

function HeroSection({ onEnterApp }: { onEnterApp: () => void }) {
  return (
    <section className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-6xl font-bold tracking-tight sm:text-7xl">
        <span className="hero-enter hero-enter-1 block">No Drama.</span>
        <span className="hero-enter hero-enter-2 block text-primary">Just Llama Time.</span>
      </h1>
      <p className="hero-enter hero-enter-3 max-w-lg text-lg text-muted-foreground">
        The AI sidekick that fills your timesheets so you don&apos;t have to.
      </p>
      <Button
        size="lg"
        className="hero-enter hero-enter-4 gap-2"
        onClick={onEnterApp}
      >
        Try it <ArrowRight className="size-4" />
      </Button>
      <div className="hero-enter hero-enter-5 relative mt-4 h-64 w-48 sm:h-80 sm:w-60">
        <div
          className="absolute inset-0 bg-contain bg-center bg-no-repeat opacity-20 grayscale"
          style={{ backgroundImage: `url(${llamaSvg})` }}
        />
        <div
          className="llama-fill-animate absolute inset-0 bg-contain bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${llamaSvg})`,
            clipPath: 'inset(100% 0 0 0)',
          }}
        />
      </div>
    </section>
  )
}

export function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  const revealRef = useScrollReveal()

  return (
    <div ref={revealRef} className="bg-background text-foreground">
      <HeroSection onEnterApp={onEnterApp} />
    </div>
  )
}
```

**Step 2: Verify it compiles**

Run: `pnpm build`
Expected: no errors.

**Step 3: Commit**

```bash
git add src/components/LandingPage.tsx
git commit -m "feat(landing): add LandingPage with Hero section"
```

---

### Task 4: Add Pain Points section

**Files:**
- Modify: `src/components/LandingPage.tsx`

**Step 1: Add PainSection component**

Add this component inside `LandingPage.tsx`, before the `LandingPage` export:

```tsx
import { CalendarX, Brain, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const PAIN_POINTS = [
  {
    icon: CalendarX,
    title: 'End of month. Panic mode.',
    description:
      "It's the last day. You stare at an empty timesheet. What did you even do three weeks ago?",
  },
  {
    icon: Brain,
    title: 'The guessing game',
    description:
      'Was that meeting about Project A or Project B? Let me check my calendar... and Jira... and Git...',
  },
  {
    icon: Clock,
    title: 'Hours wasted on hours',
    description:
      'You spend 2 hours every month manually logging hours. The irony is not lost on us.',
  },
]

function PainSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="fade-up mb-12 text-center text-4xl font-bold">Sound familiar?</h2>
      <div className="grid gap-6 sm:grid-cols-3">
        {PAIN_POINTS.map((point) => (
          <Card key={point.title} className="fade-up">
            <CardContent className="flex flex-col gap-3 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <point.icon className="size-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{point.title}</h3>
              <p className="text-sm text-muted-foreground">{point.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
```

**Step 2: Add `<PainSection />` to the LandingPage component**

After `<HeroSection />` in the return JSX:

```tsx
<HeroSection onEnterApp={onEnterApp} />
<PainSection />
```

**Step 3: Verify it compiles**

Run: `pnpm build`
Expected: no errors.

**Step 4: Commit**

```bash
git add src/components/LandingPage.tsx
git commit -m "feat(landing): add Pain Points section with 3 cards"
```

---

### Task 5: Add How it Works section

**Files:**
- Modify: `src/components/LandingPage.tsx`

**Step 1: Add HowItWorksSection component**

```tsx
import { Calendar, BrainCircuit, CheckCircle, ArrowRight } from 'lucide-react'

const STEPS = [
  {
    icon: Calendar,
    title: 'Collect',
    description:
      'NoDramaLLama pulls your activity from Google Calendar, Jira issues & worklogs, and Git commits.',
  },
  {
    icon: BrainCircuit,
    title: 'Map',
    description:
      'AI (powered by Anthropic) automatically maps events to the right Jira issues. Smart, not magic.',
  },
  {
    icon: CheckCircle,
    title: 'Submit',
    description:
      'Review the mapped entries, tweak if needed, and submit to Jira Tempo in one click.',
  },
]

function HowItWorksSection() {
  return (
    <section className="bg-muted/30 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="fade-up mb-16 text-center text-4xl font-bold">How it works</h2>
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-center">
          {STEPS.map((step, i) => (
            <div key={step.title} className="fade-up flex items-start gap-4 sm:flex-col sm:items-center sm:text-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <step.icon className="size-8" />
              </div>
              <div className="max-w-xs">
                <h3 className="mb-1 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight className="mt-4 hidden size-6 text-muted-foreground sm:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

Note: The `ArrowRight` import is already present from Hero. The `Calendar`, `BrainCircuit`, `CheckCircle` icons come from `lucide-react`.

**Step 2: Add `<HowItWorksSection />` after `<PainSection />`**

**Step 3: Verify it compiles**

Run: `pnpm build`
Expected: no errors.

**Step 4: Commit**

```bash
git add src/components/LandingPage.tsx
git commit -m "feat(landing): add How it Works 3-step section"
```

---

### Task 6: Add Features section

**Files:**
- Modify: `src/components/LandingPage.tsx`

**Step 1: Add FeaturesSection component**

```tsx
import { GanttChart, BarChart3, GitMerge, Shield } from 'lucide-react'

const FEATURES = [
  {
    icon: GanttChart,
    title: 'Timeline View',
    description:
      'Visual month timeline with zoom — see your entire month at a glance, zoom into any day.',
  },
  {
    icon: BarChart3,
    title: 'Wool Insights',
    description:
      'Analytics dashboard with project breakdowns, daily activity trends, and KPI tracking.',
  },
  {
    icon: GitMerge,
    title: 'Smart Mappings',
    description:
      'AI maps calendar events and Git activity to Jira issues. Learns your patterns over time.',
  },
  {
    icon: Shield,
    title: 'Client-side Only',
    description:
      'All tokens stay in your browser. No backend, no data leaves your machine. Zero drama.',
  },
]

function FeaturesSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="fade-up mb-12 text-center text-4xl font-bold">What the llama can do</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="fade-up">
            <CardContent className="flex gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="size-6 text-primary" />
              </div>
              <div>
                <h3 className="mb-1 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
```

Note: `Card`, `CardContent` are already imported from Task 4.

**Step 2: Add `<FeaturesSection />` after `<HowItWorksSection />`**

**Step 3: Verify it compiles**

Run: `pnpm build`
Expected: no errors.

**Step 4: Commit**

```bash
git add src/components/LandingPage.tsx
git commit -m "feat(landing): add Features section with 2x2 grid"
```

---

### Task 7: Add Footer CTA section

**Files:**
- Modify: `src/components/LandingPage.tsx`

**Step 1: Add FooterCTASection component**

```tsx
function FooterCTASection({ onEnterApp }: { onEnterApp: () => void }) {
  return (
    <section className="bg-muted/30 px-6 py-24">
      <div className="fade-up mx-auto max-w-2xl text-center">
        <h2 className="mb-6 text-4xl font-bold">
          Stop the drama. Let the llama handle it.
        </h2>
        <Button size="lg" className="gap-2" onClick={onEnterApp}>
          Start using NoDramaLLama <ArrowRight className="size-4" />
        </Button>
        <p className="mt-12 text-sm text-muted-foreground">
          NoDramaLLama &copy; {new Date().getFullYear()}
        </p>
      </div>
    </section>
  )
}
```

**Step 2: Add `<FooterCTASection onEnterApp={onEnterApp} />` as last child in the LandingPage wrapper div**

**Step 3: Verify it compiles**

Run: `pnpm build`
Expected: no errors.

**Step 4: Commit**

```bash
git add src/components/LandingPage.tsx
git commit -m "feat(landing): add Footer CTA section"
```

---

### Task 8: Wire up routing in App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add hash-based routing**

At the top of `App.tsx`, add a state to track current page:

```tsx
import { LandingPage } from '@/components/LandingPage'
```

Inside the `App` function, add before the return:

```tsx
const [page, setPage] = useState(() =>
  window.location.hash === '#app' ? 'app' : 'landing',
)

const goToApp = () => {
  window.location.hash = '#app'
  setPage('app')
}

useEffect(() => {
  const onHash = () => setPage(window.location.hash === '#app' ? 'app' : 'landing')
  window.addEventListener('hashchange', onHash)
  return () => window.removeEventListener('hashchange', onHash)
}, [])

if (page === 'landing') {
  return <LandingPage onEnterApp={goToApp} />
}
```

This goes right before the existing `return (` statement. The existing app renders only if `page === 'app'`.

**Step 2: Verify it works**

Run: `pnpm dev`
- Navigate to `http://localhost:5173/` → should show landing page
- Click "Try it" → should switch to `#app` and show main app
- Navigate to `http://localhost:5173/#app` → should show main app directly

**Step 3: Verify build**

Run: `pnpm build`
Expected: no errors.

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(landing): wire up hash-based routing between landing and app"
```

---

### Task 9: Visual polish and verify

**Files:**
- Modify: `src/components/LandingPage.tsx` (if adjustments needed)

**Step 1: Run dev server and visually inspect all 5 sections**

Run: `pnpm dev`

Check:
- [ ] Hero: blur-in animation plays on load, cascading delays work
- [ ] Llama SVG fills from bottom with clip-path animation
- [ ] Pain Points: 3 cards appear on scroll
- [ ] How it Works: 3 steps with icons and arrow connectors
- [ ] Features: 2x2 grid, cards appear on scroll
- [ ] Footer CTA: headline + button + copyright
- [ ] CTA buttons navigate to `#app`
- [ ] Dark mode works (toggle in app, then go back to landing)
- [ ] Reduced motion: set in system prefs, verify animations are disabled

**Step 2: Fix any visual issues found**

Adjust spacing, font sizes, responsive breakpoints as needed.

**Step 3: Run lint and format**

```bash
pnpm lint && pnpm format
```

**Step 4: Final build check**

```bash
pnpm build
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(landing): visual polish and lint fixes"
```

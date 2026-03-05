import {
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  BrainCircuit,
  Calendar,
  CalendarX,
  CheckCircle,
  Clock,
  Download,
  GanttChart,
  GitMerge,
  Lock,
  MonitorSmartphone,
  Network,
  Plug,
  RefreshCcwDot,
  ScrollText,
  Shield,
} from 'lucide-react'

import llamaSvg from '@/assets/73897352_JEMA LUIS 283-03.svg'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
      <Button size="lg" className="hero-enter hero-enter-4 gap-2" onClick={onEnterApp}>
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
      'The average dev burns 24+ hours a year just logging time. That\u2019s three full workdays sacrificed to a spreadsheet. Let that sink in.',
  },
]

function PainSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="fade-up mb-12 text-center text-4xl font-bold">The timesheet struggle is real</h2>
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
      'You map activities to Jira issues with AI suggestions powered by Anthropic. You stay in control, the llama just makes it faster.',
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
            <div
              key={step.title}
              className="fade-up flex items-start gap-4 sm:flex-col sm:items-center sm:text-center"
            >
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

const ROADMAP = [
  {
    icon: Download,
    title: 'Export Reports',
    description: 'CSV & JSON export to sync with target systems manually.',
  },
  {
    icon: Lock,
    title: 'Secret Gating',
    description: 'PIN/password + crypto protection for long-lived API keys.',
  },
  {
    icon: Network,
    title: 'More Sources',
    description: 'GitHub, GitLab (multi-connection), Slack, Notion.',
  },
  {
    icon: Plug,
    title: 'Custom Input Integrations',
    description: 'Google Sheets, Chrome Extension, Slack, Telegram.',
  },
  {
    icon: ScrollText,
    title: 'Custom Reports',
    description: 'Create, export, and share reports with a visual builder.',
  },
  {
    icon: Bot,
    title: 'AI-powered Tasks',
    description: 'Intelligent task forming, editing, and analysis.',
  },
  {
    icon: RefreshCcwDot,
    title: 'Audit Log',
    description: 'Full traceability for API data loads and Jira worklog syncs.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Sync & Mobile',
    description: 'Cross-device sync. Looks great on mobile.',
  },
]

function WhatsNextSection() {
  return (
    <section className="relative overflow-hidden px-6 py-32">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent" />
      <div className="relative mx-auto max-w-6xl">
        <div className="fade-up mb-6 text-center">
          <span className="inline-block rounded-full border border-primary/30 bg-primary/20 px-5 py-2 text-sm font-bold tracking-wide text-primary uppercase">
            Roadmap
          </span>
        </div>
        <h2 className="fade-up mb-5 text-center text-5xl font-bold sm:text-6xl">
          What&apos;s Next?
        </h2>
        <p className="fade-up mx-auto mb-16 max-w-xl text-center text-lg text-muted-foreground">
          The llama is just getting started. Here&apos;s what&apos;s cooking.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ROADMAP.map((item) => (
            <div
              key={item.title}
              className="fade-up group rounded-3xl border border-primary/15 bg-background/60 p-7 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-primary/10 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20 transition-all group-hover:from-primary/30 group-hover:to-primary/10 group-hover:ring-primary/40">
                <item.icon className="size-7 text-primary" />
              </div>
              <h3 className="mb-2 text-base font-bold">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FooterCTASection({ onEnterApp }: { onEnterApp: () => void }) {
  return (
    <section className="bg-muted/30 px-6 py-24">
      <div className="fade-up mx-auto max-w-2xl text-center">
        <h2 className="mb-6 text-4xl font-bold">Stop the drama. Let the llama handle it.</h2>
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

export function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  const revealRef = useScrollReveal()

  return (
    <div ref={revealRef} className="bg-background text-foreground">
      <HeroSection onEnterApp={onEnterApp} />
      <PainSection />
      <HowItWorksSection />
      <FeaturesSection />
      <WhatsNextSection />
      <FooterCTASection onEnterApp={onEnterApp} />
    </div>
  )
}

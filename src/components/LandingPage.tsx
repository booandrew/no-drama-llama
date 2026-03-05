import {
  ArrowRight,
  BarChart3,
  Brain,
  BrainCircuit,
  Calendar,
  CalendarX,
  CheckCircle,
  Clock,
  GanttChart,
  GitMerge,
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

export function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  const revealRef = useScrollReveal()

  return (
    <div ref={revealRef} className="bg-background text-foreground">
      <HeroSection onEnterApp={onEnterApp} />
      <PainSection />
      <HowItWorksSection />
      <FeaturesSection />
      <FooterCTASection onEnterApp={onEnterApp} />
    </div>
  )
}

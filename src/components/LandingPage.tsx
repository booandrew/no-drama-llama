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

export function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  const revealRef = useScrollReveal()

  return (
    <div ref={revealRef} className="bg-background text-foreground">
      <HeroSection onEnterApp={onEnterApp} />
    </div>
  )
}

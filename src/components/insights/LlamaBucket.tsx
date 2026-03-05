import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import llamaSvgUrl from '@/assets/73897352_JEMA LUIS 283-03.svg'

const LLAMA_COUNT = 30
const LLAMA_SIZE = 64

interface LlamaBody {
  id: number
  x: number
  y: number
  angle: number
}

export function LlamaBucket() {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Matter.Engine | null>(null)
  const bodiesRef = useRef<Matter.Body[]>([])
  const rafRef = useRef<number>(0)
  const [llamas, setLlamas] = useState<LlamaBody[]>([])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.5 } })
    engineRef.current = engine

    // Walls: floor + left + right
    const wallThickness = 20
    const walls = [
      Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, {
        isStatic: true,
      }),
      Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height, {
        isStatic: true,
      }),
      Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height, {
        isStatic: true,
      }),
    ]
    Matter.Composite.add(engine.world, walls)

    // Spawn llamas with staggered timing
    const bodies: Matter.Body[] = []
    for (let i = 0; i < LLAMA_COUNT; i++) {
      const x = 40 + Math.random() * (width - 80)
      const y = -LLAMA_SIZE - i * 60
      const body = Matter.Bodies.rectangle(x, y, LLAMA_SIZE * 0.7, LLAMA_SIZE * 0.8, {
        restitution: 0.3,
        friction: 0.5,
        angle: (Math.random() - 0.5) * 1.2,
        chamfer: { radius: 8 },
      })
      bodies.push(body)
    }
    Matter.Composite.add(engine.world, bodies)
    bodiesRef.current = bodies

    // Animation loop
    const update = () => {
      Matter.Engine.update(engine, 1000 / 60)
      setLlamas(
        bodies.map((b) => ({
          id: b.id,
          x: b.position.x,
          y: b.position.y,
          angle: b.angle,
        })),
      )
      rafRef.current = requestAnimationFrame(update)
    }
    rafRef.current = requestAnimationFrame(update)

    return () => {
      cancelAnimationFrame(rafRef.current)
      Matter.Engine.clear(engine)
    }
  }, [])

  return (
    <Card className="flex min-h-0 flex-1 flex-col gap-0 py-0">
      <CardHeader className="shrink-0 px-4 py-3">
        <CardTitle>My herd of LLamas</CardTitle>
        <CardDescription>You have collected {llamas.length} llamas to your herd</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-0 pb-0">
        <div
          ref={containerRef}
          className="relative h-full w-full overflow-hidden rounded-b-xl bg-muted/30"
        >
          {llamas.map((llama) => (
            <img
              key={llama.id}
              src={llamaSvgUrl}
              alt=""
              className="pointer-events-none absolute"
              style={{
                width: LLAMA_SIZE,
                height: LLAMA_SIZE,
                left: llama.x - LLAMA_SIZE / 2,
                top: llama.y - LLAMA_SIZE / 2,
                transform: `rotate(${llama.angle}rad)`,
                willChange: 'transform',
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

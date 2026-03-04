import { useMemo } from 'react'

function App() {
  const llamas = useMemo(() =>
    Array.from({ length: 600 }, (_, i) => ({
      id: i,
      size: 1 + Math.random() * 4,
      x: Math.random() * 100,
      y: Math.random() * 100,
      rotation: Math.random() * 360,
      opacity: 0.3 + Math.random() * 0.7,
    })), []
  )

  return (
    <div className="fixed inset-0 overflow-hidden bg-amber-50">
{llamas.map((l) => (
        <span
          key={l.id}
          className="absolute select-none"
          style={{
            fontSize: `${l.size}rem`,
            left: `${l.x}%`,
            top: `${l.y}%`,
            transform: `rotate(${l.rotation}deg)`,
            opacity: l.opacity,
          }}
        >
          🦙
        </span>
      ))}
    </div>
  )
}

export default App

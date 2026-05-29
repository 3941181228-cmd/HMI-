import { useMemo } from 'react'

interface Particle {
  id: number
  left: string
  top: string
  size: number
  duration: number
  delay: number
  opacity: number
}

export default function AmbientParticles() {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 2 + 0.5,
      duration: Math.random() * 8 + 6,
      delay: Math.random() * 5,
      opacity: Math.random() * 0.12 + 0.02,
    }))
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-primary/30"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            animation: `float-up ${p.duration}s ${p.delay}s ease-in-out infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes float-up {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0; }
          20% { opacity: 1; }
          50% { transform: translateY(-60px) scale(1.3); opacity: 0.6; }
          80% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
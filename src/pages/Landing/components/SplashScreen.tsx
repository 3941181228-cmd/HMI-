import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Hexagon } from 'lucide-react'

interface SplashScreenProps {
  onComplete: () => void
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'initial' | 'logo' | 'fadeout'>('initial')

  useEffect(() => {
    // Phase 1: Initial black screen
    const timer1 = setTimeout(() => setPhase('logo'), 100)
    
    // Phase 2: Logo animation
    const timer2 = setTimeout(() => setPhase('fadeout'), 2500)
    
    // Phase 3: Fade out
    const timer3 = setTimeout(() => onComplete(), 3200)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [onComplete])

  return (
    <AnimatePresence>
      {phase !== 'fadeout' && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] bg-background flex items-center justify-center"
        >
          {/* Subtle background gradient */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ 
              opacity: phase === 'logo' ? 1 : 0,
              scale: phase === 'logo' ? 1 : 0.9
            }}
            transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-secondary/[0.02]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.015] blur-[120px]" />
          </motion.div>

          {/* Logo container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 16 }}
            animate={{ 
              opacity: phase === 'logo' ? 1 : 0,
              scale: phase === 'logo' ? 1 : 0.85,
              y: phase === 'logo' ? 0 : 16
            }}
            transition={{ 
              opacity: { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.5 },
              scale: { duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.5 },
              y: { duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.5 }
            }}
            className="relative flex flex-col items-center gap-6"
          >
            {/* Logo icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.7 }}
              className="relative"
            >
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="w-14 h-14 rounded-xl bg-primary/8 flex items-center justify-center border border-primary/[0.08]">
                  <Hexagon className="w-7 h-7 text-primary" />
                </div>
              </motion.div>
              {/* Subtle glow */}
              <motion.div
                initial={{ opacity: 0, scale: 1.2 }}
                animate={{ opacity: [0, 0.3, 0], scale: [1.2, 1.6, 2] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 1 }}
                className="absolute inset-0 rounded-xl bg-primary/10 blur-xl"
              />
            </motion.div>

            {/* Logo text */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 1 }}
              className="flex flex-col items-center"
            >
              <span className="text-xl font-light text-foreground tracking-[0.3em]">
                HMI AGENT
              </span>
              <span className="text-[10px] text-muted-foreground/60 tracking-[0.25em] uppercase mt-1">
                Studio
              </span>
            </motion.div>

            {/* Progress indicator */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 1.5, ease: 'linear', delay: 1 }}
              className="w-24 h-px bg-primary/20"
            />
          </motion.div>

          {/* Bottom text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 'logo' ? 0.4 : 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 1.2 }}
            className="absolute bottom-16 text-[10px] text-muted-foreground tracking-wider"
          >
            AI POWERED HMI DESIGN PLATFORM
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LandingNav from './components/LandingNav'
import HeroSection from './components/HeroSection'
import WorkflowSection from './components/WorkflowSection'
import FeatureCards from './components/FeatureCards'
import DemoSection from './components/DemoSection'
import VariantShowcase from './components/VariantShowcase'
import FooterCTA from './components/FooterCTA'
import AmbientParticles from './components/AmbientParticles'
import SplashScreen from './components/SplashScreen'

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [hasAnimated, setHasAnimated] = useState(false)

  // Only show splash on initial load
  useEffect(() => {
    const visited = localStorage.getItem('hmi-studio-visited')
    if (visited) {
      setShowSplash(false)
    } else {
      localStorage.setItem('hmi-studio-visited', 'true')
    }
  }, [])

  const handleScroll = () => {
    if (containerRef.current) {
      setScrolled(containerRef.current.scrollTop > 50)
    }
  }

  const handleSplashComplete = () => {
    setShowSplash(false)
    setHasAnimated(true)
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      {/* Splash Screen */}
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      </AnimatePresence>

      {/* Main content */}
      <motion.div
        initial={hasAnimated ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        ref={containerRef}
        onScroll={handleScroll}
        className="h-screen w-screen overflow-y-auto overflow-x-hidden bg-background"
      >
        <AmbientParticles />
        <LandingNav scrolled={scrolled} />
        <HeroSection />
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, hsl(var(--border)/0.3), transparent)' }} />
        </div>
        <WorkflowSection />
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, hsl(var(--border)/0.3), transparent)' }} />
        </div>
        <FeatureCards />
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, hsl(var(--border)/0.3), transparent)' }} />
        </div>
        <DemoSection />
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, hsl(var(--border)/0.3), transparent)' }} />
        </div>
        <VariantShowcase />
        <FooterCTA />
      </motion.div>
    </div>
  )
}

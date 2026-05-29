import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Play } from 'lucide-react'
import DotGlobe from '../../../components/DotGlobe'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
}

const visualVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 },
  },
}

export default function HeroSection() {
  const navigate = useNavigate()

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] rounded-full bg-primary/[0.03] blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-glow-subtle/[0.04] blur-[100px]" />
        <div className="absolute top-1/2 left-0 w-[300px] h-[600px] rounded-full bg-secondary/[0.03] blur-[80px]" />
      </div>

      {/* 3D Globe background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-80">
        <div className="w-full max-w-[800px] aspect-square">
          <DotGlobe subtle />
        </div>
      </div>

      {/* Dark overlay to subdue globe */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(5,5,5,0.35) 100%)',
        }}
      />

      <div className="relative max-w-[1200px] mx-auto px-8 pt-28 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left: Text content */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-6"
        >
          <motion.div variants={itemVariants}>
            <span className="inline-block px-3 py-1.5 text-[11px] font-medium rounded-full bg-primary/8 text-primary/70 border border-primary/10 tracking-wide uppercase">
              AI 智能座舱平台
            </span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-gradient leading-[1.05] tracking-[-0.03em] font-light"
            style={{ fontSize: 'clamp(2.8rem, 5.5vw, 4rem)' }}
          >
            HMI Agent
            <br />
            Studio
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-foreground/80 text-lg font-light leading-relaxed"
          >
            AI 智能生成未来座舱 HMI 界面
          </motion.p>

          <motion.p
            variants={itemVariants}
            className="text-muted-foreground text-sm leading-relaxed max-w-[420px]"
          >
            基于 AI Agent 与即梦生成引擎，自动生成高质量新能源智能座舱 HMI 页面。
            支持 Charging UI · Navigation UI · Dashboard UI · ADAS UI
          </motion.p>

          <motion.div variants={itemVariants} className="flex items-center gap-4 mt-3">
            <button
              onClick={() => navigate('/workspace?from=home')}
              className="group flex items-center gap-2.5 px-7 py-3.5 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:shadow-glow transition-all duration-300"
            >
              开始生成
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </button>
            <a
              href="#demo"
              className="group flex items-center gap-2 px-5 py-3.5 text-sm font-medium rounded-xl text-muted-foreground hover:text-foreground border border-border/50 hover:border-border transition-all duration-200"
            >
              <Play className="w-3.5 h-3.5" />
              查看演示
            </a>
          </motion.div>
        </motion.div>

        {/* Right: Floating HMI Visual */}
        <motion.div
          variants={visualVariants}
          initial="hidden"
          animate="visible"
          className="hidden lg:flex items-center justify-center"
        >
          <div className="relative animate-float">
            {/* Main dashboard card */}
            <div className="w-[440px] h-[300px] rounded-2xl glass glow-primary-sm p-7 relative overflow-hidden">
              {/* Simulated HMI Dashboard - EV Charging UI */}
              <div className="flex flex-col h-full justify-between">
                {/* Top: Status bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400/70" />
                    <span className="text-[10px] text-muted-foreground">充电中</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60">HMI Pro</span>
                </div>

                {/* Center: Battery / Speed */}
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <div className="text-5xl font-extralight text-foreground tracking-tight">78</div>
                    <div className="text-[10px] text-primary/60 mt-1 tracking-wide">%</div>
                  </div>
                  <div className="w-px h-12 bg-border/40" />
                  <div className="text-center">
                    <div className="text-2xl font-extralight text-muted-foreground">326</div>
                    <div className="text-[10px] text-muted-foreground/50 mt-1">km</div>
                  </div>
                </div>

                {/* Bottom: Energy flow bar */}
                <div className="space-y-2">
                  <div className="w-full h-1 rounded-full bg-surface-tertiary overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary/40 via-primary to-primary/40"
                      animate={{ width: ['60%', '78%', '60%'] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground/40">能量流</span>
                    <span className="text-[9px] text-primary/40">42 kW</span>
                  </div>
                </div>
              </div>

              {/* Subtle glow border */}
              <div className="absolute inset-0 rounded-2xl pointer-events-none border border-primary/[0.06]" />
            </div>

            {/* Floating accent cards */}
            <div className="absolute -top-5 -right-5 w-24 h-16 rounded-xl glass-subtle p-3 animate-float" style={{ animationDelay: '1.5s' }}>
              <div className="text-[9px] text-muted-foreground/60">ADAS</div>
              <div className="mt-1 w-8 h-0.5 rounded-full bg-primary/30" />
            </div>
            <div className="absolute -bottom-4 -left-4 w-20 h-14 rounded-xl bg-primary/[0.04] border border-primary/[0.08] p-2.5 animate-float" style={{ animationDelay: '2.5s' }}>
              <div className="text-[9px] text-primary/50">Nav</div>
              <div className="mt-1 w-6 h-0.5 rounded-full bg-primary/20" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

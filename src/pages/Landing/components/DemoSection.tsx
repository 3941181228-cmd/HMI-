import { motion, useInView } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

const agentConfig = [
  { label: '风格', value: '极简' },
  { label: '场景', value: '充电界面' },
  { label: '主题', value: '深色模式' },
  { label: '组件', value: '3D 车辆 · 能量流' },
]

const generatedPrompt =
  'Design a premium dark-mode EV charging interface, featuring a 3D car model with animated energy flow, minimal glass UI components, soft violet-blue glow accents, real-time battery percentage display...'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.2 } },
}

const panelVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
}

type Phase = 'idle' | 'analyzing' | 'prompting' | 'generating' | 'done'

export default function DemoSection() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.25 })
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('idle')
  const [typedPrompt, setTypedPrompt] = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isInView) return

    // Phase 1: Agent analyzing
    const t1 = setTimeout(() => setPhase('analyzing'), 600)

    // Phase 2: Prompt generating (typing)
    const t2 = setTimeout(() => setPhase('prompting'), 2000)

    // Phase 3: AI generating
    const t3 = setTimeout(() => setPhase('generating'), 5500)

    // Phase 4: Done
    const t4 = setTimeout(() => setPhase('done'), 8500)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [isInView])

  // Typing effect for prompt
  useEffect(() => {
    if (phase !== 'prompting') return
    let i = 0
    const interval = setInterval(() => {
      if (i < generatedPrompt.length) {
        setTypedPrompt(generatedPrompt.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
      }
    }, 25)
    return () => clearInterval(interval)
  }, [phase])

  // Progress bar during generating
  useEffect(() => {
    if (phase !== 'generating') return
    let p = 0
    const interval = setInterval(() => {
      p += 1
      setProgress(p)
      if (p >= 100) clearInterval(interval)
    }, 28)
    return () => clearInterval(interval)
  }, [phase])

  return (
    <section id="demo" className="relative py-32">
      {/* Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-primary/[0.02] blur-[120px] pointer-events-none" />

      <div className="max-w-[1200px] mx-auto px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <p className="text-[11px] text-primary/60 uppercase tracking-widest mb-3">Live Demo</p>
          <h2 className="text-3xl font-light text-foreground tracking-tight mb-4">
            AI 实时生成演示
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            从需求输入到 HMI 界面生成，全流程自动化
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Left: Prompt Agent */}
          <motion.div variants={panelVariants} className="rounded-2xl glass p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary/60" />
                <span className="text-xs text-muted-foreground font-medium">Prompt Agent</span>
              </div>
              <span className="text-[10px] text-muted-foreground/50">
                {phase === 'idle' ? '就绪' : phase === 'analyzing' ? '分析中...' : phase === 'prompting' ? '生成提示词...' : '完成'}
              </span>
            </div>

            {/* Agent config tags */}
            <div className="flex flex-wrap gap-2 mb-5">
              {agentConfig.map((item) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: phase !== 'idle' ? 1 : 0.4 }}
                  transition={{ duration: 0.5 }}
                  className="px-3 py-1.5 rounded-lg bg-surface-secondary/80 border border-border/40"
                >
                  <span className="text-[10px] text-muted-foreground/60">{item.label}</span>
                  <span className="text-[11px] text-foreground/80 ml-1.5">{item.value}</span>
                </motion.div>
              ))}
            </div>

            {/* Generated prompt area */}
            <div className="min-h-[140px] rounded-xl bg-surface-secondary/40 border border-border/30 p-4">
              {phase === 'idle' && (
                <span className="text-xs text-muted-foreground/40">等待 Agent 分析...</span>
              )}
              {phase === 'analyzing' && (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
                  <span className="text-xs text-primary/60">AI Agent 正在分析需求...</span>
                </div>
              )}
              {(phase === 'prompting' || phase === 'generating' || phase === 'done') && (
                <p className="text-[12px] text-foreground/70 leading-relaxed font-mono">
                  {phase === 'prompting' ? typedPrompt : generatedPrompt}
                  {phase === 'prompting' && typedPrompt.length < generatedPrompt.length && (
                    <span className="inline-block w-px h-3 bg-primary/70 ml-0.5 animate-pulse" />
                  )}
                </p>
              )}
            </div>
          </motion.div>

          {/* Right: HMI Generation */}
          <motion.div variants={panelVariants} className="rounded-2xl glass p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${phase === 'done' ? 'bg-emerald-400/70' : 'bg-amber-400/60'}`} />
                <span className="text-xs text-muted-foreground font-medium">HMI Output</span>
              </div>
              <span className="text-[10px] text-muted-foreground/50">
                {phase === 'generating' ? `${progress}%` : phase === 'done' ? 'Generated' : 'Waiting'}
              </span>
            </div>

            <div className="min-h-[200px] rounded-xl bg-surface-secondary/40 border border-border/30 p-4 flex items-center justify-center relative overflow-hidden">
              {(phase === 'idle' || phase === 'analyzing' || phase === 'prompting') && (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-surface-tertiary/50 border border-border/30" />
                  <span className="text-[10px] text-muted-foreground/40">等待生成...</span>
                </div>
              )}

              {phase === 'generating' && (
                <div className="w-full flex flex-col items-center gap-4">
                  {/* Scan line effect */}
                  <div className="w-full h-[120px] rounded-lg bg-surface-tertiary/30 border border-border/20 relative overflow-hidden">
                    <motion.div
                      className="absolute left-0 right-0 h-px bg-primary/40"
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] text-primary/40 font-mono">AI 正在构建智能座舱界面...</span>
                    </div>
                  </div>
                  <div className="w-full h-1 rounded-full bg-surface-tertiary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary/30 via-primary to-primary/30 animate-shimmer relative"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-line" />
                    </div>
                  </div>
                </div>
              )}

              {phase === 'done' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full h-[160px] rounded-lg bg-gradient-to-br from-primary/[0.06] via-surface to-glow-subtle/[0.08] border border-primary/[0.12] backdrop-blur-sm p-5 flex flex-col justify-between"
                >
                  {/* Mini Charging UI result */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
                      <span className="text-[9px] text-muted-foreground/60">Charging</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground/40">HMI</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl font-extralight text-foreground">92%</div>
                      <div className="text-[9px] text-primary/50 mt-1">充电中 · 45 kW</div>
                    </div>
                  </div>
                  <div className="w-full h-0.5 rounded-full bg-surface-tertiary overflow-hidden">
                    <div className="w-[92%] h-full rounded-full bg-primary/40" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Action button */}
            {phase === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="mt-4 flex justify-end"
              >
                <button
                  onClick={() => navigate('/')}
                  className="group flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-primary/10 text-primary/70 hover:bg-primary/20 transition-colors"
                >
                  进入工作台
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const variants = [
  {
    label: '方案 A',
    style: '极简科技',
    gradient: 'from-violet-600/20 via-indigo-900/15 to-slate-900/30',
    accent: 'bg-violet-400',
    speed: '120',
    detail: '极简 · 玻璃质感',
  },
  {
    label: '方案 B',
    style: '运动激进',
    gradient: 'from-red-600/15 via-rose-900/15 to-zinc-900/30',
    accent: 'bg-red-400',
    speed: '186',
    detail: '运动 · 粗犷',
  },
  {
    label: '方案 C',
    style: '豪华静谧',
    gradient: 'from-amber-600/12 via-yellow-900/10 to-neutral-900/30',
    accent: 'bg-amber-400',
    speed: '92',
    detail: '豪华 · 沉静',
  },
  {
    label: '方案 D',
    style: '未来概念',
    gradient: 'from-cyan-600/15 via-teal-900/15 to-slate-900/30',
    accent: 'bg-cyan-400',
    speed: '208',
    detail: '概念 · 未来',
  },
]

export default function VariantShowcase() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })
  const navigate = useNavigate()

  return (
    <section id="showcase" className="relative py-32 overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-8 mb-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <p className="text-[11px] text-primary/60 uppercase tracking-widest mb-3">Showcase</p>
          <h2 className="text-3xl font-light text-foreground tracking-tight mb-4">
            Multi Variant 输出
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            一次生成多个设计方向，点击即可进入 HMI Workspace
          </p>
        </motion.div>
      </div>

      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        className="max-w-[1200px] mx-auto px-8"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {variants.map((variant, i) => (
            <motion.div
              key={variant.label}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.25 + i * 0.1,
              }}
            >
              <div
                onClick={() => navigate('/')}
                className="rounded-2xl glass overflow-hidden group cursor-pointer hover:shadow-glow-sm transition-all duration-500 hover:-translate-y-1 border border-white/[0.04] hover:border-primary/15 relative"
              >
                {/* Inner glow overlay */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-20" style={{ background: 'radial-gradient(ellipse at center, hsl(var(--primary)/0.04) 0%, transparent 70%)' }} />
                {/* Preview area */}
                <div className={`h-[160px] bg-gradient-to-br ${variant.gradient} relative overflow-hidden`}>
                  {/* Hover blur reduce effect */}
                  <div className="absolute inset-0 backdrop-blur-[2px] group-hover:backdrop-blur-0 transition-all duration-500" />

                  {/* Mini HMI mockup */}
                  <div className="absolute inset-5 z-10 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-2xl font-extralight text-white/80">{variant.speed}</div>
                        <div className="text-[9px] text-white/40 mt-0.5">km/h</div>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full ${variant.accent} opacity-50 group-hover:opacity-80 transition-opacity`} />
                    </div>
                    <div className="space-y-1.5">
                      <div className="w-full h-px bg-white/[0.08]" />
                      <div className="flex gap-1.5">
                        <div className="w-8 h-1 rounded-full bg-white/10" />
                        <div className="w-5 h-1 rounded-full bg-white/10" />
                        <div className="w-6 h-1 rounded-full bg-white/10" />
                      </div>
                    </div>
                  </div>

                  {/* Glow on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-t from-transparent to-white/[0.02]" />
                </div>

                {/* Card info */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground/80">{variant.label}</span>
                    <span className="text-[10px] text-primary/50">{variant.detail}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{variant.style}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}

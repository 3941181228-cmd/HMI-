import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Hexagon } from 'lucide-react'

export default function FooterCTA() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.3 })
  const navigate = useNavigate()

  return (
    <section className="relative py-32">
      {/* Background glow */}
      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-primary/[0.04] blur-[140px] pointer-events-none" />

      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-[1200px] mx-auto px-8 flex flex-col items-center text-center"
      >
        <h2 className="text-3xl font-light text-foreground tracking-tight mb-4">
          开始构建未来座舱
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm mb-8">
          AI Agent + 即梦引擎，从需求到 HMI 方案全自动化
        </p>

        <button
          onClick={() => navigate('/workspace?from=home')}
          className="group flex items-center gap-2.5 px-8 py-3.5 text-sm font-medium rounded-xl bg-primary/90 text-primary-foreground hover:bg-primary hover:shadow-glow transition-all duration-300"
        >
          开始生成
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </motion.div>

      {/* Footer */}
      <div className="max-w-[1200px] mx-auto px-8 mt-28 pt-8 border-t border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hexagon className="w-3.5 h-3.5 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground/50">
              HMI Agent Studio
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground/40">
            AI 驱动的智能座舱设计平台
          </span>
        </div>
      </div>
    </section>
  )
}

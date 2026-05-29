import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { MessageSquare, Sparkles, Palette, Download } from 'lucide-react'

const steps = [
  {
    icon: MessageSquare,
    title: '描述需求',
    description: '输入 HMI 设计需求，AI 自动解析场景与风格',
  },
  {
    icon: Sparkles,
    title: 'AI 生成',
    description: '即梦引擎生成专业级 HMI 界面',
  },
  {
    icon: Palette,
    title: '风格调整',
    description: '选择品牌风格，调整配色与布局',
  },
  {
    icon: Download,
    title: '资源导出',
    description: '导出设计资源，直接交付开发',
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
}

export default function WorkflowSection() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })

  return (
    <section id="workflow" className="relative py-32">
      {/* Subtle background accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/[0.02] blur-[100px] pointer-events-none" />

      <div className="max-w-[1200px] mx-auto px-8">
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="flex flex-col items-center"
        >
          <motion.div variants={itemVariants} className="text-center mb-20">
            <p className="text-[11px] text-primary/60 uppercase tracking-widest mb-3">Workflow</p>
            <h2 className="text-3xl font-light text-foreground tracking-tight mb-4">
              AI HMI 工作流
            </h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
              这不是 AI 绘图，而是 AI 驱动的智能座舱设计工作流
            </p>
          </motion.div>

          {/* Workflow steps - vertical timeline */}
          <div className="relative w-full max-w-[700px]">
            {/* Central vertical line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent" />

            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                variants={itemVariants}
                className="relative flex items-start gap-6 mb-12 last:mb-0"
              >
                {/* Step indicator */}
                <div className="relative z-10 flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-surface-secondary border border-border/60 flex items-center justify-center relative">
                    <div className="absolute inset-0 rounded-xl bg-primary/[0.03] blur-md" />
                    <step.icon className="w-5 h-5 text-primary/60 relative z-10" />
                  </div>
                  {/* Connector dot */}
                  {i < steps.length - 1 && (
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-border/60" />
                  )}
                </div>

                {/* Step content */}
                <div className="pt-2">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-[10px] text-primary/40 font-medium tracking-wide">
                      STEP 0{i + 1}
                    </span>
                  </div>
                  <h3 className="text-base font-medium text-foreground mb-1.5">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

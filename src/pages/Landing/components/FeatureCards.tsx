import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Brain, Zap, Copy } from 'lucide-react'

const features = [
  {
    icon: Sparkles,
    title: 'AI生成HMI',
    description: '直接生成可编辑的 Figma 原生 HMI 页面，覆盖仪表盘、充电、导航、ADAS 等场景',
  },
  {
    icon: Brain,
    title: '提示词引擎',
    description: '智能需求分析引擎，自动将设计意图转化为高质量生成 Prompt',
  },
  {
    icon: Zap,
    title: '原生图层引擎',
    description: '输出 Frame、文字、组件与颜色样式，不再经过 PNG 转 SVG 的中间流程',
  },
  {
    icon: Copy,
    title: 'Figma MCP 直写',
    description: '填写 Figma 文件链接，由 Codex 通过官方 MCP 写入可编辑原生图层，无需自制插件',
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
}

export default function FeatureCards() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })
  const navigate = useNavigate()

  return (
    <section id="features" className="relative py-32">
      <div className="max-w-[1200px] mx-auto px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <p className="text-[11px] text-primary/60 uppercase tracking-widest mb-3">Features</p>
          <h2 className="text-3xl font-light text-foreground tracking-tight mb-4">
            核心能力
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            为新能源智能座舱 HMI 设计量身打造的 AI 工具链
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={cardVariants}
              onClick={() => navigate('/')}
              className="group relative rounded-2xl glass border-glow p-7 cursor-pointer transition-all duration-500 hover:shadow-glow-sm hover:-translate-y-1 hover:border-primary/15"
            >
              <div className="flex flex-col gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/8 border border-primary/10 flex items-center justify-center group-hover:bg-primary/12 group-hover:border-primary/20 transition-all duration-500">
                  <feature.icon className="w-5 h-5 text-primary/60 group-hover:text-primary/80 transition-all duration-500 group-hover:scale-110" />
                </div>
                <div>
                  <h3 className="text-base font-medium text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

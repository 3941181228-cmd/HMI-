import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import DotGlobe from '../../../components/DotGlobe'

const textContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.18 } },
}

const textItemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1, ease: [0.215, 0.61, 0.355, 1] },
  },
}

const globeVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 1, ease: [0.215, 0.61, 0.355, 1], delay: 0.15 },
  },
}

export default function AboutSection() {
  const textRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<HTMLDivElement>(null)

  const textInView = useInView(textRef, { amount: 0.3, once: true })
  const globeInView = useInView(globeRef, { amount: 0.2, once: true })

  return (
    <section className="relative flex flex-col items-center overflow-hidden" style={{ minHeight: '100vh' }}>
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, #050505 0%, #0A0A0A 40%, #101114 100%)',
        }}
      />

      {/* Ambient light orbs */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-[radial-gradient(ellipse, rgba(120,120,200,0.04)_0%, transparent_70%)] blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] rounded-full bg-[radial-gradient(ellipse, rgba(100,100,150,0.03)_0%, transparent_70%)] blur-[80px] pointer-events-none" />

      {/* Text Content */}
      <motion.div
        ref={textRef}
        variants={textContainerVariants}
        initial="hidden"
        animate={textInView ? "visible" : "hidden"}
        className="relative max-w-[1200px] mx-auto w-full flex flex-col items-center text-center pt-[180px] pb-[80px] px-8"
      >
        <motion.h2
          variants={textItemVariants}
          className="text-[48px] font-medium leading-[1.08] tracking-[-0.02em] max-w-[800px]"
          style={{
            background: 'linear-gradient(180deg, #FFFFFF 0%, #5F5F5F 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          驱动全球智能座舱生态
        </motion.h2>

        <motion.p
          variants={textItemVariants}
          className="mt-9 text-[24px] leading-[1.6] max-w-[455px]"
          style={{ color: 'rgba(255,255,255,0.58)' }}
        >
          基于 AI Agent 技术，以车规级精度与极简克制美学，加速全球 HMI 设计智能化。
        </motion.p>

        <motion.div variants={textItemVariants} className="mt-10">
          <a
            href="/workspace"
            className="inline-flex items-center gap-2 px-9 py-4 text-base font-medium rounded-full transition-all duration-300 hover:scale-[1.02]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#FFFFFF',
            }}
          >
            开始生成
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 12L10 8L6 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </motion.div>
      </motion.div>

      {/* Globe Area */}
      <motion.div
        ref={globeRef}
        variants={globeVariants}
        initial="hidden"
        animate={globeInView ? "visible" : "hidden"}
        className="relative w-full max-w-[1200px] mx-auto h-[800px]"
        style={{ marginTop: '2rem' }}
      >
        <DotGlobe />
      </motion.div>

      {/* Bottom fade mask */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[180px] pointer-events-none"
        style={{
          background: 'linear-gradient(0deg, #101114 0%, transparent 100%)',
        }}
      />
    </section>
  )
}
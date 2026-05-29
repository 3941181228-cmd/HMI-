import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wifi,
  Cpu,
  Monitor,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Activity,
} from 'lucide-react'

export default function StatusBar() {
  const [zoom, setZoom] = useState(100)

  return (
    <footer className="h-8 glass-strong border-t border-[hsl(var(--foreground)/0.06)] flex items-center justify-between px-4 shrink-0 text-[11px] text-muted-foreground z-50">
      {/* Left */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="status-dot bg-emerald-400" />
          <Wifi size={10} />
          <span>AI 引擎就绪</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Cpu size={10} />
          <span>GPU 加速</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity size={10} />
          <span>即梦 AI v2.4</span>
        </div>
      </div>

      {/* Center */}
      <div className="flex items-center gap-3">
        <span className="text-[hsl(var(--primary)/0.7)]">HMI 设计模式</span>
        <span>·</span>
        <span>1920×1080</span>
        <span>·</span>
        <span>16:9 车机比例</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(Math.max(50, zoom - 10))}
            className="h-5 w-5 flex items-center justify-center rounded hover:bg-[hsl(var(--foreground)/0.06)] transition-colors"
          >
            <ZoomOut size={10} />
          </button>
          <span className="w-8 text-center">{zoom}%</span>
          <button
            onClick={() => setZoom(Math.min(200, zoom + 10))}
            className="h-5 w-5 flex items-center justify-center rounded hover:bg-[hsl(var(--foreground)/0.06)] transition-colors"
          >
            <ZoomIn size={10} />
          </button>
        </div>
        <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-[hsl(var(--foreground)/0.06)] transition-colors">
          <Maximize2 size={10} />
        </button>
        <div className="flex items-center gap-1.5">
          <Monitor size={10} />
          <span>2.4 GB</span>
        </div>
      </div>
    </footer>
  )
}

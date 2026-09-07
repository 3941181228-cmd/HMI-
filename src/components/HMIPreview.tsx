import { motion } from 'framer-motion'
import {
  Battery,
  BatteryCharging,
  Wifi,
  Signal,
  Bluetooth,
  MapPin,
  Music,
  Play,
  Pause,
  SkipForward,
  Volume2,
  Thermometer,
  Fan,
  Wind,
  ShieldCheck,
  Eye,
  Car,
  Phone,
  Navigation,
  Radio,
  Settings,
  Gauge,
  Zap,
} from 'lucide-react'

export default function HMIPreview() {
  return (
    <div className="w-full aspect-video max-h-[70vh] rounded-2xl overflow-hidden relative noise-overlay"
      style={{
        background: 'linear-gradient(145deg, hsl(var(--background)), hsl(var(--surface)), hsl(var(--surface-secondary)))',
      }}
    >
      <div className="absolute inset-0 z-10 flex flex-col p-4 gap-3">
        {/* Top Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 rounded-xl glass-subtle">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-foreground font-medium">14:32</span>
            <span className="text-muted-foreground">|</span>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Thermometer size={10} />
              <span>26°C</span>
            </div>
            <span className="text-muted-foreground">|</span>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Wifi size={10} />
              <span>5G</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Bluetooth size={10} className="text-primary/70" />
            <Signal size={10} />
            <div className="flex items-center gap-1">
              <Zap size={10} className="text-emerald-400" />
              <span>87%</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 grid grid-cols-[1fr_2fr_1fr] gap-3 min-h-0">
          {/* Left Panel - Battery */}
          <div className="flex flex-col gap-3">
            <motion.div
              className="flex-1 glass rounded-xl p-4 flex flex-col justify-between glow-primary-sm"
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <BatteryCharging size={14} className="text-emerald-400" />
                <span>电池状态</span>
              </div>
              <div className="flex flex-col">
                <span className="text-5xl font-light text-foreground tracking-tight">87</span>
                <span className="text-xs text-muted-foreground mt-1">% 剩余电量</span>
              </div>
              <div className="space-y-2">
                <div className="h-2 rounded-full bg-[hsl(var(--surface-tertiary)/0.6)] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: '87%' }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>预估续航</span>
                  <span className="text-foreground font-medium">423 km</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="glass rounded-xl p-4"
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Gauge size={12} />
                <span>能量回收</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5">
                  {[80, 60, 45, 30, 15].map((h, i) => (
                    <motion.div
                      key={i}
                      className="w-2 rounded-full bg-primary/40"
                      initial={{ height: 0 }}
                      animate={{ height: h }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                    />
                  ))}
                </div>
                <span className="text-lg font-light text-foreground">3级</span>
              </div>
            </motion.div>
          </div>

          {/* Center Panel - Speed */}
          <div className="flex flex-col gap-3">
            <motion.div
              className="flex-1 glass rounded-xl flex flex-col items-center justify-center relative overflow-hidden glow-primary-sm"
              whileHover={{ scale: 1.005 }}
              transition={{ duration: 0.2 }}
            >
              {/* Speed rings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-56 h-56 rounded-full border border-[hsl(var(--foreground)/0.04)]" />
                <div className="absolute w-48 h-48 rounded-full border border-[hsl(var(--foreground)/0.03)]" />
                <div className="absolute w-40 h-40 rounded-full border border-[hsl(var(--primary)/0.08)]" />
              </div>

              <div className="relative z-10 flex flex-col items-center">
                <span className="text-7xl font-extralight text-foreground tracking-tighter">
                  87
                </span>
                <span className="text-xs text-muted-foreground tracking-[0.3em] uppercase mt-1">
                  km/h
                </span>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    D 驾驶
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    ECO
                  </span>
                </div>
              </div>

              {/* Speed ticks */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
                {Array.from({ length: 40 }).map((_, i) => {
                  const angle = (i / 40) * 360 - 90
                  const rad = (angle * Math.PI) / 180
                  const isMajor = i % 5 === 0
                  const innerR = isMajor ? 155 : 162
                  const outerR = 170
                  const x1 = 200 + innerR * Math.cos(rad)
                  const y1 = 200 + innerR * Math.sin(rad)
                  const x2 = 200 + outerR * Math.cos(rad)
                  const y2 = 200 + outerR * Math.sin(rad)
                  const isActive = i <= 14
                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isActive ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.08)'}
                      strokeWidth={isMajor ? 2 : 1}
                      opacity={isActive ? 0.8 : 1}
                    />
                  )
                })}
              </svg>
            </motion.div>
          </div>

          {/* Right Panel - Navigation */}
          <div className="flex flex-col gap-3">
            <motion.div
              className="flex-1 glass rounded-xl p-4 flex flex-col"
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <MapPin size={12} className="text-primary/70" />
                <span>导航</span>
              </div>
              <div className="flex-1 rounded-lg bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--foreground)/0.04)] flex items-center justify-center mb-3 relative overflow-hidden">
                <img
                  src="./images/wallpaper-abstract.png"
                  alt="Navigation map"
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <Navigation size={24} className="text-primary/50" />
                  <span className="text-[10px] text-muted-foreground">导航就绪</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-1 h-1 rounded-full bg-primary" />
                  <span className="text-foreground">前方 2km 右转</span>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>预计到达</span>
                  <span className="text-foreground">15:18</span>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>剩余距离</span>
                  <span className="text-foreground">23.5 km</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="glass rounded-xl p-4"
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck size={12} className="text-emerald-400" />
                  <span>ADAS</span>
                </div>
                <span className="text-[10px] text-emerald-400">全部正常</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: <Eye size={10} />, label: 'LKAS', active: true },
                  { icon: <Car size={10} />, label: 'ACC', active: true },
                  { icon: <ShieldCheck size={10} />, label: 'AEB', active: true },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-1 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10"
                  >
                    <span className="text-emerald-400">{item.icon}</span>
                    <span className="text-[9px] text-emerald-400/80">{item.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-[1fr_1.5fr_1fr] gap-3">
          {/* Climate */}
          <motion.div
            className="glass rounded-xl p-3 flex items-center gap-3"
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center">
                <Fan size={14} className="text-primary" />
              </div>
              <div>
                <div className="text-xs text-foreground font-medium">22°C AUTO</div>
                <div className="text-[10px] text-muted-foreground">空调运行中</div>
              </div>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <Wind size={10} className="text-primary/50" />
              <span className="text-[10px] text-muted-foreground">3级</span>
            </div>
          </motion.div>

          {/* Media Player */}
          <motion.div
            className="glass rounded-xl p-3 flex items-center gap-3"
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.2 }}
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
              <Music size={14} className="text-primary/80" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-foreground font-medium truncate">晴天</div>
              <div className="text-[10px] text-muted-foreground truncate">周杰伦 · 叶惠美</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <SkipForward size={12} className="rotate-180" />
              </button>
              <button className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center text-foreground hover:bg-foreground/20 transition-colors">
                <Pause size={10} />
              </button>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <SkipForward size={12} />
              </button>
            </div>
            <Volume2 size={12} className="text-muted-foreground shrink-0" />
          </motion.div>

          {/* Quick Info */}
          <motion.div
            className="glass rounded-xl p-3 flex items-center gap-3"
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                <Radio size={14} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-xs text-foreground font-medium">FM 98.7</div>
                <div className="text-[10px] text-muted-foreground">音乐频道</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Dock */}
        <div className="flex items-center justify-center gap-2 py-1">
          {[
            { icon: <Phone size={14} />, label: '电话' },
            { icon: <Navigation size={14} />, label: '导航' },
            { icon: <Music size={14} />, label: '媒体', active: true },
            { icon: <Thermometer size={14} />, label: '空调' },
            { icon: <Settings size={14} />, label: '设置' },
          ].map((item) => (
            <button
              key={item.label}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200 ${
                item.active
                  ? 'bg-primary/10 border border-primary/15 text-primary'
                  : 'hover:bg-[hsl(var(--foreground)/0.03)] text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.icon}
              <span className="text-[9px]">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

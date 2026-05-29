import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  FolderOpen,
  Cpu,
  Sparkles,
  Save,
  RefreshCw,
  ChevronDown,
  Check,
  Monitor,
  Image,
  Zap,
  Shield,
} from 'lucide-react'
import { Button } from './ui/button'

export interface WorkspaceSettings {
  exportPath: string
  defaultModel: string
  defaultQuality: string
  autoSave: boolean
  autoSaveInterval: number
  realTimeSync: boolean
}

interface WorkspaceSettingsModalProps {
  open: boolean
  onClose: () => void
  settings: WorkspaceSettings
  onSettingsChange: (settings: WorkspaceSettings) => void
}

const modelOptions = [
  { id: 'seedream-5', name: 'Seedream 5.0', provider: '即梦 AI', icon: '🎨' },
  { id: 'dall-e-3', name: 'DALL·E 3', provider: 'OpenAI', icon: '🤖' },
  { id: 'ark-seedream', name: 'Seedream Ark', provider: '火山方舟', icon: '🌋' },
  { id: 'sd3', name: 'Stable Diffusion 3', provider: 'Stability AI', icon: '🌀' },
]

const qualityOptions = [
  { id: 'draft', name: '草稿', desc: '快速预览，低分辨率', icon: Zap, speed: '1-2s', resolution: '512×512' },
  { id: 'standard', name: '标准', desc: '平衡质量与速度', icon: Monitor, speed: '3-5s', resolution: '1024×1024' },
  { id: 'high', name: '高质量', desc: '精细输出，高分辨率', icon: Sparkles, speed: '8-15s', resolution: '2048×2048' },
  { id: 'ultra', name: '超清', desc: '极致细节，4K 输出', icon: Shield, speed: '15-30s', resolution: '4096×4096' },
]

const intervalOptions = [
  { value: 5, label: '5 秒' },
  { value: 15, label: '15 秒' },
  { value: 30, label: '30 秒' },
  { value: 60, label: '1 分钟' },
  { value: 300, label: '5 分钟' },
]

export default function WorkspaceSettingsModal({ open, onClose, settings, onSettingsChange }: WorkspaceSettingsModalProps) {
  const [local, setLocal] = useState<WorkspaceSettings>(settings)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [qualityExpanded, setQualityExpanded] = useState(local.defaultQuality)
  const [intervalDropdownOpen, setIntervalDropdownOpen] = useState(false)

  useEffect(() => {
    if (open) setLocal(settings)
  }, [open, settings])

  const update = <K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) => {
    setLocal(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    onSettingsChange(local)
    onClose()
  }

  if (!open) return null

  const currentModel = modelOptions.find(m => m.id === local.defaultModel) || modelOptions[0]
  const currentQuality = qualityOptions.find(q => q.id === local.defaultQuality) || qualityOptions[1]
  const currentInterval = intervalOptions.find(i => i.value === local.autoSaveInterval) || intervalOptions[2]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-[520px] max-h-[85vh] overflow-y-auto rounded-2xl"
            style={{
              background: 'hsl(var(--surface) / 0.92)',
              backdropFilter: 'blur(40px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(40px) saturate(1.3)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 32px 100px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.1)',
            }}
          >
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
              <div
                className="absolute -top-1/3 -right-1/4 w-72 h-72 rounded-full opacity-[0.03]"
                style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)' }}
              />
            </div>

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between p-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <FolderOpen size={16} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">工作空间设置</h3>
                    <p className="text-[10px] text-muted-foreground">配置当前工作空间的行为与偏好</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--foreground)/0.06)] transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-6 pb-6 space-y-5">
                {/* Export Path */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                  className="glass rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <FolderOpen size={14} className="text-primary/70" />
                    <span className="text-sm font-medium text-foreground">导出路径</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={local.exportPath}
                      onChange={(e) => update('exportPath', e.target.value)}
                      className="w-full h-10 px-4 pr-20 text-xs bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--border))] rounded-xl text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                      placeholder="~/Desktop/HMI-Exports"
                    />
                    <button
                      onClick={() => update('exportPath', '~/Desktop/HMI-Exports')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2.5 rounded-lg text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      重置
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-2">生成的 HMI 界面与资源将保存到此路径</p>
                </motion.div>

                {/* Default Model */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="glass rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu size={14} className="text-primary/70" />
                    <span className="text-sm font-medium text-foreground">默认模型</span>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--border))] hover:border-[hsl(var(--foreground)/0.12)] transition-all"
                    >
                      <span className="text-base">{currentModel.icon}</span>
                      <div className="flex-1 text-left">
                        <div className="text-xs font-medium text-foreground">{currentModel.name}</div>
                        <div className="text-[10px] text-muted-foreground/60">{currentModel.provider}</div>
                      </div>
                      <motion.span animate={{ rotate: modelDropdownOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown size={14} className="text-muted-foreground" />
                      </motion.span>
                    </button>
                    <AnimatePresence>
                      {modelDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                          className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20"
                          style={{
                            background: 'hsl(var(--surface) / 0.95)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                          }}
                        >
                          {modelOptions.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => {
                                update('defaultModel', model.id)
                                setModelDropdownOpen(false)
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[hsl(var(--foreground)/0.04)] ${
                                local.defaultModel === model.id ? 'bg-primary/[0.06]' : ''
                              }`}
                            >
                              <span className="text-base">{model.icon}</span>
                              <div className="flex-1">
                                <div className="text-xs font-medium text-foreground">{model.name}</div>
                                <div className="text-[10px] text-muted-foreground/60">{model.provider}</div>
                              </div>
                              {local.defaultModel === model.id && <Check size={12} className="text-primary" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-2">AI 生成 HMI 时默认使用的模型</p>
                </motion.div>

                {/* Default Quality */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                  className="glass rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Image size={14} className="text-primary/70" />
                    <span className="text-sm font-medium text-foreground">默认生成质量</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {qualityOptions.map((q) => (
                      <motion.button
                        key={q.id}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          update('defaultQuality', q.id)
                          setQualityExpanded(q.id === qualityExpanded ? '' : q.id)
                        }}
                        className={`relative p-3 rounded-xl text-left transition-all duration-200 ${
                          local.defaultQuality === q.id
                            ? 'bg-primary/[0.08] border border-primary/20'
                            : 'bg-[hsl(var(--surface-secondary)/0.3)] border border-transparent hover:border-[hsl(var(--foreground)/0.08)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <q.icon size={12} className={local.defaultQuality === q.id ? 'text-primary' : 'text-muted-foreground/50'} />
                          <span className={`text-xs font-medium ${local.defaultQuality === q.id ? 'text-primary' : 'text-foreground/80'}`}>
                            {q.name}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground/50">{q.resolution}</div>
                        <div className="text-[9px] text-muted-foreground/30 mt-0.5">{q.speed}</div>
                        {local.defaultQuality === q.id && (
                          <motion.div
                            layoutId="quality-indicator"
                            className="absolute top-2 right-2"
                            transition={{ duration: 0.2 }}
                          >
                            <Check size={10} className="text-primary" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-2">影响生成速度与输出分辨率</p>
                </motion.div>

                {/* Auto Save */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="glass rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Save size={14} className="text-primary/70" />
                      <span className="text-sm font-medium text-foreground">自动保存</span>
                    </div>
                    <button
                      onClick={() => update('autoSave', !local.autoSave)}
                      className={`relative w-10 h-5.5 rounded-full transition-all duration-300 ${
                        local.autoSave ? 'bg-primary/80' : 'bg-[hsl(var(--surface-secondary))]'
                      }`}
                      style={{ width: 40, height: 22 }}
                    >
                      <motion.div
                        animate={{ x: local.autoSave ? 18 : 2 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="absolute top-1 w-4.5 h-4.5 rounded-full bg-white shadow-sm"
                        style={{ width: 18, height: 18, top: 2 }}
                      />
                    </button>
                  </div>

                  <AnimatePresence>
                    {local.autoSave && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="relative mt-2">
                          <button
                            onClick={() => setIntervalDropdownOpen(!intervalDropdownOpen)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--border))] text-xs text-foreground hover:border-[hsl(var(--foreground)/0.12)] transition-all"
                          >
                            <span>保存间隔：{currentInterval.label}</span>
                            <motion.span animate={{ rotate: intervalDropdownOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                              <ChevronDown size={12} className="text-muted-foreground" />
                            </motion.span>
                          </button>
                          <AnimatePresence>
                            {intervalDropdownOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.2 }}
                                className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20"
                                style={{
                                  background: 'hsl(var(--surface) / 0.95)',
                                  backdropFilter: 'blur(20px)',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                                }}
                              >
                                {intervalOptions.map((opt) => (
                                  <button
                                    key={opt.value}
                                    onClick={() => {
                                      update('autoSaveInterval', opt.value)
                                      setIntervalDropdownOpen(false)
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-[hsl(var(--foreground)/0.04)] ${
                                      local.autoSaveInterval === opt.value ? 'text-primary bg-primary/[0.06]' : 'text-foreground'
                                    }`}
                                  >
                                    <span>{opt.label}</span>
                                    {local.autoSaveInterval === opt.value && <Check size={10} className="text-primary" />}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <p className="text-[10px] text-muted-foreground/50 mt-2">
                    {local.autoSave ? `每 ${currentInterval.label} 自动保存工作进度` : '关闭后需手动保存'}
                  </p>
                </motion.div>

                {/* Real-time Sync */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.25 }}
                  className="glass rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw size={14} className="text-primary/70" />
                      <div>
                        <span className="text-sm font-medium text-foreground">实时同步</span>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                          {local.realTimeSync ? '工作进度实时同步至云端' : '关闭后仅在保存时同步'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => update('realTimeSync', !local.realTimeSync)}
                      className={`relative rounded-full transition-all duration-300 ${
                        local.realTimeSync ? 'bg-primary/80' : 'bg-[hsl(var(--surface-secondary))]'
                      }`}
                      style={{ width: 40, height: 22 }}
                    >
                      <motion.div
                        animate={{ x: local.realTimeSync ? 18 : 2 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="absolute top-1 rounded-full bg-white shadow-sm"
                        style={{ width: 18, height: 18, top: 2 }}
                      />
                    </button>
                  </div>
                </motion.div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
                    取消
                  </Button>
                  <Button variant="default" size="sm" onClick={handleSave} className="flex-1 gap-2">
                    <Check size={14} />
                    保存设置
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

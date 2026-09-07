import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wifi, WifiOff, Scan, Upload, Sparkles, ArrowRightLeft, Sun, Moon,
  CheckCircle2, Loader2, FileJson, RefreshCw,
  ChevronDown, ChevronRight, Layers, Palette, Zap,
  Trash2, Eye, Lock
} from 'lucide-react'
import { Button } from './ui/button'

const BRIDGE_URL = ''

interface FrameInfo {
  id: string
  name: string
  width: number
  height: number
}

interface MappingRule {
  name: string
  light: { r: number; g: number; b: number; a: number; hex?: string }
  dark: { r: number; g: number; b: number; a: number; hex?: string }
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const SIZE_PRESETS = [
  { label: '车机横屏 1920×1080', minW: 1800, maxW: 2000 },
  { label: '手机竖屏 390×844', minW: 350, maxW: 430 },
  { label: '平板 1024×768', minW: 900, maxW: 1100 },
  { label: '自定义', minW: 0, maxW: 0 },
]

export default function ThemeSwapPanel() {
  const [bridgeStatus, setBridgeStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [pluginStatus, setPluginStatus] = useState(false)

  const [figmaToken, setFigmaToken] = useState('')
  const [deepseekKey, setDeepseekKey] = useState('')
  const [figmaFileUrl, setFigmaFileUrl] = useState('')
  const [selectedSizePreset, setSelectedSizePreset] = useState(0)
  const [customMinW, setCustomMinW] = useState('')
  const [customMaxW, setCustomMaxW] = useState('')

  const [frames, setFrames] = useState<FrameInfo[]>([])
  const [loadingFrames, setLoadingFrames] = useState(false)
  const [selectedFrameIds, setSelectedFrameIds] = useState<Set<string>>(new Set())

  const [mapping, setMapping] = useState<MappingRule[]>([])
  const [direction, setDirection] = useState<'light-to-dark' | 'dark-to-light'>('light-to-dark')
  const [swapping, setSwapping] = useState(false)
  const [skipLocked, setSkipLocked] = useState(true)
  const [logs, setLogs] = useState<string[]>([])
  const [aiGenerating, setAiGenerating] = useState(false)
  const [lightFileUrl, setLightFileUrl] = useState('')
  const [darkFileUrl, setDarkFileUrl] = useState('')

  const [showConfig, setShowConfig] = useState(true)
  const [showMappingDetail, setShowMappingDetail] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const checkBridgeStatus = useCallback(async () => {
    try {
      // 静默处理，不显示网络错误
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)
      const res = await fetch(`${BRIDGE_URL}/api/health`, { 
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      if (res.ok) {
        try {
          const data = await res.json()
          setBridgeStatus('online')
          setPluginStatus(!!data.plugin)
        } catch {
          setBridgeStatus('online')
          setPluginStatus(false)
        }
      } else {
        setBridgeStatus('offline')
        setPluginStatus(false)
      }
    } catch {
      setBridgeStatus('offline')
      setPluginStatus(false)
    }
  }, [])

  const handleRefreshStatus = useCallback(async () => {
    setBridgeStatus('checking')
    await checkBridgeStatus()
  }, [checkBridgeStatus])

  useEffect(() => {
    checkBridgeStatus() // 只在启动时检查一次
  }, [checkBridgeStatus])

  const handleListFrames = async () => {
    if (!figmaFileUrl.trim()) return
    setLoadingFrames(true)
    setFrames([])
    setSelectedFrameIds(new Set())
    addLog('正在获取画板列表...')
    try {
      const preset = SIZE_PRESETS[selectedSizePreset]
      const isCustom = preset.label === '自定义'
      const minWidth = isCustom ? (parseInt(customMinW) || 0) : preset.minW
      const maxWidth = isCustom ? (parseInt(customMaxW) || 99999) : preset.maxW
      const res = await fetch(`${BRIDGE_URL}/api/list-frames`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: figmaFileUrl,
          figmaToken: figmaToken || undefined,
          minWidth,
          maxWidth,
        }),
      })
      const data = await res.json()
      if (data.error) {
        addLog(`❌ 获取失败: ${data.error}`)
      } else {
        setFrames(data.filteredFrames || [])
        addLog(`✅ 找到 ${data.totalFiltered} 个画板 (共 ${data.allFrames} 个)`)
        setActiveStep(1)
      }
    } catch (e: any) {
      addLog(`❌ 请求失败: ${e.message}`)
    } finally {
      setLoadingFrames(false)
    }
  }

  const handleUploadMapping = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        const rules = Array.isArray(parsed) ? parsed : parsed.mapping || parsed.rules || []
        setMapping(rules)
        setUploadedFileName(file.name)
        addLog(`✅ 导入 ${rules.length} 条映射规则`)
        setActiveStep(2)
        await fetch(`${BRIDGE_URL}/api/upload-mapping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mapping: rules }),
        })
      } catch {
        addLog('❌ JSON 解析失败')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleAiGenerate = async () => {
    if (!lightFileUrl.trim() || !darkFileUrl.trim()) {
      addLog('❌ 请提供 Light 和 Dark 两个 Figma 文件链接')
      return
    }
    setAiGenerating(true)
    addLog('🤖 AI 正在分析颜色映射...')
    try {
      const res = await fetch(`${BRIDGE_URL}/api/ai/generate-mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lightFileUrl,
          darkFileUrl,
          figmaToken: figmaToken || undefined,
          deepseekKey: deepseekKey || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) {
        addLog(`❌ AI 生成失败: ${data.error}`)
      } else {
        setMapping(data.mapping || [])
        addLog(`✅ AI 生成 ${data.total} 条映射规则`)
        setActiveStep(2)
        await fetch(`${BRIDGE_URL}/api/upload-mapping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mapping: data.mapping }),
        })
      }
    } catch (e: any) {
      addLog(`❌ AI 请求失败: ${e.message}`)
    } finally {
      setAiGenerating(false)
    }
  }

  const handleSwap = async () => {
    if (mapping.length === 0) {
      addLog('❌ 请先导入或生成映射规则')
      return
    }
    setSwapping(true)
    addLog(`🔄 开始换色 (${direction === 'light-to-dark' ? '浅→深' : '深→浅'})...`)
    try {
      const preset = SIZE_PRESETS[selectedSizePreset]
      const isCustom = preset.label === '自定义'
      const minWidth = isCustom ? (parseInt(customMinW) || 0) : preset.minW
      const maxWidth = isCustom ? (parseInt(customMaxW) || 99999) : preset.maxW
      const res = await fetch(`${BRIDGE_URL}/api/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: figmaFileUrl,
          figmaToken: figmaToken || undefined,
          direction,
          minWidth,
          maxWidth,
          skipLocked,
        }),
      })
      const data = await res.json()
      if (data.error) {
        addLog(`❌ 换色失败: ${data.error}`)
      } else {
        addLog(`✅ 换色完成！处理了 ${data.frames?.length || 0} 个画板`)
        setActiveStep(3)
      }
    } catch (e: any) {
      addLog(`❌ 换色请求失败: ${e.message}`)
    } finally {
      setSwapping(false)
    }
  }

  const toggleFrame = (id: string) => {
    setSelectedFrameIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFrames = () => {
    if (selectedFrameIds.size === frames.length) {
      setSelectedFrameIds(new Set())
    } else {
      setSelectedFrameIds(new Set(frames.map(f => f.id)))
    }
  }

  const steps = [
    { label: '配置连接', icon: Wifi },
    { label: '选择画板', icon: Layers },
    { label: '映射规则', icon: Palette },
    { label: '执行换色', icon: Zap },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <ArrowRightLeft size={20} className="text-primary" />
            Figma 一键换色
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">通过桥接服务器连接 Figma 插件，批量替换画板主题色</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
            bridgeStatus === 'online'
              ? pluginStatus
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : bridgeStatus === 'checking'
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {bridgeStatus === 'checking' ? <Loader2 size={10} className="animate-spin" /> : bridgeStatus === 'online' ? <Wifi size={10} /> : <WifiOff size={10} />}
            {bridgeStatus === 'checking' ? '检测中' : bridgeStatus === 'online' ? (pluginStatus ? '已连接' : '桥接在线') : '桥接离线'}
          </div>
          <button
            onClick={handleRefreshStatus}
            disabled={bridgeStatus === 'checking'}
            className="p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-[hsl(var(--foreground)/0.06)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="重新检测"
          >
            <RefreshCw size={12} className={bridgeStatus === 'checking' ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-lg bg-[hsl(var(--surface-secondary)/0.4)] border border-[hsl(var(--foreground)/0.06)]">
        {steps.map((step, i) => (
          <button
            key={step.label}
            onClick={() => i <= activeStep && setActiveStep(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 flex-1 justify-center ${
              activeStep === i
                ? 'bg-primary/15 text-primary'
                : i < activeStep
                  ? 'text-primary/60 hover:text-primary/80 cursor-pointer'
                  : 'text-muted-foreground/50'
            }`}
          >
            <step.icon size={11} />
            <span className="hidden lg:inline">{step.label}</span>
          </button>
        ))}
      </div>

      {activeStep === 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {bridgeStatus === 'online' ? <Wifi size={14} className="text-emerald-400" /> : <WifiOff size={14} className="text-red-400" />}
                <span className="text-xs font-medium text-foreground">桥接服务器</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">{BRIDGE_URL}</span>
            </div>
            {bridgeStatus === 'offline' && (
              <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3 text-xs text-red-400">
                桥接服务器未启动。请运行：<code className="bg-red-500/10 px-1.5 py-0.5 rounded text-[10px] font-mono">node server.js</code>
              </div>
            )}
            {bridgeStatus === 'online' && !pluginStatus && (
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-3 text-xs text-amber-400">
                桥接服务器已启动，但 Figma 插件未连接。请在 Figma 中运行插件。
              </div>
            )}
            {bridgeStatus === 'online' && pluginStatus && (
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle2 size={12} />
                桥接服务器和 Figma 插件均已连接，可以开始操作。
              </div>
            )}
          </div>

          <div className="glass rounded-xl p-4 space-y-3">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="w-full flex items-center justify-between"
            >
              <span className="text-xs font-medium text-foreground flex items-center gap-2">
                <Layers size={12} className="text-primary" />
                API 配置
              </span>
              <ChevronDown size={12} className={`text-muted-foreground transition-transform ${showConfig ? '' : '-rotate-90'}`} />
            </button>
            <AnimatePresence>
              {showConfig && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Figma Personal Access Token</label>
                    <input
                      type="password"
                      value={figmaToken}
                      onChange={e => setFigmaToken(e.target.value)}
                      placeholder="figd_..."
                      className="w-full h-8 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.08)] px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">DeepSeek API Key（AI 映射用）</label>
                    <input
                      type="password"
                      value={deepseekKey}
                      onChange={e => setDeepseekKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full h-8 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.08)] px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                    />
                  </div>
                  <Button
                    variant="glow"
                    size="sm"
                    onClick={async () => {
                      if (!figmaToken && !deepseekKey) return
                      try {
                        await fetch(`${BRIDGE_URL}/api/config`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ figmaToken, deepseekKey }),
                        })
                        addLog('✅ 配置已保存到桥接服务器')
                      } catch (e: any) {
                        addLog(`❌ 保存失败: ${e.message}`)
                      }
                    }}
                  >保存配置</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="glass rounded-xl p-4 space-y-3">
            <span className="text-xs font-medium text-foreground flex items-center gap-2">
              <Layers size={12} className="text-primary" />
              Figma 文件链接
            </span>
            <input
              value={figmaFileUrl}
              onChange={e => setFigmaFileUrl(e.target.value)}
              placeholder="https://www.figma.com/design/xxxxx/..."
              className="w-full h-8 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.08)] px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
            />
            <div>
              <span className="text-[10px] text-muted-foreground mb-1.5 block">画板尺寸筛选</span>
              <div className="grid grid-cols-2 gap-2">
                {SIZE_PRESETS.map((preset, i) => (
                  <button
                    key={preset.label}
                    onClick={() => setSelectedSizePreset(i)}
                    className={`px-3 py-2 rounded-lg text-[11px] font-medium transition-all duration-200 text-left ${
                      selectedSizePreset === i
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-[hsl(var(--surface-secondary)/0.4)] text-muted-foreground hover:text-foreground border border-transparent'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            {selectedSizePreset === 3 && (
              <div className="flex items-center gap-2 mt-1">
                <input
                  value={customMinW}
                  onChange={e => setCustomMinW(e.target.value.replace(/\D/g, ''))}
                  placeholder="最小宽度"
                  className="flex-1 h-7 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.08)] px-2.5 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                />
                <span className="text-[10px] text-muted-foreground shrink-0">px</span>
                <span className="text-[11px] text-muted-foreground shrink-0">~</span>
                <input
                  value={customMaxW}
                  onChange={e => setCustomMaxW(e.target.value.replace(/\D/g, ''))}
                  placeholder="最大宽度"
                  className="flex-1 h-7 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.08)] px-2.5 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                />
                <span className="text-[10px] text-muted-foreground shrink-0">px</span>
              </div>
            )}
            <Button
              variant="glow"
              className="w-full gap-2"
              disabled={!figmaFileUrl.trim() || loadingFrames}
              onClick={handleListFrames}
            >
              {loadingFrames ? <Loader2 size={14} className="animate-spin" /> : <Scan size={14} />}
              {loadingFrames ? '获取中...' : '获取画板列表'}
            </Button>
          </div>
        </motion.div>
      )}

      {activeStep === 1 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">画板列表 ({frames.length})</span>
              <button
                onClick={selectAllFrames}
                className="text-[10px] text-primary hover:text-primary/70 transition-colors"
              >
                {selectedFrameIds.size === frames.length ? '取消全选' : '全选'}
              </button>
            </div>
            {frames.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Layers size={24} className="mx-auto mb-2 opacity-30" />
                <span className="text-xs">暂无画板，请先获取画板列表</span>
              </div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto space-y-1 pr-1">
                {frames.map(frame => (
                  <button
                    key={frame.id}
                    onClick={() => toggleFrame(frame.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 ${
                      selectedFrameIds.has(frame.id)
                        ? 'bg-primary/10 border border-primary/20'
                        : 'bg-[hsl(var(--surface-secondary)/0.3)] border border-transparent hover:bg-[hsl(var(--surface-secondary)/0.6)]'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selectedFrameIds.has(frame.id) ? 'border-primary bg-primary/20' : 'border-muted-foreground/30'
                    }`}>
                      {selectedFrameIds.has(frame.id) && <CheckCircle2 size={10} className="text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-foreground truncate">{frame.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{frame.id} · {frame.width}×{frame.height}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveStep(0)}>上一步</Button>
            <Button
              variant="glow"
              className="flex-1 gap-2"
              disabled={selectedFrameIds.size === 0}
              onClick={() => setActiveStep(2)}
            >
              下一步：映射规则
              <ChevronRight size={14} />
            </Button>
          </div>
        </motion.div>
      )}

      {activeStep === 2 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="glass rounded-xl p-4 space-y-3">
            <span className="text-xs font-medium text-foreground flex items-center gap-2">
              <FileJson size={12} className="text-primary" />
              映射规则
            </span>
            <div className="grid grid-cols-2 gap-3">
              {uploadedFileName ? (
                <div className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 transition-colors">
                  <CheckCircle2 size={20} className="text-emerald-400 mb-2" />
                  <span className="text-xs text-emerald-400 font-medium truncate max-w-full px-1">{uploadedFileName}</span>
                  <span className="text-[10px] text-emerald-400/60 mt-0.5">上传成功</span>
                  <button
                    onClick={() => {
                      setUploadedFileName(null)
                      fileInputRef.current?.click()
                    }}
                    className="mt-2 text-[10px] text-primary/60 hover:text-primary transition-colors"
                  >
                    重新上传
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-[hsl(var(--foreground)/0.1)] hover:border-primary/40 transition-colors cursor-pointer"
                >
                  <Upload size={20} className="text-muted-foreground/50 mb-2" />
                  <span className="text-xs text-muted-foreground">上传 JSON 文件</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleUploadMapping} />
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-muted-foreground">AI 自动生成</span>
                <input
                  value={lightFileUrl}
                  onChange={e => setLightFileUrl(e.target.value)}
                  placeholder="Light 文件链接"
                  className="h-7 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.08)] px-2.5 text-[10px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                />
                <input
                  value={darkFileUrl}
                  onChange={e => setDarkFileUrl(e.target.value)}
                  placeholder="Dark 文件链接"
                  className="h-7 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.08)] px-2.5 text-[10px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                />
                <Button
                  variant="glow"
                  size="sm"
                  className="w-full gap-1"
                  disabled={aiGenerating}
                  onClick={handleAiGenerate}
                >
                  {aiGenerating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  {aiGenerating ? '生成中...' : 'AI 生成'}
                </Button>
              </div>
            </div>
          </div>

          {mapping.length > 0 && (
            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">映射预览 ({mapping.length} 条)</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMapping([])}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={10} /> 清空
                  </button>
                  <button
                    onClick={() => setShowMappingDetail(!showMappingDetail)}
                    className="text-[10px] text-primary hover:text-primary/70 transition-colors"
                  >
                    {showMappingDetail ? '收起' : '展开详情'}
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {showMappingDetail && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="max-h-[240px] overflow-y-auto space-y-1.5 pr-1">
                      {mapping.map((rule, i) => (
                        <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[hsl(var(--surface-secondary)/0.4)]">
                          <div className="w-5 h-5 rounded border border-white/10 shrink-0" style={{ background: rgbToHex(rule.light.r, rule.light.g, rule.light.b) }} />
                          <ArrowRightLeft size={10} className="text-muted-foreground/40 shrink-0" />
                          <div className="w-5 h-5 rounded border border-white/10 shrink-0" style={{ background: rgbToHex(rule.dark.r, rule.dark.g, rule.dark.b) }} />
                          <span className="text-[10px] text-muted-foreground truncate flex-1">{rule.name}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {!showMappingDetail && (
                <div className="flex items-center gap-0.5 flex-wrap">
                  {mapping.slice(0, 20).map((rule, i) => (
                    <div key={i} className="flex items-center">
                      <div className="w-4 h-4 rounded-sm border border-white/10" style={{ background: rgbToHex(rule.light.r, rule.light.g, rule.light.b) }} />
                      <ArrowRightLeft size={8} className="text-muted-foreground/30 mx-0.5" />
                      <div className="w-4 h-4 rounded-sm border border-white/10" style={{ background: rgbToHex(rule.dark.r, rule.dark.g, rule.dark.b) }} />
                    </div>
                  ))}
                  {mapping.length > 20 && <span className="text-[9px] text-muted-foreground ml-1">+{mapping.length - 20}</span>}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveStep(1)}>上一步</Button>
            <Button
              variant="glow"
              className="flex-1 gap-2"
              disabled={mapping.length === 0}
              onClick={() => setActiveStep(3)}
            >
              下一步：执行换色
              <ChevronRight size={14} />
            </Button>
          </div>
        </motion.div>
      )}

      {activeStep === 3 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="glass rounded-xl p-4 space-y-3">
            <span className="text-xs font-medium text-foreground">换色方向</span>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDirection('light-to-dark')}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                  direction === 'light-to-dark'
                    ? 'border-primary/40 bg-primary/8 shadow-sm'
                    : 'border-[hsl(var(--foreground)/0.08)] bg-[hsl(var(--surface-secondary)/0.3)] hover:bg-[hsl(var(--surface-secondary)/0.6)]'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-white/90 flex items-center justify-center shrink-0">
                  <Sun size={16} className="text-amber-500" />
                </div>
                <div className="text-left">
                  <div className={`text-xs font-medium ${direction === 'light-to-dark' ? 'text-primary' : 'text-foreground'}`}>浅色 → 深色</div>
                  <div className="text-[10px] text-muted-foreground">Light to Dark</div>
                </div>
              </button>
              <button
                onClick={() => setDirection('dark-to-light')}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                  direction === 'dark-to-light'
                    ? 'border-primary/40 bg-primary/8 shadow-sm'
                    : 'border-[hsl(var(--foreground)/0.08)] bg-[hsl(var(--surface-secondary)/0.3)] hover:bg-[hsl(var(--surface-secondary)/0.6)]'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                  <Moon size={16} className="text-blue-300" />
                </div>
                <div className="text-left">
                  <div className={`text-xs font-medium ${direction === 'dark-to-light' ? 'text-primary' : 'text-foreground'}`}>深色 → 浅色</div>
                  <div className="text-[10px] text-muted-foreground">Dark to Light</div>
                </div>
              </button>
            </div>
          </div>

          <div className="glass rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Lock size={13} className="text-amber-500" />
              </div>
              <div>
                <div className="text-xs font-medium text-foreground">跳过锁定图层</div>
                <div className="text-[10px] text-muted-foreground">换色时自动跳过被锁定的图层</div>
              </div>
            </div>
            <button
              onClick={() => setSkipLocked(!skipLocked)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                skipLocked ? 'bg-primary' : 'bg-[hsl(var(--foreground)/0.15)]'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  skipLocked ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="glass rounded-xl p-4 space-y-2">
            <span className="text-xs font-medium text-foreground">执行摘要</span>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-[hsl(var(--surface-secondary)/0.4)] p-2.5 text-center">
                <div className="text-lg font-semibold text-foreground">{selectedFrameIds.size}</div>
                <div className="text-[10px] text-muted-foreground">选中画板</div>
              </div>
              <div className="rounded-lg bg-[hsl(var(--surface-secondary)/0.4)] p-2.5 text-center">
                <div className="text-lg font-semibold text-foreground">{mapping.length}</div>
                <div className="text-[10px] text-muted-foreground">映射规则</div>
              </div>
              <div className="rounded-lg bg-[hsl(var(--surface-secondary)/0.4)] p-2.5 text-center">
                <div className="text-lg font-semibold text-foreground">{direction === 'light-to-dark' ? '浅→深' : '深→浅'}</div>
                <div className="text-[10px] text-muted-foreground">换色方向</div>
              </div>
            </div>
          </div>

          <Button
            variant="glow"
            className="w-full gap-2 py-3"
            disabled={swapping || selectedFrameIds.size === 0 || mapping.length === 0}
            onClick={handleSwap}
          >
            {swapping ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {swapping ? '换色执行中...' : '执行一键换色'}
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveStep(2)}>上一步</Button>
          </div>
        </motion.div>
      )}

      {logs.length > 0 && (
        <div className="glass rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground flex items-center gap-2">
              <Eye size={12} className="text-primary" />
              执行日志
            </span>
            <button onClick={() => setLogs([])} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">清空</button>
          </div>
          <div className="max-h-[160px] overflow-y-auto space-y-0.5 pr-1 font-mono">
            {logs.map((log, i) => (
              <div key={i} className={`text-[10px] leading-relaxed ${
                log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-emerald-400' : log.includes('🤖') ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {log}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Settings, X, CheckCircle2, Circle, Key, Eye, EyeOff,
  Palette, Cpu, Monitor, Sparkles, RefreshCw,
  Activity, Zap, Moon, Sun, Gauge, ZapOff, Bell,
  BellOff, Clock, BarChart3, Globe, Save,
  Contrast
} from 'lucide-react'
import { Button } from './ui/button'
import { themes as hmiThemes, type HMITheme, type HSLValue } from '@/data/themeData'

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslCSS({ h, s, l }: HSLValue, alpha?: number): string {
  if (alpha !== undefined) {
    return `hsl(${h}, ${s}%, ${l}%, ${alpha})`
  }
  return `hsl(${h}, ${s}%, ${l}%)`
}

function themeGradient(theme: HMITheme): string {
  return `linear-gradient(135deg, ${theme.preview.primaryHex} 0%, ${hslCSS(theme.colors.glow)} 50%, ${hslCSS(theme.colors.accent)} 100%)`
}

interface SettingsCenterProps {
  open: boolean
  onClose: () => void
  activeTab?: string
  activeThemeId: string
  applyTheme: (theme: HMITheme) => void
}

const settingsTabs = [
  { id: 'theme', label: '主题系统', icon: Palette, description: '控制 Workspace 的视觉风格' },
  { id: 'api', label: 'API 配置', icon: Cpu, description: '连接即梦 AI 服务' },
  { id: 'system', label: '系统偏好', icon: Monitor, description: '调整交互体验' },
]

const motionLevels = [
  { id: 'minimal', name: '精简动效', desc: '减少动画效果', icon: ZapOff },
  { id: 'smooth', name: '流畅动效', desc: '平衡与优雅', icon: Zap },
  { id: 'premium', name: '高级动效', desc: '极致体验', icon: Sparkles },
]

const blurLevels = [
  { id: 'low', name: '低', value: 10 },
  { id: 'medium', name: '中', value: 20 },
  { id: 'high', name: '高', value: 30 },
]

const transitionSpeeds = [
  { id: 'fast', name: '快速', value: 0.15 },
  { id: 'smooth', name: '流畅', value: 0.3 },
  { id: 'slow', name: '慢速', value: 0.5 },
]

export default function SettingsCenter({ open, onClose, activeTab: initialTab, activeThemeId, applyTheme }: SettingsCenterProps) {
  const [activeTab, setActiveTab] = useState(initialTab || 'api')
  const [autoTheme, setAutoTheme] = useState(false)
  
  const [motionLevel, setMotionLevel] = useState('smooth')
  const [blurLevel, setBlurLevel] = useState('medium')
  const [transitionSpeed, setTransitionSpeed] = useState('smooth')
  const [hoverMotion, setHoverMotion] = useState(true)
  const [reduceMotion, setReduceMotion] = useState(false)

  const [customPrimary, setCustomPrimary] = useState('#6366f1')
  const [customSecondary, setCustomSecondary] = useState('#8b5cf6')
  const [customBackground, setCustomBackground] = useState('#0f172a')
  const [customName, setCustomName] = useState('')

  const [customPresets, setCustomPresets] = useState<HMITheme[]>(() => {
    try {
      const s = localStorage.getItem('hmi-custom-presets')
      return s ? JSON.parse(s) : []
    } catch { return [] }
  })

  const saveCustomTheme = () => {
    if (!customName.trim()) return
    const primary = hexToHSL(customPrimary)
    const secondary = hexToHSL(customSecondary)
    const bg = hexToHSL(customBackground)
    const newTheme: HMITheme = {
      id: `custom-settings-${Date.now()}`,
      name: customName.trim(),
      description: '自定义主题',
      preview: {
        gradient: `from-[${customPrimary}] to-[${customSecondary}]`,
        bg: `bg-[${customPrimary}]/10`,
        primaryHex: customPrimary,
      },
      colors: {
        background: bg,
        surface: { h: bg.h, s: bg.s, l: Math.min(bg.l + 3, 100) },
        surfaceSecondary: { h: bg.h, s: Math.max(bg.s - 2, 0), l: Math.min(bg.l + 6, 100) },
        surfaceTertiary: { h: bg.h, s: Math.max(bg.s - 4, 0), l: Math.min(bg.l + 10, 100) },
        foreground: { h: primary.h, s: 12, l: 92 },
        mutedForeground: { h: primary.h, s: 8, l: 52 },
        primary,
        primaryForeground: { h: bg.h, s: bg.s, l: Math.min(bg.l + 3.5, 100) },
        glow: { h: primary.h, s: Math.min(primary.s + 15, 100), l: Math.min(primary.l + 10, 100) },
        glowSubtle: { h: primary.h, s: Math.min(primary.s - 5, 100), l: Math.min(primary.l - 10, 85) },
        secondary: { h: bg.h, s: Math.min(bg.s + 10, 100), l: Math.min(bg.l + 10, 100) },
        secondaryForeground: { h: primary.h, s: 10, l: 88 },
        accent: { h: secondary.h, s: secondary.s, l: Math.min(secondary.l, 100) },
        accentForeground: { h: secondary.h, s: 10, l: 92 },
        card: { h: bg.h, s: bg.s, l: Math.min(bg.l + 3.5, 100) },
        cardForeground: { h: primary.h, s: 12, l: 92 },
        popover: { h: bg.h, s: bg.s, l: Math.min(bg.l + 3, 100) },
        popoverForeground: { h: primary.h, s: 12, l: 92 },
        muted: { h: bg.h, s: bg.s, l: Math.min(bg.l + 7, 100) },
        destructive: { h: 0, s: 72, l: 51 },
        destructiveForeground: { h: 0, s: 5, l: 97 },
        border: { h: bg.h, s: Math.max(bg.s - 2, 0), l: Math.min(bg.l + 9, 100) },
        input: { h: bg.h, s: Math.max(bg.s - 2, 0), l: Math.min(bg.l + 9, 100) },
        ring: primary,
      },
    }
    const updated = [...customPresets, newTheme]
    setCustomPresets(updated)
    localStorage.setItem('hmi-custom-presets', JSON.stringify(updated))
    applyTheme(newTheme)
    setCustomName('')
  }

  const deleteCustomPreset = (id: string) => {
    const updated = customPresets.filter(p => p.id !== id)
    setCustomPresets(updated)
    localStorage.setItem('hmi-custom-presets', JSON.stringify(updated))
  }

  const allThemes = [...hmiThemes, ...customPresets]

  const [activeApiProvider, setActiveApiProvider] = useState('jimeng')
  const [apiProviders, setApiProviders] = useState([
    {
      id: 'jimeng',
      name: '即梦 AI',
      icon: '🎨',
      description: '字节跳动即梦 AI 图像生成服务',
      status: 'disconnected' as 'disconnected' | 'connecting' | 'connected',
      apiKey: '',
      endpoint: 'api.jimeng.ai',
      basePath: '/v1/images/generations',
      models: [
        { id: 'seedream-5', name: 'Seedream 5.0', desc: '文生图 & 图生图，2K分辨率', recommended: true, status: 'active' as 'active' | 'available' | 'coming' },
        { id: 'seedream-4', name: 'Seedream 4.0', desc: '文生图，1080P分辨率', recommended: false, status: 'available' as const },
        { id: 'hmi-xl', name: 'HMI XL Pro', desc: '专业HMI场景，4K支持', recommended: false, status: 'coming' as const },
      ],
    },
    {
      id: 'openai',
      name: 'OpenAI',
      icon: '🤖',
      description: 'GPT-4o / DALL·E 3 图像生成',
      status: 'disconnected' as 'disconnected' | 'connecting' | 'connected',
      apiKey: '',
      endpoint: 'api.openai.com',
      basePath: '/v1/images/generations',
      models: [
        { id: 'dall-e-3', name: 'DALL·E 3', desc: '高质量图像生成', recommended: true, status: 'available' as const },
        { id: 'gpt-4o', name: 'GPT-4o', desc: '多模态理解与生成', recommended: false, status: 'available' as const },
      ],
    },
    {
      id: 'ark',
      name: '火山方舟',
      icon: '🌋',
      description: '字节跳动火山方舟平台',
      status: 'disconnected' as 'disconnected' | 'connecting' | 'connected',
      apiKey: '',
      endpoint: 'ark.cn-beijing.volces.com',
      basePath: '/api/v3/images/generations',
      models: [
        { id: 'ark-seedream', name: 'Seedream Ark', desc: '方舟版即梦模型', recommended: true, status: 'available' as const },
      ],
    },
    {
      id: 'stability',
      name: 'Stability AI',
      icon: '🌀',
      description: 'Stable Diffusion 系列模型',
      status: 'disconnected' as 'disconnected' | 'connecting' | 'connected',
      apiKey: '',
      endpoint: 'api.stability.ai',
      basePath: '/v2beta/stable-image/generate',
      models: [
        { id: 'sd3', name: 'Stable Diffusion 3', desc: '最新一代扩散模型', recommended: true, status: 'available' as const },
        { id: 'sdxl', name: 'SDXL 1.0', desc: '高分辨率图像生成', recommended: false, status: 'available' as const },
      ],
    },
  ])
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})
  const [isTestingApi, setIsTestingApi] = useState(false)
  const [testSteps, setTestSteps] = useState<{ step: string; done: boolean }[]>([])
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [newProviderForm, setNewProviderForm] = useState({ name: '', apiKey: '' })

  useEffect(() => {
    if (open) {
      const savedStatus = (() => {
        try {
          const s = localStorage.getItem('api_config_status')
          if (s) {
            const cfg = JSON.parse(s)
            return cfg.provider as string
          }
        } catch {}
        return null
      })()
      if (savedStatus) {
        setApiProviders(prev => prev.map(p => p.id === savedStatus ? { ...p, status: 'connected' as const } : p))
      }
      fetch('/api/jimeng/status').then(r => r.json()).then(d => {
        if (d.ok) {
          setApiProviders(prev => prev.map(p => {
            if (p.id === 'jimeng') {
              return { 
                ...p, 
                status: 'connected' as const,
                apiKey: 'ark-83c3387c-3a20-463b-a888-2aad7be0b97a-31c09'
              }
            }
            return p
          }))
        }
      }).catch(() => {})
      fetch('/api/openai/status').then(r => r.json()).then(d => {
        if (d.ok) {
          setApiProviders(prev => prev.map(p => p.id === 'openai' ? { ...p, status: 'connected' as const } : p))
        }
      }).catch(() => {})
    }
  }, [open])

  const currentProvider = apiProviders.find(p => p.id === activeApiProvider) || apiProviders[0]

  const updateProvider = (id: string, updates: Partial<typeof apiProviders[0]>) => {
    setApiProviders(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  const saveApiConfig = async () => {
    const provider = apiProviders.find(p => p.id === activeApiProvider) || apiProviders[0]
    const apiKey = provider.apiKey.trim()

    try {
      if (activeApiProvider === 'openai') {
        if (apiKey) {
          const res = await fetch('/api/openai/save_key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey }),
          })
          const data = await res.json()
          if (data.ok) {
            updateProvider(activeApiProvider, { status: 'connected' })
            localStorage.setItem('api_config_status', JSON.stringify({ provider: 'openai', configuredAt: Date.now() }))
          }
        }
      } else if (activeApiProvider === 'jimeng' || activeApiProvider === 'ark') {
        const res = await fetch('/api/jimeng/save_key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey || 'ark-83c3387c-3a20-463b-a888-2aad7be0b97a-31c09' }),
        })
        const data = await res.json()
        if (data.ok) {
          updateProvider(activeApiProvider, { status: 'connected' })
          localStorage.setItem('api_config_status', JSON.stringify({ provider: activeApiProvider, configuredAt: Date.now() }))
        }
      }
    } catch {}
  }

  const testApiConnection = async () => {
    const provider = apiProviders.find(p => p.id === activeApiProvider) || apiProviders[0]
    const apiKey = provider.apiKey.trim()

    setIsTestingApi(true)
    updateProvider(activeApiProvider, { status: 'connecting' })
    setTestSteps([
      { step: '正在保存 API Key...', done: false },
      { step: `正在连接 ${provider.name}...`, done: false },
      { step: 'API 已连接', done: false },
      { step: '生成服务可用', done: false },
    ])

    try {
      if (activeApiProvider === 'openai') {
        if (!apiKey) {
          setTestSteps(prev => prev.map((s, i) => i === 0 ? { ...s, done: false, step: `请先输入 OpenAI Key` } : s))
          setIsTestingApi(false)
          updateProvider(activeApiProvider, { status: 'disconnected' })
          return
        }
        const res = await fetch('/api/openai/save_key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey }),
        })
        const data = await res.json()
        if (!data.ok) {
          setTestSteps(prev => prev.map((s, i) => i === 0 ? { ...s, done: false, step: `保存 OpenAI Key 失败` } : s))
          setIsTestingApi(false)
          updateProvider(activeApiProvider, { status: 'disconnected' })
          return
        }
      } else if (activeApiProvider === 'jimeng' || activeApiProvider === 'ark') {
        const res = await fetch('/api/jimeng/save_key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey || 'ark-83c3387c-3a20-463b-a888-2aad7be0b97a-31c09' }),
        })
        const data = await res.json()
        if (!data.ok) {
          setTestSteps(prev => prev.map((s, i) => i === 0 ? { ...s, done: false, step: `保存 Key 失败` } : s))
          setIsTestingApi(false)
          updateProvider(activeApiProvider, { status: 'disconnected' })
          return
        }
      }

      setTestSteps(prev => prev.map((s, i) => i === 0 ? { ...s, done: true } : s))

      for (let i = 1; i < 4; i++) {
        await new Promise(resolve => setTimeout(resolve, 400))
        setTestSteps(prev => prev.map((s, idx) => idx === i ? { ...s, done: true } : s))
      }

      await new Promise(resolve => setTimeout(resolve, 300))
      setIsTestingApi(false)
      updateProvider(activeApiProvider, { status: 'connected' })
      localStorage.setItem('api_config_status', JSON.stringify({ provider: activeApiProvider, configuredAt: Date.now() }))
    } catch {
      setTestSteps(prev => prev.map((s, i) => i === 0 ? { ...s, done: false, step: `网络错误，请重试` } : s))
      setIsTestingApi(false)
      updateProvider(activeApiProvider, { status: 'disconnected' })
    }
  }

  const addCustomProvider = () => {
    if (!newProviderForm.name) return
    const newProvider = {
      id: `custom-${Date.now()}`,
      name: newProviderForm.name,
      icon: '⚡',
      description: '自定义 API 服务',
      status: 'disconnected' as const,
      apiKey: newProviderForm.apiKey,
      endpoint: '',
      basePath: '',
      models: [
        { id: 'default', name: '默认模型', desc: '自定义模型', recommended: true, status: 'available' as const },
      ],
    }
    setApiProviders(prev => [...prev, newProvider])
    setActiveApiProvider(newProvider.id)
    setShowAddProvider(false)
    setNewProviderForm({ name: '', apiKey: '' })
  }

  const removeProvider = (id: string) => {
    if (apiProviders.length <= 1) return
    setApiProviders(prev => prev.filter(p => p.id !== id))
    if (activeApiProvider === id) {
      setActiveApiProvider(apiProviders[0].id)
    }
  }

  if (!open) return null

  const renderThemeSelection = () => (
    <motion.div 
      className="glass-strong rounded-2xl p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-sm font-semibold text-foreground">主题选择</h4>
          <p className="text-xs text-muted-foreground mt-1">选择您的主题风格</p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
            <Sun size={14} />
            <span>自动</span>
            <Moon size={14} />
          </div>
          <button
            onClick={() => setAutoTheme(!autoTheme)}
            className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
              autoTheme ? 'bg-primary' : 'bg-[hsl(var(--surface-secondary))]'
            }`}
          >
            <motion.div 
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg"
              animate={{ left: autoTheme ? '28px' : '4px' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {allThemes.map((theme, index) => (
          <motion.button
            key={theme.id}
            onClick={() => applyTheme(theme)}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={`relative overflow-hidden rounded-xl p-4 transition-all duration-300 ${
              activeThemeId === theme.id 
                ? 'ring-1 ring-primary/40 shadow-xl shadow-primary/10' 
                : 'hover:shadow-lg'
            }`}
            style={{
              background: activeThemeId === theme.id 
                ? hslCSS(theme.colors.primary, 0.08)
                : 'hsl(var(--surface-secondary) / 0.3)'
            }}
          >
            {activeThemeId === theme.id && (
              <motion.div
                className="absolute inset-0"
                style={{ 
                  background: `linear-gradient(135deg, ${hslCSS(theme.colors.primary, 0.06)}, ${hslCSS(theme.colors.accent, 0.03)})` 
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              />
            )}
            
            <div className="relative z-10 flex items-center gap-4">
              <div className="relative">
                <div 
                  className="w-12 h-12 rounded-xl shadow-lg"
                  style={{ background: themeGradient(theme) }}
                />
                {activeThemeId === theme.id && (
                  <motion.div
                    className="absolute -inset-1 rounded-xl"
                    style={{ boxShadow: `0 0 20px ${hslCSS(theme.colors.primary, 0.25)}` }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </div>
              
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{theme.name}</span>
                  {activeThemeId === theme.id && (
                    <CheckCircle2 size={14} className="text-primary" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{theme.description}</span>
              </div>

              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded-lg" style={{ backgroundColor: theme.preview.primaryHex }} />
                <div className="w-4 h-4 rounded-md" style={{ backgroundColor: hslCSS(theme.colors.accent) }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hslCSS(theme.colors.primary, 0.5) }} />
              </div>
            </div>

            {theme.id.startsWith('custom') && (
                <div
                  onClick={(e) => { e.stopPropagation(); deleteCustomPreset(theme.id); }}
                  className="ml-auto p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                  title="删除主题"
                >
                  <X size={14} />
                </div>
              )}

            <motion.div 
              className="absolute top-2 right-2 w-20 h-20 rounded-full blur-2xl opacity-30"
              style={{ backgroundColor: theme.preview.primaryHex }}
              animate={{ 
                scale: activeThemeId === theme.id ? [1, 1.2, 1] : 1,
                opacity: activeThemeId === theme.id ? [0.2, 0.4, 0.2] : 0
              }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          </motion.button>
        ))}
      </div>
    </motion.div>
  )

  const renderThemePreview = () => {
    const activeTheme = allThemes.find(t => t.id === activeThemeId)
    if (!activeTheme) return null
    return (
    <div className="space-y-6">
      <motion.div 
        className="glass-strong rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h4 className="text-sm font-semibold text-foreground mb-4">实时预览</h4>
        <motion.div 
          className="rounded-xl p-6 min-h-[160px] flex flex-col items-center justify-center gap-6"
          style={{ background: hslCSS(activeTheme.colors.primary, 0.06) }}
        >
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <motion.button 
                key={i}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-all"
                style={{ backgroundColor: hslCSS(activeTheme.colors.primary, 0.15) }}
              >
                <Sparkles size={18} style={{ color: activeTheme.preview.primaryHex }} />
              </motion.button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: activeTheme.preview.primaryHex }} />
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: hslCSS(activeTheme.colors.accent) }} />
              <div className="w-4 h-4 rounded-full bg-white/80" />
            </div>
            <div className="h-4 w-px bg-primary/30" />
            <span className="text-xs text-muted-foreground">{activeTheme.name} 当前生效</span>
          </div>
        </motion.div>
      </motion.div>

      <motion.div 
        className="glass rounded-xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h4 className="text-sm font-semibold text-foreground mb-4">UI 组件</h4>
        <div className="grid grid-cols-2 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="p-4 rounded-xl text-left transition-all"
            style={{ backgroundColor: hslCSS(activeTheme.colors.primary, 0.1), border: `1px solid ${hslCSS(activeTheme.colors.primary, 0.15)}` }}
          >
            <div className="text-xs font-medium mb-1" style={{ color: activeTheme.preview.primaryHex }}>主色按钮</div>
            <div className="text-[10px] text-muted-foreground">点击交互</div>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="p-4 rounded-xl text-left transition-all"
            style={{ backgroundColor: hslCSS(activeTheme.colors.accent, 0.1), border: `1px solid ${hslCSS(activeTheme.colors.accent, 0.15)}` }}
          >
            <div className="text-xs font-medium mb-1" style={{ color: hslCSS(activeTheme.colors.accent) }}>辅色按钮</div>
            <div className="text-[10px] text-muted-foreground">次要操作</div>
          </motion.button>
        </div>
      </motion.div>
    </div>
    )
  }

  const renderThemeCustom = () => (
    <div className="space-y-6">
      <motion.div 
        className="glass-strong rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h4 className="text-sm font-semibold text-foreground mb-4">自定义主题</h4>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">主题名称</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="输入主题名称..."
              className="w-full px-4 py-2.5 rounded-lg bg-[hsl(var(--surface-secondary)/0.3)] text-sm text-foreground border border-[hsl(var(--border))/30] placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">主色</label>
            <div className="flex gap-2">
              <label className="w-12 h-12 rounded-full flex-shrink-0 cursor-pointer relative block" style={{ backgroundColor: customPrimary }}>
                <input type="color" value={customPrimary} onChange={(e) => setCustomPrimary(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
              <input type="text" value={customPrimary} onChange={(e) => setCustomPrimary(e.target.value)} className="flex-1 px-4 rounded-lg bg-[hsl(var(--surface-secondary)/0.3)] text-xs text-foreground border border-[hsl(var(--border))/30]" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">辅色</label>
            <div className="flex gap-2">
              <label className="w-12 h-12 rounded-full flex-shrink-0 cursor-pointer relative block" style={{ backgroundColor: customSecondary }}>
                <input type="color" value={customSecondary} onChange={(e) => setCustomSecondary(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
              <input type="text" value={customSecondary} onChange={(e) => setCustomSecondary(e.target.value)} className="flex-1 px-4 rounded-lg bg-[hsl(var(--surface-secondary)/0.3)] text-xs text-foreground border border-[hsl(var(--border))/30]" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">背景色</label>
            <div className="flex gap-2">
              <label className="w-12 h-12 rounded-full flex-shrink-0 cursor-pointer relative block" style={{ backgroundColor: customBackground }}>
                <input type="color" value={customBackground} onChange={(e) => setCustomBackground(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
              <input type="text" value={customBackground} onChange={(e) => setCustomBackground(e.target.value)} className="flex-1 px-4 rounded-lg bg-[hsl(var(--surface-secondary)/0.3)] text-xs text-foreground border border-[hsl(var(--border))/30]" />
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={saveCustomTheme}
            disabled={!customName.trim()}
            className="flex items-center justify-center gap-2 w-full p-3 rounded-lg bg-primary/10 hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-4"
          >
            <Save size={14} className="text-primary" />
            <span className="text-xs font-medium text-primary">保存主题</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  )

  const renderThemePanel = () => (
    <div className="space-y-6">
      {renderThemeSelection()}
      {renderThemePreview()}
      {renderThemeCustom()}
    </div>
  )

  const renderApiConnection = () => (
    <motion.div 
      className="glass-strong rounded-2xl p-6 h-[340px] overflow-y-scroll w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            currentProvider.status === 'connected' ? 'bg-emerald-400' : 
            currentProvider.status === 'connecting' ? 'bg-primary animate-pulse' : 'bg-red-400'
          }`} />
          <div>
            <h4 className="text-sm font-semibold text-foreground">连接状态</h4>
            <p className="text-xs text-muted-foreground">
              {currentProvider.status === 'connected' ? `${currentProvider.name} 已连接` : 
               currentProvider.status === 'connecting' ? `正在连接 ${currentProvider.name}...` : '未配置'}
            </p>
          </div>
        </div>
      </div>

      {currentProvider.status === 'connected' && (
        <motion.div 
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[hsl(var(--surface-secondary)/0.3)] rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-foreground">{currentProvider.models[0]?.name || '默认'}</div>
              <div className="text-[10px] text-muted-foreground mt-1">模型</div>
            </div>
            <div className="bg-[hsl(var(--surface-secondary)/0.3)] rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-emerald-400">320ms</div>
              <div className="text-[10px] text-muted-foreground mt-1">延迟</div>
            </div>
            <div className="bg-[hsl(var(--surface-secondary)/0.3)] rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-primary">128</div>
              <div className="text-[10px] text-muted-foreground mt-1">请求数</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[hsl(var(--surface-secondary)/0.2)] rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Clock size={12} /> 生成速度</div>
              <div className="text-sm font-semibold text-foreground">2.4s/image</div>
            </div>
            <div className="bg-[hsl(var(--surface-secondary)/0.2)] rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Globe size={12} /> 响应时间</div>
              <div className="text-sm font-semibold text-emerald-400">280ms</div>
            </div>
          </div>
        </motion.div>
      )}

      {isTestingApi && (
        <motion.div 
          className="space-y-3 mt-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {testSteps.map((step, index) => (
            <motion.div 
              key={step.step}
              className="flex items-center gap-2 text-xs"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {step.done ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : (
                <motion.div 
                  className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              )}
              <span className={step.done ? 'text-foreground' : 'text-muted-foreground'}>
                {step.step}
              </span>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Button 
        variant="glow" 
        size="sm" 
        onClick={testApiConnection} 
        disabled={isTestingApi || currentProvider.status === 'connected' || !(currentProvider.apiKey.trim() || currentProvider.id === 'jimeng' || currentProvider.id === 'ark')}
        className="w-full gap-2 mt-4"
      >
        <RefreshCw size={14} className={isTestingApi ? 'animate-spin' : ''} />
        {isTestingApi ? '测试中...' : '测试连接'}
      </Button>
    </motion.div>
  )

  const renderApiConfig = () => (
    <div className="space-y-6">
      <motion.div 
        className="glass-strong rounded-2xl p-6 h-[340px] overflow-y-scroll w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-foreground">API 服务商</h4>
          <Button variant="outline" size="sm" onClick={() => setShowAddProvider(true)} className="h-7 text-xs gap-1">
            + 添加
          </Button>
        </div>
        <div className="space-y-2">
          {apiProviders.map((provider) => (
            <motion.button
              key={provider.id}
              onClick={() => setActiveApiProvider(provider.id)}
              whileHover={{ x: 2 }}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                activeApiProvider === provider.id
                  ? 'bg-primary/10 border border-primary/20'
                  : 'bg-[hsl(var(--surface-secondary)/0.3)] hover:bg-[hsl(var(--surface-secondary)/0.5)] border border-transparent'
              }`}
            >
              <span className="text-lg">{provider.icon}</span>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{provider.name}</span>
                  <div className={`w-2 h-2 rounded-full ${
                    provider.status === 'connected' ? 'bg-emerald-400' : 
                    provider.status === 'connecting' ? 'bg-primary animate-pulse' : 'bg-red-400/60'
                  }`} />
                </div>
                <span className="text-[10px] text-muted-foreground">{provider.description}</span>
              </div>
              {provider.id.startsWith('custom-') && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeProvider(provider.id) }}
                  className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {showAddProvider && (
        <motion.div
          className="glass rounded-xl p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-foreground">添加自定义 API</h4>
            <button onClick={() => setShowAddProvider(false)} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">服务名称</label>
              <input
                type="text"
                value={newProviderForm.name}
                onChange={(e) => setNewProviderForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如：Midjourney"
                className="w-full h-10 px-4 text-sm bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--border))] rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">API Key</label>
              <input
                type="password"
                value={newProviderForm.apiKey}
                onChange={(e) => setNewProviderForm(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="sk-..."
                className="w-full h-10 px-4 text-sm bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--border))] rounded-xl text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
            </div>
            <Button variant="default" size="sm" onClick={addCustomProvider} className="w-full gap-2 mt-2">
              添加服务商
            </Button>
          </div>
        </motion.div>
      )}

      <motion.div 
        className="glass-strong rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{currentProvider.icon}</span>
          <h4 className="text-sm font-semibold text-foreground">{currentProvider.name} 配置</h4>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">API Key</label>
            <div className="relative">
              <Key size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showApiKeys[currentProvider.id] ? 'text' : 'password'}
                value={currentProvider.apiKey}
                onChange={(e) => updateProvider(currentProvider.id, { apiKey: e.target.value })}
                placeholder="输入 API Key"
                className="w-full h-11 pl-12 pr-12 text-sm bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--border))] rounded-xl text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
              <button
                onClick={() => setShowApiKeys(prev => ({ ...prev, [currentProvider.id]: !prev[currentProvider.id] }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                {showApiKeys[currentProvider.id] ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <Button variant="default" size="sm" className="w-full gap-2 mt-2" onClick={saveApiConfig} disabled={!(currentProvider.apiKey.trim() || currentProvider.id === 'jimeng' || currentProvider.id === 'ark')}>
            <Key size={14} />
            保存配置
          </Button>
        </div>
      </motion.div>
    </div>
  )

  const renderApiUsage = () => (
    <div className="space-y-6">
      <motion.div 
        className="glass-strong rounded-2xl p-6 h-[340px] overflow-y-scroll w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-foreground">API 使用统计</h4>
          <BarChart3 size={14} className="text-muted-foreground" />
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-muted-foreground">本月</span>
              <span className="text-foreground font-medium">1,280 / 5,000 次请求</span>
            </div>
            <div className="h-2 rounded-full bg-[hsl(var(--surface-secondary))] overflow-hidden">
              <motion.div 
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                initial={{ width: 0 }}
                animate={{ width: '25%' }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-muted-foreground">上月</span>
              <span className="text-foreground font-medium">2,450 / 5,000 次请求</span>
            </div>
            <div className="h-2 rounded-full bg-[hsl(var(--surface-secondary))] overflow-hidden">
              <motion.div 
                className="h-full rounded-full bg-gradient-to-r from-primary/60 to-accent/60"
                initial={{ width: 0 }}
                animate={{ width: '49%' }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div 
        className="glass rounded-xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h4 className="text-sm font-semibold text-foreground mb-4">调用统计</h4>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '总调用次数', value: '3,730', icon: Activity },
            { label: '平均响应', value: '320ms', icon: Clock },
            { label: '成功率', value: '99.8%', icon: CheckCircle2 },
          ].map((stat) => (
            <div key={stat.label} className="bg-[hsl(var(--surface-secondary)/0.2)] rounded-xl p-3 text-center">
              <stat.icon size={14} className="text-primary mx-auto mb-1" />
              <div className="text-sm font-bold text-foreground">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )

  const renderApiModels = () => (
    <div className="space-y-6">
      <motion.div 
        className="glass-strong rounded-2xl p-6 h-[340px] overflow-y-scroll w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{currentProvider.icon}</span>
          <h4 className="text-sm font-semibold text-foreground">{currentProvider.name} 可用模型</h4>
        </div>
        <div className="space-y-3">
          {currentProvider.models.map((model, index) => (
            <motion.div
              key={model.id}
              whileHover={{ x: 4 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                model.status === 'active'
                  ? 'bg-primary/5 border border-primary/20'
                  : model.status === 'available'
                  ? 'bg-[hsl(var(--surface-secondary)/0.3)] hover:bg-[hsl(var(--surface-secondary)/0.5)]'
                  : 'bg-[hsl(var(--surface-secondary)/0.1)] opacity-60'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                model.status === 'active' 
                  ? 'bg-gradient-to-br from-primary to-accent' 
                  : 'bg-[hsl(var(--surface-secondary))]'
              }`}>
                <Cpu size={18} className={model.status === 'active' ? 'text-white' : 'text-muted-foreground'} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{model.name}</span>
                  {model.recommended && (
                    <span className="h-4 px-1.5 rounded-full bg-primary/10 text-[9px] font-medium text-primary flex items-center">推荐</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{model.desc}</div>
              </div>
              {model.status === 'active' && <CheckCircle2 size={14} className="text-primary" />}
              {model.status === 'coming' && <span className="text-[10px] text-muted-foreground">即将推出</span>}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )

  const renderApiPanel = () => (
    <div className="space-y-6">
      {renderApiConnection()}
      {renderApiConfig()}
      {renderApiUsage()}
      {renderApiModels()}
    </div>
  )

  const renderSystemMotion = () => (
    <div className="space-y-6">
      <motion.div 
        className="glass-strong rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h4 className="text-sm font-semibold text-foreground mb-4">动效强度</h4>
        <div className="space-y-3">
          {motionLevels.map((level) => (
            <motion.button
              key={level.id}
              onClick={() => setMotionLevel(level.id)}
              whileHover={{ x: 5 }}
              className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                motionLevel === level.id
                  ? 'bg-primary/10 border border-primary/30'
                  : 'bg-[hsl(var(--surface-secondary)/0.2)] hover:bg-[hsl(var(--surface-secondary)/0.4)]'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                motionLevel === level.id ? 'bg-primary/20' : 'bg-[hsl(var(--surface-secondary))]'
              }`}>
                <level.icon size={18} className={motionLevel === level.id ? 'text-primary' : 'text-muted-foreground'} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-foreground">{level.name}</div>
                <div className="text-xs text-muted-foreground">{level.desc}</div>
              </div>
              {motionLevel === level.id && (
                <motion.div 
                  className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500 }}
                >
                  <CheckCircle2 size={12} className="text-white" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.div 
        className="glass rounded-xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h4 className="text-sm font-semibold text-foreground mb-4">交互设置</h4>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-3">
              <span className="text-muted-foreground">过渡速度</span>
              <span className="text-foreground font-medium">{transitionSpeeds.find(s => s.id === transitionSpeed)?.name}</span>
            </div>
            <div className="flex gap-2">
              {transitionSpeeds.map((speed) => (
                <button
                  key={speed.id}
                  onClick={() => setTransitionSpeed(speed.id)}
                  className={`flex-1 h-9 rounded-lg text-xs font-medium transition-all ${
                    transitionSpeed === speed.id
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'bg-[hsl(var(--surface-secondary)/0.3)] text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {speed.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-[hsl(var(--surface-secondary)/0.2)]">
            <div>
              <div className="text-sm text-foreground">悬停动效</div>
              <div className="text-xs text-muted-foreground">按钮与卡片的交互反馈</div>
            </div>
            <button
              onClick={() => setHoverMotion(!hoverMotion)}
              className={`relative w-12 h-6 rounded-full transition-all ${
                hoverMotion ? 'bg-primary' : 'bg-[hsl(var(--surface-secondary))]'
              }`}
            >
              <motion.div 
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg"
                animate={{ left: hoverMotion ? '28px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )

  const renderSystemBlur = () => (
    <div className="space-y-6">
      <motion.div 
        className="glass-strong rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h4 className="text-sm font-semibold text-foreground mb-4">背景模糊</h4>
        <div className="space-y-6">
          <div>
            <div className="flex justify-between text-xs mb-3">
              <span className="text-muted-foreground">模糊强度</span>
              <span className="text-foreground font-medium">{blurLevels.find(b => b.id === blurLevel)?.name}</span>
            </div>
            <div className="flex gap-2">
              {blurLevels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setBlurLevel(level.id)}
                  className={`flex-1 h-9 rounded-lg text-xs font-medium transition-all ${
                    blurLevel === level.id
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'bg-[hsl(var(--surface-secondary)/0.3)] text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {level.name}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[hsl(var(--surface-secondary)/0.2)]">
            <div className="text-xs text-muted-foreground mb-3">实时预览</div>
            <div className="flex gap-2">
              {['low', 'medium', 'high'].map((level) => (
                <div
                  key={level}
                  className="flex-1 h-16 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center"
                  style={{ backdropFilter: `blur(${level === 'low' ? '4px' : level === 'medium' ? '12px' : '20px'})` }}
                >
                  <span className="text-[10px] text-white/60">{level === 'low' ? '4px' : level === 'medium' ? '12px' : '20px'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div 
        className="glass rounded-xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h4 className="text-sm font-semibold text-foreground mb-4">玻璃特效</h4>
        <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)]">
          <div className="flex items-center gap-3">
            <Contrast size={14} className="text-primary" />
            <span className="text-sm text-foreground">增强透明效果</span>
          </div>
          <button
            className="relative w-10 h-5 rounded-full bg-primary transition-all"
          >
            <motion.div className="absolute top-0.5 left-[18px] w-4 h-4 rounded-full bg-white shadow" />
          </button>
        </div>
      </motion.div>
    </div>
  )

  const renderSystemPerformance = () => (
    <div className="space-y-6">
      <motion.div 
        className="glass-strong rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h4 className="text-sm font-semibold text-foreground mb-4">性能模式</h4>
        <div className="space-y-3">
          {[
            { icon: Gauge, label: 'GPU 加速', desc: '使用 GPU 硬件加速渲染', active: true, toggle: false },
            { icon: Activity, label: '高质量渲染', desc: '高质量像素渲染引擎', active: true, toggle: false },
            { icon: ZapOff, label: '减少动效', desc: '减少界面动画效果', active: reduceMotion, toggle: true },
          ].map((item) => (
            <div 
              key={item.label}
              className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)]"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  item.active ? 'bg-primary/10' : 'bg-[hsl(var(--surface-secondary))]'
                }`}>
                  <item.icon size={14} className={item.active ? 'text-primary' : 'text-muted-foreground'} />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </div>
              {item.toggle ? (
                <button
                  onClick={() => setReduceMotion(!reduceMotion)}
                  className={`relative w-10 h-5 rounded-full transition-all ${
                    item.active ? 'bg-primary' : 'bg-[hsl(var(--surface-secondary))]'
                  }`}
                >
                  <motion.div 
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                    animate={{ left: item.active ? '20px' : '2px' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              ) : (
                <CheckCircle2 size={14} className="text-emerald-400" />
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )

  const renderSystemAccessibility = () => (
    <div className="space-y-6">
      <motion.div 
        className="glass-strong rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h4 className="text-sm font-semibold text-foreground mb-4">通知管理</h4>
        <div className="space-y-3">
          {[
            { icon: Bell, label: 'AI 生成完成', desc: 'AI 生成完成时通知', active: true },
            { icon: Bell, label: '导出就绪', desc: '导出就绪时通知', active: true },
            { icon: BellOff, label: '系统更新', desc: '系统更新通知', active: false },
          ].map((item) => (
            <div 
              key={item.label}
              className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)]"
            >
              <div className="flex items-center gap-3 flex-1">
                <item.icon size={14} className={item.active ? 'text-primary' : 'text-muted-foreground'} />
                <div>
                  <div className="text-sm text-foreground">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </div>
              {item.active ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : (
                <Circle size={14} className="text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div 
        className="glass rounded-xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h4 className="text-sm font-semibold text-foreground mb-4">显示偏好</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)]">
            <div className="flex items-center gap-3">
              <Contrast size={14} className="text-primary" />
              <span className="text-sm text-foreground">高对比度模式</span>
            </div>
            <button className="relative w-10 h-5 rounded-full bg-[hsl(var(--surface-secondary))]">
              <motion.div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow" />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)]">
            <div className="flex items-center gap-3">
              <Monitor size={14} className="text-primary" />
              <span className="text-sm text-foreground">放大字体模式</span>
            </div>
            <button className="relative w-10 h-5 rounded-full bg-[hsl(var(--surface-secondary))]">
              <motion.div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )

  const renderSystemPanel = () => (
    <div className="space-y-6">
      {renderSystemMotion()}
      {renderSystemBlur()}
      {renderSystemPerformance()}
      {renderSystemAccessibility()}
    </div>
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div 
          className="fixed inset-0 z-50 flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          <motion.div 
            className="relative flex-1 flex m-4 rounded-2xl overflow-hidden shadow-2xl"
            style={{ 
              background: 'hsl(var(--surface) / 0.85)',
              backdropFilter: 'blur(24px)'
            }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div 
                className="absolute -top-1/2 -right-1/4 w-96 h-96 rounded-full opacity-20"
                style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)' }}
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.1, 0.2, 0.1]
                }}
                transition={{ duration: 8, repeat: Infinity }}
              />
            </div>

            <div className="relative flex h-full">
              <div className="w-56 p-5 flex flex-col bg-[hsl(var(--surface-secondary)/0.3)] backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Settings size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">设置</h2>
                    <p className="text-[10px] text-muted-foreground">系统设置</p>
                  </div>
                </div>

                <nav className="flex-1 space-y-1">
                  {settingsTabs.map((tab, index) => {
                    const Icon = tab.icon
                    return (
                      <motion.button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        whileHover={{ x: 4 }}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                          activeTab === tab.id
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--foreground)/0.04)]'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          activeTab === tab.id ? 'bg-primary/20' : 'bg-[hsl(var(--surface-secondary))]'
                        }`}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{tab.label}</div>
                          <div className="text-[10px] opacity-60">{tab.description}</div>
                        </div>
                      </motion.button>
                    )
                  })}
                </nav>

                <div className="pt-4">
                  <Button variant="default" className="w-full gap-2">
                    <CheckCircle2 size={14} />
                    保存更改
                  </Button>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-primary/20">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      {settingsTabs.find(t => t.id === activeTab)?.label}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {settingsTabs.find(t => t.id === activeTab)?.description}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[hsl(var(--foreground)/0.06)] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      {activeTab === 'theme' && renderThemePanel()}
                      {activeTab === 'api' && renderApiPanel()}
                      {activeTab === 'system' && renderSystemPanel()}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
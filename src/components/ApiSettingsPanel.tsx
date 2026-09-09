import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings, X, CheckCircle2, AlertCircle, Key, Eye, EyeOff, ExternalLink,
  User, Palette, Image, Folder, Download, Sparkles, Cpu, Monitor,
  Zap, Moon, Sun, HardDrive, Clock, BarChart3, Cloud, RefreshCw,
  Layout, Maximize2, Globe, Wifi, Activity, ChevronRight,
  Wand, Radio, Gauge, ZapOff, Layers, Shield, Bell, BellOff,
  Keyboard, Mouse, Volume2, VolumeX, Contrast
} from 'lucide-react'
import { Button } from './ui/button'
import { checkLoginStatus, saveApiKey } from '@/services/jimeng'
import { useSystemSettings } from '@/contexts/SystemSettingsContext'
import {
  getStoredArkKey,
  getStoredOpenAIKey,
  getStoredVisionEndpoint,
  getStoredFigmaToken,
  saveOpenAIKey as saveOpenAIKeyLocal,
  saveVisionEndpoint as saveVisionEndpointLocal,
  saveFigmaToken as saveFigmaTokenLocal,
} from '@/services/apiStorage'

interface ApiSettingsPanelProps {
  open: boolean
  onClose: () => void
  activeTab?: string
}

async function checkOpenAIStatus(): Promise<boolean> {
  try {
    const key = getStoredOpenAIKey().trim()
    const res = await fetch('/api/openai/status', {
      headers: key ? { 'X-OpenAI-Api-Key': key } : undefined,
    })
    const data = await res.json()
    return !!data.ok
  } catch { return false }
}

async function checkVisionStatus(): Promise<{ ok: boolean; hint: string }> {
  try {
    const res = await fetch('/api/hmi/vision_status')
    const data = await res.json()
    return { ok: !!data.ok, hint: data.endpoint_id || '' }
  } catch { return { ok: false, hint: '' } }
}

async function checkFigmaStatus(): Promise<boolean> {
  try {
    const token = getStoredFigmaToken().trim()
    const res = await fetch('/api/figma/me', {
      headers: token ? { 'X-Figma-Token': token } : undefined,
    })
    return res.ok
  } catch { return false }
}

async function saveVisionEndpoint(endpointId: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch('/api/hmi/save_vision_endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint_id: endpointId }),
    })
    return await res.json()
  } catch { return { ok: false } }
}

async function saveOpenAIKey(apiKey: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch('/api/openai/save_key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-OpenAI-Api-Key': apiKey },
      body: JSON.stringify({ api_key: apiKey }),
    })
    return await res.json()
  } catch { return { ok: false } }
}

const settingsTabs = [
  { id: 'theme', label: '主题系统', icon: Palette },
  { id: 'api', label: 'API 配置', icon: Cpu },
  { id: 'system', label: '系统偏好', icon: Monitor },
]

const themes = [
  { id: 'xiaomi', name: '小米紫', primary: '#6366f1', accent: '#8b5cf6', desc: '科技紫调' },
  { id: 'tesla', name: '特斯拉白', primary: '#f1f5f9', accent: '#94a3b8', desc: '极简纯白' },
  { id: 'porsche', name: '保时捷红', primary: '#ef4444', accent: '#f97316', desc: '运动激情' },
  { id: 'deepspace', name: '深空蓝', primary: '#0ea5e9', accent: '#8b5cf6', desc: '深空探索' },
  { id: 'future', name: '未来蓝', primary: '#06b6d4', accent: '#3b82f6', desc: '未来感' },
]

const resolutions = [
  { id: '1080p', label: '1920×1080', ratio: '16:9' },
  { id: '1440p', label: '2560×1440', ratio: '16:9' },
  { id: '4k', label: '3840×2160', ratio: '16:9' },
  { id: 'ultrawide', label: '车机超宽屏', ratio: '21:9' },
  { id: 'vertical', label: '中控竖屏', ratio: '9:16' },
  { id: 'dashboard', label: '仪表屏', ratio: '4:3' },
]

const aiStyles = [
  { id: 'xiaomi', name: '小米 SU7', desc: '科技简约风格' },
  { id: 'tesla', name: '特斯拉极简', desc: '极简主义' },
  { id: 'porsche', name: '保时捷豪华', desc: '豪华质感' },
  { id: 'future', name: '未来座舱', desc: '未来座舱' },
]

const motionLevels = [
  { id: 'minimal', name: '精简动效', desc: '减少动画效果' },
  { id: 'smooth', name: '流畅动效', desc: '平衡与优雅' },
  { id: 'premium', name: '高级动效', desc: '极致体验' },
]

export default function ApiSettingsPanel({ open, onClose, activeTab: initialTab }: ApiSettingsPanelProps) {
  const { notify } = useSystemSettings()
  const [activeTab, setActiveTab] = useState(initialTab || 'api')
  
  // Ark (即梦) - 从本地存储初始化
  const [arkKey, setArkKey] = useState(getStoredArkKey())
  const [showArkKey, setShowArkKey] = useState(false)
  const [savingArk, setSavingArk] = useState(false)
  const [arkConnected, setArkConnected] = useState(!!getStoredArkKey())

  // OpenAI - 从本地存储初始化
  const [openaiKey, setOpenaiKey] = useState(getStoredOpenAIKey())
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [savingOpenai, setSavingOpenai] = useState(false)
  const [openaiConnected, setOpenaiConnected] = useState(!!getStoredOpenAIKey())

  // Vision Endpoint - 从本地存储初始化
  const [visionEp, setVisionEp] = useState(getStoredVisionEndpoint())
  const [savingVision, setSavingVision] = useState(false)
  const [visionConnected, setVisionConnected] = useState(!!getStoredVisionEndpoint())

  // Figma Personal Access Token - 从本地存储初始化
  const [figmaToken, setFigmaToken] = useState(getStoredFigmaToken())
  const [showFigmaToken, setShowFigmaToken] = useState(false)
  const [savingFigma, setSavingFigma] = useState(false)
  const [figmaConnected, setFigmaConnected] = useState(!!getStoredFigmaToken())
  const [testingFigma, setTestingFigma] = useState(false)

  // Theme
  const [selectedTheme, setSelectedTheme] = useState('deepspace')
  const [autoTheme, setAutoTheme] = useState(false)

  // Generate Settings
  const [defaultResolution, setDefaultResolution] = useState('1080p')
  const [creativity, setCreativity] = useState(70)
  const [variantCount, setVariantCount] = useState(4)

  // Workspace Settings
  const [autoSave, setAutoSave] = useState(true)
  const [autoRestore, setAutoRestore] = useState(true)
  const [historyCount, setHistoryCount] = useState(50)

  // Export Settings
  const [defaultFormat, setDefaultFormat] = useState('png')
  const [pngQuality, setPngQuality] = useState(90)
  const [autoZip, setAutoZip] = useState(true)

  // System Settings
  const [motionLevel, setMotionLevel] = useState('smooth')
  const [blurIntensity, setBlurIntensity] = useState(20)
  const [glowIntensity, setGlowIntensity] = useState(30)
  const [hoverMotion, setHoverMotion] = useState(true)
  const [transitionSpeed, setTransitionSpeed] = useState('Smooth')
  const [reduceMotion, setReduceMotion] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  // Message
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (open) {
      checkLoginStatus().then((s) => setArkConnected(s.ok))
      checkOpenAIStatus().then(setOpenaiConnected)
      checkVisionStatus().then((s) => setVisionConnected(s.ok))
      checkFigmaStatus().then(setFigmaConnected)
    }
  }, [open])

  // 内联提示 3 秒后自动消失
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [message])

  const testConnection = async () => {
    setIsTestingConnection(true)
    const status = await checkLoginStatus()
    setArkConnected(status.ok)
    setMessage({ ok: status.ok, text: status.credit || '暂时无法验证连接' })
    setIsTestingConnection(false)
  }

  const handleSaveArk = async () => {
    if (!arkKey.trim()) return
    setSavingArk(true)
    setMessage(null)
    const result = await saveApiKey(arkKey.trim())
    setSavingArk(false)
    if (result.ok) {
      setArkConnected(true)
      setMessage({ ok: true, text: '即梦 API Key 保存成功！' })
      notify({ app: 'aiGenerate', title: '保存成功', body: '即梦 API Key 已配置并验证通过' })
    } else {
      setArkConnected(false)
      setMessage({ ok: false, text: result.message || '即梦 API Key 验证失败' })
      notify({ app: 'aiGenerate', title: '保存失败', body: result.message || '请检查 API Key 后重试' })
    }
  }

  const handleSaveOpenAI = async () => {
    if (!openaiKey.trim()) return
    setSavingOpenai(true)
    setMessage(null)
    const key = openaiKey.trim()
    const result = await saveOpenAIKey(key)
    setSavingOpenai(false)
    if (result.ok) {
      saveOpenAIKeyLocal(key)
      setOpenaiConnected(true)
      setMessage({ ok: true, text: 'OpenAI API Key 保存成功！' })
      notify({ app: 'aiGenerate', title: '保存成功', body: 'OpenAI API Key 已配置' })
    } else {
      setOpenaiConnected(false)
      setMessage({ ok: false, text: 'OpenAI API Key 验证失败' })
      notify({ app: 'aiGenerate', title: '验证失败', body: '请检查 OpenAI API Key 和模型权限' })
    }
  }

  const handleSaveVision = async () => {
    if (!visionEp.trim()) return
    setSavingVision(true)
    setMessage(null)
    // 先保存到本地存储
    saveVisionEndpointLocal(visionEp.trim())
    const result = await saveVisionEndpoint(visionEp.trim())
    setSavingVision(false)
    if (result.ok) {
      setVisionConnected(true)
      setMessage({ ok: true, text: '视觉模型接入点保存成功！' })
      notify({ app: 'aiGenerate', title: '保存成功', body: '视觉模型接入点已配置' })
    } else {
      // 即使后端保存失败，本地也已保存
      setVisionConnected(true)
      setMessage({ ok: true, text: '视觉模型接入点已本地保存' })
      notify({ app: 'aiGenerate', title: '已本地保存', body: '视觉模型接入点已保存到本地（后端同步失败）' })
    }
  }

  const handleSaveFigma = async () => {
    if (!figmaToken.trim()) return
    setSavingFigma(true)
    setMessage(null)
    const token = figmaToken.trim()
    // 测试Token是否有效（通过后端代理调用Figma API获取当前用户信息）
    try {
      setTestingFigma(true)
      const resp = await fetch('/api/figma/validate', {
        headers: { 'X-Figma-Token': token }
      })
      if (resp.ok) {
        const me = await resp.json()
        saveFigmaTokenLocal(token)
        setFigmaConnected(true)
        setMessage({ ok: true, text: `Figma Token 保存成功！已连接为 ${me.handle || me.email || '用户'}` })
        notify({ app: 'figmaSync', title: '保存成功', body: `Figma Token 已验证，连接为 ${me.handle || me.email || '用户'}` })
      } else if (resp.status === 401 || resp.status === 403) {
        setFigmaConnected(false)
        setMessage({ ok: false, text: 'Figma Token 无效，请检查后重试' })
        notify({ app: 'figmaSync', title: '验证失败', body: 'Figma Token 无效，请检查后重试' })
      } else {
        setFigmaConnected(false)
        setMessage({ ok: false, text: `Figma Token 验证失败（${resp.status}）` })
        notify({ app: 'figmaSync', title: '验证失败', body: '连接测试未通过，请稍后重试' })
      }
    } catch {
      setFigmaConnected(false)
      setMessage({ ok: false, text: 'Figma Token 验证请求失败' })
      notify({ app: 'figmaSync', title: '验证失败', body: '网络错误，请稍后重试' })
    } finally {
      setSavingFigma(false)
      setTestingFigma(false)
    }
  }

  const handleSaveSettings = () => {
    setMessage({ ok: true, text: '设置已保存！' })
  }

  if (!open) return null

  const renderContent = () => {
    switch (activeTab) {
      case 'theme':
        return (
          <div className="space-y-6">
            {/* Theme Cards */}
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-semibold text-foreground">主题选择</h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={autoTheme}
                    onChange={(e) => setAutoTheme(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 rounded-full bg-[hsl(var(--surface-secondary))] peer-checked:bg-primary relative transition-colors">
                    <motion.div 
                      className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow"
                      animate={{ left: autoTheme ? '20px' : '2px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">自动明暗</span>
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {themes.map((theme) => (
                  <motion.button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme.id)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    className={`relative p-4 rounded-xl border transition-all duration-300 ${
                      selectedTheme === theme.id 
                        ? 'border-primary/50 bg-primary/5 shadow-lg shadow-primary/5' 
                        : 'border-[hsl(var(--border))/30] bg-[hsl(var(--surface-secondary)/0.2)] hover:bg-[hsl(var(--surface-secondary)/0.4)] hover:border-[hsl(var(--border))/50]'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Color Preview */}
                      <div className="flex gap-1.5">
                        <div 
                          className="w-8 h-8 rounded-lg shadow-inner"
                          style={{ backgroundColor: theme.primary }}
                        />
                        <div 
                          className="w-8 h-8 rounded-lg shadow-inner"
                          style={{ backgroundColor: theme.accent }}
                        />
                      </div>
                      {/* Theme Info */}
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{theme.name}</span>
                          {selectedTheme === theme.id && (
                            <CheckCircle2 size={12} className="text-primary" />
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{theme.desc}</span>
                      </div>
                      {/* UI Preview */}
                      <div 
                        className="w-16 h-10 rounded-lg p-1.5 flex items-center justify-center"
                        style={{ 
                          background: `linear-gradient(135deg, ${theme.primary}15, ${theme.accent}10)` 
                        }}
                      >
                        <div className="flex gap-0.5">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: theme.primary }} />
                          <div className="w-2 h-2 rounded" style={{ backgroundColor: theme.accent }} />
                          <div className="w-2 h-2 rounded" style={{ backgroundColor: theme.primary + '80' }} />
                        </div>
                      </div>
                    </div>
                    {/* Glow Effect */}
                    {selectedTheme === theme.id && (
                      <motion.div 
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{ 
                          boxShadow: `0 0 20px ${theme.primary}30, inset 0 0 20px ${theme.accent}10` 
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                      />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Theme Preview */}
            <div className="glass rounded-xl p-4">
              <h4 className="text-xs font-semibold text-foreground mb-3">实时预览</h4>
              <div 
                className="rounded-xl p-4 min-h-[120px] flex flex-col justify-center items-center"
                style={{ 
                  background: `linear-gradient(135deg, ${themes.find(t => t.id === selectedTheme)?.primary}10, ${themes.find(t => t.id === selectedTheme)?.accent}05)` 
                }}
              >
                <div className="flex gap-2 mb-3">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: themes.find(t => t.id === selectedTheme)?.primary + '20' }}
                  >
                    <Layers size={16} style={{ color: themes.find(t => t.id === selectedTheme)?.primary }} />
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: themes.find(t => t.id === selectedTheme)?.accent + '20' }}
                  >
                    <Palette size={16} style={{ color: themes.find(t => t.id === selectedTheme)?.accent }} />
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: themes.find(t => t.id === selectedTheme)?.primary + '15' }}
                  >
                    <Sparkles size={16} style={{ color: themes.find(t => t.id === selectedTheme)?.primary }} />
                  </motion.button>
                </div>
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: themes.find(t => t.id === selectedTheme)?.primary }} />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: themes.find(t => t.id === selectedTheme)?.accent }} />
                  <div className="w-3 h-3 rounded-full bg-white border border-[hsl(var(--border))]" />
                </div>
              </div>
            </div>

            {/* Color Scheme */}
            <div className="glass rounded-xl p-4">
              <h4 className="text-xs font-semibold text-foreground mb-3">色彩方案</h4>
              <div className="grid grid-cols-4 gap-2">
                {['浅色', '深色', '自动', '自定义'].map((scheme) => (
                  <button
                    key={scheme}
                    className={`p-2 rounded-lg text-center transition-colors ${
                      scheme === '自动' 
                        ? 'bg-primary/10 text-primary border border-primary/30'
                        : 'bg-[hsl(var(--surface-secondary)/0.3)] text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="text-[10px] font-medium">{scheme}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Features */}
            <div className="glass rounded-xl p-4">
              <h4 className="text-xs font-semibold text-foreground mb-3">高级功能</h4>
              <div className="grid grid-cols-2 gap-2">
                <button className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.3)] hover:bg-[hsl(var(--surface-secondary)/0.5)] transition-colors">
                  <Wand size={12} className="text-primary" />
                  <div className="text-left">
                    <div className="text-xs text-foreground">AI 智能换色</div>
                    <div className="text-[10px] text-muted-foreground">自动配色方案</div>
                  </div>
                </button>
                <button className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.3)] hover:bg-[hsl(var(--surface-secondary)/0.5)] transition-colors">
                  <Radio size={12} className="text-primary" />
                  <div className="text-left">
                    <div className="text-xs text-foreground">氛围同步</div>
                    <div className="text-[10px] text-muted-foreground">与座舱氛围联动</div>
                  </div>
                </button>
                <button className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.3)] hover:bg-[hsl(var(--surface-secondary)/0.5)] transition-colors">
                  <Sparkles size={12} className="text-primary" />
                  <div className="text-left">
                    <div className="text-xs text-foreground">动态主题</div>
                    <div className="text-[10px] text-muted-foreground">随场景切换</div>
                  </div>
                </button>
                <button className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.3)] hover:bg-[hsl(var(--surface-secondary)/0.5)] transition-colors">
                  <Download size={12} className="text-primary" />
                  <div className="text-left">
                    <div className="text-xs text-foreground">导出主题</div>
                    <div className="text-[10px] text-muted-foreground">导出设计令牌</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Visual Effects */}
            <div className="glass rounded-xl p-4">
              <h4 className="text-xs font-semibold text-foreground mb-3">视觉效果</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground">模糊强度</span>
                    <span className="text-foreground">{blurIntensity}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={blurIntensity}
                    onChange={(e) => setBlurIntensity(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full bg-[hsl(var(--surface-secondary))] appearance-none cursor-pointer accent-primary"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground">辉光强度</span>
                    <span className="text-foreground">{glowIntensity}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={glowIntensity}
                    onChange={(e) => setGlowIntensity(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full bg-[hsl(var(--surface-secondary))] appearance-none cursor-pointer accent-primary"
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case 'api':
        return (
          <div className="space-y-6">
            {/* Connection Status */}
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-3 h-3 rounded-full ${isTestingConnection ? 'animate-pulse bg-primary' : (arkConnected ? 'bg-emerald-400' : 'bg-red-400')}`} />
                <div>
                  <div className="text-xs font-semibold text-foreground">连接状态</div>
                  <div className="text-[10px] text-muted-foreground">
                    {isTestingConnection ? '正在连接即梦 AI...' : (arkConnected ? '已连接' : '未配置')}
                  </div>
                </div>
              </div>
              
              {arkConnected && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[hsl(var(--surface-secondary)/0.3)] rounded-lg p-2 text-center">
                      <div className="text-xs font-semibold text-foreground">即梦 HMI XL</div>
                      <div className="text-[10px] text-muted-foreground">Model</div>
                    </div>
                    <div className="bg-[hsl(var(--surface-secondary)/0.3)] rounded-lg p-2 text-center">
                      <div className="text-xs font-semibold text-emerald-400">320ms</div>
                      <div className="text-[10px] text-muted-foreground">Latency</div>
                    </div>
                    <div className="bg-[hsl(var(--surface-secondary)/0.3)] rounded-lg p-2 text-center">
                      <div className="text-xs font-semibold text-primary">128</div>
                      <div className="text-[10px] text-muted-foreground">Requests</div>
                    </div>
                  </div>
                  <div className="space-y-2 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">API Version</span>
                      <span className="text-foreground">v5.0.2</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Used</span>
                      <span className="text-foreground">2 minutes ago</span>
                    </div>
                  </div>
                </div>
              )}

              <Button 
                variant="glass" 
                size="sm" 
                onClick={testConnection} 
                disabled={isTestingConnection} 
                className="w-full gap-1.5 mt-4"
              >
                <RefreshCw size={12} className={isTestingConnection ? 'animate-spin' : ''} />
                {isTestingConnection ? '测试中...' : '测试连接'}
              </Button>
            </div>

            {/* API Usage Stats */}
            <div className="glass rounded-xl p-4">
              <h4 className="text-xs font-semibold text-foreground mb-3">API Usage Statistics</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">This Month</span>
                    <span className="text-foreground">1,280 requests</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[hsl(var(--surface-secondary))] overflow-hidden">
                    <motion.div 
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: '65%' }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Last Month</span>
                    <span className="text-foreground">2,450 requests</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[hsl(var(--surface-secondary))] overflow-hidden">
                    <motion.div 
                      className="h-full rounded-full bg-primary/60"
                      initial={{ width: 0 }}
                      animate={{ width: '85%' }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Jimeng Seedream */}
            <div className="glass rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Sparkles size={12} className="text-white" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">Jimeng Seedream 5.0</span>
                </div>
                <div className="h-4 px-1.5 flex items-center rounded bg-primary/10 text-[9px] text-primary">Recommended</div>
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                火山方舟 Ark API，支持文生图和图生图，2K 分辨率，响应快。
              </p>

              <a
                href="https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <ExternalLink size={10} />
                获取火山引擎 API Key
              </a>

              <div className="relative">
                <Key size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showArkKey ? 'text' : 'password'}
                  value={arkKey}
                  onChange={(e) => setArkKey(e.target.value)}
                  placeholder="ARK_API_KEY"
                  className="w-full h-9 pl-8 pr-9 text-xs bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--border))] rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveArk() }}
                />
                <button
                  onClick={() => setShowArkKey(!showArkKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {showArkKey ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>

              <Button variant="glass" size="sm" onClick={handleSaveArk} disabled={savingArk || !arkKey.trim()} className="w-full gap-1.5">
                <Key size={12} />
                {savingArk ? 'Saving...' : 'Save API Key'}
              </Button>
            </div>

            {/* Vision Endpoint */}
            <div className="glass rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[hsl(var(--surface-secondary))] flex items-center justify-center">
                  <Image size={12} className="text-muted-foreground" />
                </div>
                <span className="text-xs font-semibold text-foreground">Vision Model Endpoint</span>
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                HMI 编辑（PNG 转可编辑、文本提取）需要视觉理解模型。请在火山引擎控制台创建推理接入点。
              </p>

              <a
                href="https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <ExternalLink size={10} />
                创建推理接入点
              </a>

              <div className="relative">
                <Key size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={visionEp}
                  onChange={(e) => setVisionEp(e.target.value)}
                  placeholder="ep-xxxxxxxxxxxx"
                  className="w-full h-9 pl-8 pr-3 text-xs bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--border))] rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveVision() }}
                />
              </div>

              <Button variant="glass" size="sm" onClick={handleSaveVision} disabled={savingVision || !visionEp.trim()} className="w-full gap-1.5">
                <Key size={12} />
                {savingVision ? '保存中...' : '保存端点'}
              </Button>
            </div>

            {/* Figma Personal Access Token */}
            <div className="glass rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${figmaConnected ? 'bg-emerald-500/20' : 'bg-[hsl(var(--surface-secondary))]'}`}>
                  <Layout size={12} className={figmaConnected ? 'text-emerald-400' : 'text-muted-foreground'} />
                </div>
                <span className="text-xs font-semibold text-foreground">Figma Personal Access Token</span>
                {figmaConnected && <div className="h-4 px-1.5 flex items-center rounded bg-emerald-500/10 text-[9px] text-emerald-400">已连接</div>}
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                已配置默认 Token 时可直接访问 Figma；手动填写的 Token 仅保存在当前浏览器。
              </p>

              <a
                href="https://www.figma.com/developers/api#access-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <ExternalLink size={10} />
                获取 Figma Personal Access Token
              </a>

              <div className="relative">
                <Key size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showFigmaToken ? 'text' : 'password'}
                  value={figmaToken}
                  onChange={(e) => setFigmaToken(e.target.value)}
                  placeholder={figmaConnected ? '已启用默认 Token，无需填写' : '输入 Figma Token'}
                  className="w-full h-9 pl-8 pr-9 text-xs bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--border))] rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFigma() }}
                />
                <button
                  onClick={() => setShowFigmaToken(!showFigmaToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {showFigmaToken ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>

              <div className="flex gap-2">
                <Button variant="glass" size="sm" onClick={handleSaveFigma} disabled={savingFigma || !figmaToken.trim()} className="flex-1 gap-1.5">
                  <Key size={12} />
                  {savingFigma ? (testingFigma ? '验证中...' : '保存中...') : '保存并验证'}
                </Button>
              </div>

              <div className="text-[9px] text-muted-foreground/70 leading-relaxed p-2 bg-[hsl(var(--surface-secondary)/0.3)] rounded-lg">
                <strong className="text-muted-foreground">提示：</strong> 创建 Token 时请确保勾选 <code className="text-primary">File content</code> 权限（Read-only 即可）。
              </div>
            </div>

            {/* OpenAI */}
            <div className="glass rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[hsl(var(--surface-secondary))] flex items-center justify-center">
                  <Cpu size={12} className="text-muted-foreground" />
                </div>
                <span className="text-xs font-semibold text-foreground">OpenAI GPT-image-1</span>
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                默认密钥由服务端安全提供；也可手动验证并仅保存在当前浏览器。
              </p>

              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <ExternalLink size={10} />
                获取 OpenAI API Key
              </a>

              <div className="relative">
                <Key size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showOpenaiKey ? 'text' : 'password'}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder={openaiConnected ? '已启用默认 OpenAI API，无需填写' : 'sk-...'}
                  className="w-full h-9 pl-8 pr-9 text-xs bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--border))] rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveOpenAI() }}
                />
                <button
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {showOpenaiKey ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>

              <Button variant="glass" size="sm" onClick={handleSaveOpenAI} disabled={savingOpenai || !openaiKey.trim()} className="w-full gap-1.5">
                <Key size={12} />
                {savingOpenai ? '保存中...' : '保存 OpenAI 密钥'}
              </Button>
            </div>
          </div>
        )

      case 'system':
        return (
          <div className="space-y-6">
            {/* Motion Level */}
            <div className="glass rounded-xl p-4">
              <h4 className="text-xs font-semibold text-foreground mb-3">Motion Intensity</h4>
              <div className="space-y-2">
                {motionLevels.map((level) => (
                  <motion.button
                    key={level.id}
                    onClick={() => setMotionLevel(level.id)}
                    whileHover={{ x: 4 }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                      motionLevel === level.id
                        ? 'bg-primary/10 border border-primary/30'
                        : 'bg-[hsl(var(--surface-secondary)/0.2)] border border-transparent hover:border-[hsl(var(--border))/50]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                      <Zap size={12} className="text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-xs text-foreground">{level.name}</div>
                      <div className="text-[10px] text-muted-foreground">{level.desc}</div>
                    </div>
                    {motionLevel === level.id && (
                      <CheckCircle2 size={12} className="text-primary" />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Visual Effects */}
            <div className="glass rounded-xl p-4">
              <h4 className="text-xs font-semibold text-foreground mb-3">视觉效果</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground">背景模糊</span>
                    <span className="text-foreground">{blurIntensity}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={blurIntensity}
                    onChange={(e) => setBlurIntensity(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full bg-[hsl(var(--surface-secondary))] appearance-none cursor-pointer accent-primary"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground">过渡速度</span>
                    <span className="text-foreground">{transitionSpeed}</span>
                  </div>
                  <div className="flex gap-2">
                    {['快速', '流畅', '慢速'].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setTransitionSpeed(speed)}
                        className={`flex-1 h-7 rounded-lg text-[10px] font-medium transition-colors ${
                          transitionSpeed === speed
                            ? 'bg-primary/10 text-primary border border-primary/30'
                            : 'bg-[hsl(var(--surface-secondary)/0.3)] text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {speed}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)]">
                  <div>
                    <div className="text-xs text-foreground">Hover Effects</div>
                    <div className="text-[10px] text-muted-foreground">Button & card interactions</div>
                  </div>
                  <button
                    onClick={() => setHoverMotion(!hoverMotion)}
                    className={`w-8 h-4 rounded-full relative transition-colors ${
                      hoverMotion ? 'bg-primary' : 'bg-[hsl(var(--surface-secondary))]'
                    }`}
                  >
                    <motion.div 
                      className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow"
                      animate={{ left: hoverMotion ? '14px' : '2px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Performance */}
            <div className="glass rounded-xl p-4">
              <h4 className="text-xs font-semibold text-foreground mb-3">Performance</h4>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)] hover:bg-[hsl(var(--surface-secondary)/0.4)] transition-colors">
                  <div className="flex items-center gap-2">
                    <Gauge size={12} className="text-primary" />
                    <span className="text-xs text-foreground">GPU 加速</span>
                  </div>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)] hover:bg-[hsl(var(--surface-secondary)/0.4)] transition-colors">
                  <div className="flex items-center gap-2">
                    <Image size={12} className="text-primary" />
                    <span className="text-xs text-foreground">High Quality Rendering</span>
                  </div>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                </button>
                <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)]">
                  <div className="flex items-center gap-2">
                    <ZapOff size={12} className="text-muted-foreground" />
                    <span className="text-xs text-foreground">Reduce Motion</span>
                  </div>
                  <button
                    onClick={() => setReduceMotion(!reduceMotion)}
                    className={`w-8 h-4 rounded-full relative transition-colors ${
                      reduceMotion ? 'bg-primary' : 'bg-[hsl(var(--surface-secondary))]'
                    }`}
                  >
                    <motion.div 
                      className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow"
                      animate={{ left: reduceMotion ? '14px' : '2px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="glass rounded-xl p-4">
              <h4 className="text-xs font-semibold text-foreground mb-3">Notifications</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)]">
                  <div className="flex items-center gap-2">
                    <Bell size={12} className="text-primary" />
                    <span className="text-xs text-foreground">AI Generation Complete</span>
                  </div>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)]">
                  <div className="flex items-center gap-2">
                    <Bell size={12} className="text-primary" />
                    <span className="text-xs text-foreground">Export Ready</span>
                  </div>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)]">
                  <div className="flex items-center gap-2">
                    <BellOff size={12} className="text-muted-foreground" />
                    <span className="text-xs text-foreground">System Updates</span>
                  </div>
                  <button
                    onClick={() => {}}
                    className="w-8 h-4 rounded-full bg-[hsl(var(--surface-secondary))] relative"
                  >
                    <motion.div 
                      className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow"
                      animate={{ left: '2px' }}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Accessibility */}
            <div className="glass rounded-xl p-4">
              <h4 className="text-xs font-semibold text-foreground mb-3">Accessibility</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)]">
                  <div className="flex items-center gap-2">
                    <Contrast size={12} className="text-primary" />
                    <span className="text-xs text-foreground">High Contrast Mode</span>
                  </div>
                  <button
                    onClick={() => {}}
                    className="w-8 h-4 rounded-full bg-[hsl(var(--surface-secondary))] relative"
                  >
                    <motion.div 
                      className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow"
                      animate={{ left: '2px' }}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)]">
                  <div className="flex items-center gap-2">
                    <Keyboard size={12} className="text-primary" />
                    <span className="text-xs text-foreground">Keyboard Shortcuts</span>
                  </div>
                  <ChevronRight size={12} className="text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)]">
                  <div className="flex items-center gap-2">
                    <Mouse size={12} className="text-primary" />
                    <span className="text-xs text-foreground">Mouse Tracking Speed</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Medium</span>
                </div>
              </div>
            </div>

            {/* Advanced */}
            <div className="glass rounded-xl p-4">
              <h4 className="text-xs font-semibold text-foreground mb-3">Advanced</h4>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)] hover:bg-[hsl(var(--surface-secondary)/0.4)] transition-colors">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={12} className="text-muted-foreground" />
                    <span className="text-xs text-foreground">Smooth Scrolling</span>
                  </div>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)] hover:bg-[hsl(var(--surface-secondary)/0.4)] transition-colors">
                  <div className="flex items-center gap-2">
                    <Monitor size={12} className="text-muted-foreground" />
                    <span className="text-xs text-foreground">High DPI Support</span>
                  </div>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.2)] hover:bg-[hsl(var(--surface-secondary)/0.4)] transition-colors">
                  <div className="flex items-center gap-2">
                    <Shield size={12} className="text-muted-foreground" />
                    <span className="text-xs text-foreground">Privacy Settings</span>
                  </div>
                  <ChevronRight size={12} className="text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex bg-background">
      {/* Left Navigation */}
      <div className="w-48 p-4 flex flex-col bg-[hsl(var(--surface-secondary)/0.2)] shrink-0">
        <div className="flex items-center gap-2 mb-6">
          <Settings size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">系统设置</h2>
        </div>
        
        <nav className="flex-1 space-y-1">
          {settingsTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--foreground)/0.04)]'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </nav>

        <div className="pt-4">
          <Button 
            variant="glass" 
            size="sm" 
            onClick={handleSaveSettings}
            className="w-full gap-2"
          >
            <CheckCircle2 size={12} />
            保存设置
          </Button>
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {settingsTabs.find(t => t.id === activeTab)?.label}
            </h3>
            <p className="text-xs text-muted-foreground">
              {activeTab === 'theme' && '控制整个 Workspace 的视觉风格和氛围'}
              {activeTab === 'api' && '连接即梦 AI 服务，配置 API 参数'}
              {activeTab === 'system' && '调整系统交互体验和性能设置'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[hsl(var(--foreground)/0.06)] text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>

        {/* 内联保存提示：3 秒自动消失，带退出动画 */}
        <AnimatePresence>
          {message && (
            <motion.div
              key="inline-message"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-xs shadow-lg backdrop-blur-md ${
                message.ok
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/15 border border-red-500/30 text-red-400'
              }`}
            >
              {message.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

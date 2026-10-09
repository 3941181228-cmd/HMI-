import { useEffect, useMemo, useRef, useState } from 'react'
import { generateHmiPng, defaultPngProvider, PNG_PROVIDERS, type PngProvider } from '@/services/hmiPng'
import { motion } from 'framer-motion'
import {
  Boxes,
  Check,
  Clipboard,
  ExternalLink,
  ImagePlus,
  Layers,
  Link2,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { Button } from './ui/button'
import {
  buildCodexHMIPrompt,
  extractCodexHMIUserRequest,
  HMI_QUICK_PROMPTS,
  HMI_SCENARIOS,
  HMI_STYLE_PRESETS,
} from '@/skills/hmi-studio'
import {
  designToCodexMcpPrompt,
  generateCodexFigmaDesign,
  isValidFigmaDesignUrl,
  isValidFigmaLibraryUrl,
  type CodexFigmaDesign,
  type CodexFigmaNode,
} from '@/services/codexFigma'

const SIZE_PRESETS = [
  { label: '车机横屏', width: 1920, height: 1080 },
  { label: '带鱼屏', width: 2560, height: 720 },
  { label: '数字仪表', width: 1920, height: 720 },
  { label: '竖屏中控', width: 1200, height: 1920 },
]

function PreviewNode({ node, children }: { node: CodexFigmaNode; children: React.ReactNode }) {
  const common: React.CSSProperties = {
    position: 'absolute',
    left: `${node.x}px`,
    top: `${node.y}px`,
    width: `${Math.max(1, node.width)}px`,
    height: `${Math.max(1, node.height)}px`,
    opacity: node.opacity,
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
    transformOrigin: 'center',
    borderRadius: `${Math.max(0, node.cornerRadius)}px`,
    background: node.fill || 'transparent',
    border: node.stroke && node.strokeWidth > 0 ? `${node.strokeWidth}px solid ${node.stroke}` : undefined,
    overflow: node.layout.clipContent ? 'hidden' : 'visible',
  }
  if (node.type === 'TEXT') {
    return (
      <div
        style={{
          ...common,
          display: 'flex',
          alignItems: node.textStyle.verticalAlign === 'CENTER' ? 'center' : node.textStyle.verticalAlign === 'BOTTOM' ? 'flex-end' : 'flex-start',
          justifyContent: node.textStyle.textAlign === 'CENTER' ? 'center' : node.textStyle.textAlign === 'RIGHT' ? 'flex-end' : 'flex-start',
          color: node.textStyle.color,
          fontSize: `${node.textStyle.fontSize}px`,
          fontWeight: node.textStyle.fontWeight,
          lineHeight: `${node.textStyle.lineHeight}px`,
          letterSpacing: `${node.textStyle.letterSpacing}px`,
          whiteSpace: 'pre-wrap',
        }}
      >
        {node.text}
      </div>
    )
  }
  if (node.type === 'ELLIPSE') common.borderRadius = '9999px'
  if (node.type === 'LINE') {
    common.height = `${Math.max(1, node.strokeWidth)}px`
    common.background = node.stroke || node.fill || '#FFFFFF'
  }
  return <div style={common}>{children}</div>
}

function DesignPreview({ design }: { design: CodexFigmaDesign }) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, CodexFigmaNode[]>()
    for (const node of design.nodes) {
      const list = map.get(node.parentId) || []
      list.push(node)
      map.set(node.parentId, list)
    }
    return map
  }, [design])

  const renderNodes = (parentId: string | null, depth = 0): React.ReactNode => {
    if (depth > 8) return null
    return (childrenByParent.get(parentId) || []).map(node => (
      <PreviewNode key={node.id} node={node}>
        {renderNodes(node.id, depth + 1)}
      </PreviewNode>
    ))
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--foreground)/0.08)] bg-black/30 p-3 overflow-hidden">
      <div className="w-full overflow-hidden rounded-lg bg-black/60">
        <div
          className="relative origin-top-left"
          style={{
            width: `${design.frame.width}px`,
            height: `${design.frame.height}px`,
            background: design.frame.background,
            transform: `scale(${Math.min(1, 720 / design.frame.width)})`,
            transformOrigin: 'top left',
            marginBottom: `${Math.min(1, 720 / design.frame.width) * design.frame.height - design.frame.height}px`,
          }}
        >
          {renderNodes(null)}
        </div>
      </div>
    </div>
  )
}

export default function CodexFigmaGenerator() {
  const [outputMode, setOutputMode] = useState<'native' | 'png'>('native')
  const [pngProvider, setPngProvider] = useState<PngProvider>(defaultPngProvider)
  const [pngImages, setPngImages] = useState<string[]>([])
  const requestEpoch = useRef(0)
  const [figmaUrl, setFigmaUrl] = useState('')
  const [libraryUrlDraft, setLibraryUrlDraft] = useState('')
  const [componentLibraryUrls, setComponentLibraryUrls] = useState<string[]>([])
  const [prompt, setPrompt] = useState(() => buildCodexHMIPrompt({
    request: '设计一套高级新能源车中控首页，地图为视觉主体，信息层级清晰，适合驾驶场景。',
    scenario: 'home',
    style: '通用科技风',
  }))
  const [scenario, setScenario] = useState('home')
  const [style, setStyle] = useState('通用科技风')
  const [width, setWidth] = useState(1920)
  const [height, setHeight] = useState(1080)
  const [customSize, setCustomSize] = useState(false)
  const [scope, setScope] = useState<'screen' | 'flow'>('flow')
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [referenceName, setReferenceName] = useState('')
  const [design, setDesign] = useState<CodexFigmaDesign | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedScenario = HMI_SCENARIOS.find(item => item.id === scenario) ?? HMI_SCENARIOS[0]

  useEffect(() => {
    requestEpoch.current += 1
    setPngImages([]); setDesign(null); setCopied(false); setError(null); setGenerating(false)
  }, [outputMode, pngProvider, prompt, scenario, style, width, height, referenceImage, scope, figmaUrl, componentLibraryUrls])
  useEffect(() => () => { requestEpoch.current += 1 }, [])

  const addComponentLibrary = () => {
    const value = libraryUrlDraft.trim()
    if (!isValidFigmaLibraryUrl(value)) {
      setError('请填写有效的 Figma 组件库文件链接')
      return
    }
    if (componentLibraryUrls.includes(value)) {
      setError('该组件库已经添加')
      return
    }
    setComponentLibraryUrls(current => [...current, value])
    setLibraryUrlDraft('')
    setDesign(null)
    setError(null)
  }

  const handleFile = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('参考文件必须是图片')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('参考图不能超过 8MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setReferenceImage(String(reader.result || ''))
      setReferenceName(file.name)
      setDesign(null)
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  const handleGenerate = async () => {
    if (outputMode === 'native' && !isValidFigmaDesignUrl(figmaUrl)) {
      setError('请填写有效的 Figma Design 文件链接')
      return
    }
    if (!prompt.trim()) {
      setError('请先描述需要生成的 HMI 页面')
      return
    }
    setGenerating(true)
    setError(null)
    setDesign(null)
    setPngImages([])
    const epoch = ++requestEpoch.current
    try {
      if (outputMode === 'png') {
        const images = await generateHmiPng(`${prompt.trim()}\n生成单张完整 HMI 页面图片，不要拼图。视觉风格：${style}；场景：${selectedScenario.name}；目标尺寸：${width}×${height}。`, referenceImage, pngProvider)
        if (requestEpoch.current === epoch) setPngImages(images)
        return
      }
      const result = await generateCodexFigmaDesign({
        request: prompt.trim(),
        scenario,
        style,
        width,
        height,
        referenceImage,
      })
      if (requestEpoch.current === epoch) setDesign(result)
    } catch (cause) {
      if (requestEpoch.current === epoch) setError(cause instanceof Error ? cause.message : '生成失败')
    } finally {
      if (requestEpoch.current === epoch) setGenerating(false)
    }
  }

  const copyForCodex = async () => {
    if (!design) return
    try {
      await navigator.clipboard.writeText(designToCodexMcpPrompt({
        figmaUrl,
        componentLibraryUrls,
        design,
        request: prompt.trim(),
        scenario: selectedScenario.name,
        style,
        scope,
      }))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('无法写入剪贴板，请检查浏览器权限')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="hmi-generator mx-auto space-y-6"
    >
      <div className="generator-page-heading space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{outputMode === 'native' ? 'AI生成HMI源文件' : 'AI生成HMI PNG图片'}</h2>
          <Button variant="outline" size="sm" onClick={() => setOutputMode(outputMode === 'native' ? 'png' : 'native')} className="h-9 text-sm">
            切换到 {outputMode === 'native' ? '生成PNG图片' : '生成源文件'}
          </Button>
        </div>
        {outputMode === 'native' && <p className="text-sm text-muted-foreground">描述页面与视觉方向，生成可编辑设计基础，再交由 Codex 写入 Figma。</p>}
        {outputMode === 'png' && <p className="text-sm text-muted-foreground">使用设置中的图像 API，生成后可预览并下载 PNG 图片；实际尺寸以生成结果为准。</p>}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/15 bg-red-500/5 p-3 text-xs text-red-400">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={12} /></button>
        </div>
      )}

      <div className="generator-grid">
        <div className="generator-editor">
        <div className="glass rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-2 text-xs text-primary">
            <span className="flex items-center gap-2"><Sparkles size={12} />设计需求</span>
            <span className="text-[9px] text-muted-foreground">模块与风格会自动改写此内容</span>
          </div>
          <textarea
            aria-label="设计需求"
            value={prompt}
            onChange={event => { setPrompt(event.target.value); setDesign(null) }}
            className="min-h-64 w-full resize-y rounded-lg border border-[hsl(var(--foreground)/0.08)] bg-[hsl(var(--surface-secondary)/0.5)] p-3 text-xs leading-5 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/35 focus:outline-none"
            placeholder="描述页面、信息层级、交互状态与视觉方向"
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="text-sm font-medium">模块分类</div><div className="text-sm font-medium">设计风格</div>
            <select
              aria-label="模块分类"
              value={scenario}
              onChange={event => {
                const nextScenario = event.target.value
                setScenario(nextScenario)
                setPrompt(buildCodexHMIPrompt({
                  request: extractCodexHMIUserRequest(prompt),
                  scenario: nextScenario,
                  style,
                }))
                setDesign(null)
              }}
              className="h-9 rounded-lg border border-[hsl(var(--foreground)/0.08)] bg-[hsl(var(--surface-secondary)/0.5)] px-3 text-xs text-foreground"
            >
              {HMI_SCENARIOS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select
              aria-label="设计风格"
              value={style}
              onChange={event => {
                const nextStyle = event.target.value
                setStyle(nextStyle)
                setPrompt(buildCodexHMIPrompt({
                  request: extractCodexHMIUserRequest(prompt),
                  scenario,
                  style: nextStyle,
                }))
                setDesign(null)
              }}
              className="h-9 rounded-lg border border-[hsl(var(--foreground)/0.08)] bg-[hsl(var(--surface-secondary)/0.5)] px-3 text-xs text-foreground"
            >
              {Object.keys(HMI_STYLE_PRESETS).map(item => <option key={item}>{item}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            {HMI_QUICK_PROMPTS.slice(0, 6).map(item => (
              <button
                key={item.label}
                onClick={() => {
                  setScenario(item.scenario)
                  setPrompt(buildCodexHMIPrompt({ request: item.request, scenario: item.scenario, style }))
                  setDesign(null)
                }}
                className="rounded-md border border-[hsl(var(--foreground)/0.06)] bg-[hsl(var(--surface-secondary)/0.4)] px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

      {outputMode === 'native' && <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-primary"><Link2 size={12} />目标 Figma 文件</div>
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row">
          <input
            aria-label="目标 Figma 文件链接"
            type="url"
            value={figmaUrl}
            onChange={event => { setFigmaUrl(event.target.value); setDesign(null) }}
            className="h-10 min-w-0 flex-1 rounded-lg border border-[hsl(var(--foreground)/0.08)] bg-[hsl(var(--surface-secondary)/0.5)] px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/35 focus:outline-none"
            placeholder="https://www.figma.com/design/..."
          />
          {isValidFigmaDesignUrl(figmaUrl) && (
            <a href={figmaUrl} target="_blank" rel="noreferrer">
              <Button variant="glass" className="h-10 w-full gap-1.5 sm:w-auto"><ExternalLink size={12} />打开文件</Button>
            </a>
          )}
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
          <ShieldCheck size={13} className="mt-0.5 shrink-0 text-primary" />
          <span>仅写入你有编辑权限的文件；需要先在 Codex 中连接并授权 Figma 官方 MCP。平台不会保存 Figma 登录凭证。</span>
        </div>

        <div className="border-t border-[hsl(var(--foreground)/0.06)] pt-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-primary"><Boxes size={13} />我的 Figma 组件库 <span className="text-[10px] text-muted-foreground">可选</span></div>
            {componentLibraryUrls.length > 0 && <span className="text-[10px] text-muted-foreground">已添加 {componentLibraryUrls.length} 个</span>}
          </div>
          <div className="library-link-row flex min-w-0 flex-col gap-2 xl:flex-row">
            <input
              aria-label="Figma 组件库链接"
              type="url"
              value={libraryUrlDraft}
              onChange={event => setLibraryUrlDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addComponentLibrary()
                }
              }}
              className="h-10 min-w-0 flex-1 rounded-lg border border-[hsl(var(--foreground)/0.08)] bg-[hsl(var(--surface-secondary)/0.5)] px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary/35 focus:outline-none"
              placeholder="粘贴组件库的 Figma Design 链接"
            />
            <Button type="button" variant="glass" size="sm" onClick={addComponentLibrary} disabled={!libraryUrlDraft.trim()} className="h-10 shrink-0 gap-1.5">
              <Boxes size={12} />添加组件库
            </Button>
          </div>
          <div className="mt-2 text-[10px] leading-4 text-muted-foreground">生成时会优先复用组件库中的组件、变体和变量；请确保该组件库已发布，且当前 Figma 账号有访问权限。</div>

          {componentLibraryUrls.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {componentLibraryUrls.map((url, index) => (
                <div key={url} className="flex items-center gap-2 rounded-lg border border-[hsl(var(--foreground)/0.06)] bg-[hsl(var(--surface-secondary)/0.35)] px-2.5 py-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[9px] font-medium text-primary">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[10px] text-foreground">{url}</span>
                  <a href={url} target="_blank" rel="noreferrer" aria-label={`打开组件库 ${index + 1}`} className="text-muted-foreground hover:text-primary"><ExternalLink size={12} /></a>
                  <button
                    type="button"
                    aria-label={`移除组件库 ${index + 1}`}
                    onClick={() => {
                      setComponentLibraryUrls(current => current.filter(item => item !== url))
                      setDesign(null)
                    }}
                    className="text-muted-foreground hover:text-red-400"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      }
        </div>
        <div className="generator-settings space-y-4">
          {outputMode === 'png' && <div className="glass rounded-xl p-4 space-y-2">
            <label htmlFor="png-provider" className="block text-sm text-primary">AI 图像模型</label>
            <select id="png-provider" value={pngProvider} disabled={generating} onChange={event => setPngProvider(event.target.value as PngProvider)}
              className="h-10 w-full rounded-lg border border-[hsl(var(--foreground)/0.08)] bg-[hsl(var(--surface-secondary)/0.5)] px-3 text-sm text-foreground">
              {PNG_PROVIDERS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <p className="text-xs leading-5 text-muted-foreground">{pngProvider === 'openai' ? '使用设置中的 OpenAI API 配置和默认图像模型。' : '即梦与火山方舟均使用现有 Ark API 配置和默认 Seedream 模型，共用 API Key。'} 未配置或调用失败时会提示错误，不会自动切换模型。</p>
          </div>}
          {outputMode === 'native' && <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-primary"><Layers size={12} />生成范围</div>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['flow', '完整流程', '8–12 个核心页面'],
                ['screen', '单个页面', '一个完整 HMI 页面'],
              ] as const).map(([value, label, detail]) => (
                <button
                  key={value}
                  onClick={() => { setScope(value); setDesign(null) }}
                  className={`rounded-lg border p-2 text-left ${scope === value ? 'border-primary/30 bg-primary/10 text-primary' : 'border-[hsl(var(--foreground)/0.06)] bg-[hsl(var(--surface-secondary)/0.4)] text-muted-foreground'}`}
                >
                  <div className="text-[11px] font-medium">{label}</div>
                  <div className="mt-0.5 text-[9px] opacity-70">{detail}</div>
                </button>
              ))}
            </div>
          </div>

          }
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-primary">
              <span className="flex items-center gap-2"><Layers size={12} />画板尺寸</span>
              <button className="text-[10px] text-muted-foreground" onClick={() => setCustomSize(value => !value)}>{customSize ? '使用预设' : '自定义'}</button>
            </div>
            {!customSize ? (
              <div className="grid grid-cols-2 gap-2">
                {SIZE_PRESETS.map(item => (
                  <button
                    key={item.label}
                    onClick={() => { setWidth(item.width); setHeight(item.height); setDesign(null) }}
                    className={`rounded-lg border p-2 text-left ${width === item.width && height === item.height ? 'border-primary/30 bg-primary/10 text-primary' : 'border-[hsl(var(--foreground)/0.06)] bg-[hsl(var(--surface-secondary)/0.4)] text-muted-foreground'}`}
                  >
                    <div className="text-[10px] font-medium">{item.label}</div>
                    <div className="mt-0.5 text-[9px] opacity-70">{item.width}×{item.height}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input type="number" value={width} onChange={event => { setWidth(Number(event.target.value) || 0); setDesign(null) }} className="h-8 w-full rounded-lg border border-[hsl(var(--foreground)/0.08)] bg-[hsl(var(--surface-secondary)/0.5)] px-2 text-xs" />
                <span className="text-muted-foreground">×</span>
                <input type="number" value={height} onChange={event => { setHeight(Number(event.target.value) || 0); setDesign(null) }} className="h-8 w-full rounded-lg border border-[hsl(var(--foreground)/0.08)] bg-[hsl(var(--surface-secondary)/0.5)] px-2 text-xs" />
              </div>
            )}
          </div>

          <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-primary">
              <span className="flex items-center gap-2"><ImagePlus size={12} />风格参考图</span>
              {referenceImage && <button onClick={() => { setReferenceImage(null); setReferenceName(''); setDesign(null) }} className="text-[10px] text-muted-foreground">移除</button>}
            </div>
            {referenceImage ? (
              <img src={referenceImage} alt="风格参考" className="h-28 w-full rounded-lg object-cover" />
            ) : (
              <button onClick={() => fileInputRef.current?.click()} className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[hsl(var(--foreground)/0.1)] text-[10px] text-muted-foreground">
                <Upload size={15} />可选，仅提取视觉语言
              </button>
            )}
            {referenceName && <div className="truncate text-[10px] text-muted-foreground">{referenceName}</div>}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={event => handleFile(event.target.files?.[0])} />
          </div>
        </div>
      </div>

      <div className="generator-submitbar">
        <div className="text-sm text-muted-foreground">{outputMode === 'png' ? 'PNG 图片' : 'Figma 原生设计'} · {width} × {height}</div>
      <Button variant="default" onClick={handleGenerate} disabled={generating || width < 320 || height < 320 || width > 7680 || height > 7680 || (outputMode === 'native' && !isValidFigmaDesignUrl(figmaUrl))} className="h-11 min-w-40 gap-2">
        {generating ? <><Loader2 size={14} className="animate-spin" />{outputMode === 'png' ? '正在生成PNG图片…' : 'Codex 正在构建设计基础…'}</> : <><Sparkles size={14} />生成</>}
      </Button>
      </div>

      {generating && outputMode === 'png' && <p role="status" className="text-sm text-muted-foreground">正在等待图像服务返回，生成可能需要一分钟或更久。请保持页面打开，完成后会自动显示图片。</p>}
      {outputMode === 'png' && pngImages.length > 0 && <div className="space-y-4">
        <p className="text-sm text-muted-foreground">生成服务：{PNG_PROVIDERS.find(item => item.id === pngProvider)?.name}</p>
        {pngImages.map((url, index) => <div key={index} className="glass rounded-xl p-4 space-y-3">
          <img src={url} alt={`HMI PNG生成结果 ${index + 1}`} className="w-full rounded-lg" />
          <a href={url} download={`HMI-${index + 1}.png`} className="inline-flex rounded-lg bg-primary/10 px-4 py-2 text-sm text-primary">下载 PNG</a>
        </div>)}
      </div>}

      {design && (
        <div className="space-y-4">
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">{design.frame.name}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{design.summary}</div>
                {design.generationModel && <div className="mt-1 text-xs text-muted-foreground">生成模型：{design.generationModel}</div>}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="rounded-md bg-primary/5 px-2 py-1">{design.frame.width}×{design.frame.height}</span>
                <span className="rounded-md bg-primary/5 px-2 py-1">{design.nodes.length} 个原生图层</span>
              </div>
            </div>
            <DesignPreview design={design} />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="glow" size="sm" onClick={copyForCodex} className="gap-1.5">
                {copied ? <Check size={12} /> : <Clipboard size={12} />}{copied ? '已复制，返回 Codex 执行' : '复制 Codex 直写任务'}
              </Button>
              <a href={figmaUrl} target="_blank" rel="noreferrer"><Button variant="glass" size="sm" className="gap-1.5"><ExternalLink size={12} />查看目标文件</Button></a>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['1', '连接官方 MCP', '在 Codex 设置中连接并授权 Figma'],
              ['2', '复制直写任务', '点击上方按钮，将任务粘贴到 Codex'],
              ['3', '批准写入', 'Codex 检查文件后使用 use_figma 创建原生页面'],
            ].map(([number, title, detail]) => (
              <div key={number} className="rounded-xl border border-[hsl(var(--foreground)/0.06)] bg-[hsl(var(--surface-secondary)/0.3)] p-3">
                <div className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{number}</div>
                <div className="text-xs font-medium text-foreground">{title}</div>
                <div className="mt-1 text-[10px] leading-4 text-muted-foreground">{detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </motion.div>
  )
}

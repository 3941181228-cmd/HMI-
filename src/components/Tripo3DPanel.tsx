// Tripo 3D 模型生成面板：文生/图生 3D 模型 + 任务轮询 + GLB 预览 + 下载
import { useState, useCallback, useRef, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Loader2, Download, AlertCircle, Box, CheckCircle2, Upload, ImagePlus, X } from 'lucide-react'
import { Button } from './ui/button'
import { generateModelWithPoll, proxyModelUrl, type TripoTaskResult } from '@/services/tripo'

// 懒加载 3D 查看器，避免 three.js 体积影响首屏
const Model3DViewer = lazy(() => import('./Model3DViewer'))

// 示例提示词，帮助用户快速上手
const EXAMPLE_PROMPTS = [
  '一只可爱的猫咪',
  '低多边形跑车',
  '中世纪头盔',
  '未来感机器人',
]

export default function Tripo3DPanel() {
  const [prompt, setPrompt] = useState('')
  const [refImage, setRefImage] = useState<string | null>(null)
  const [refImageName, setRefImageName] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [result, setResult] = useState<TripoTaskResult | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 参考图上传处理
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setRefImage(ev.target?.result as string)
      setRefImageName(file.name)
    }
    reader.readAsDataURL(file)
  }

  // 拖拽上传处理
  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setRefImage(ev.target?.result as string)
      setRefImageName(file.name)
    }
    reader.readAsDataURL(file)
  }

  // 移除参考图
  const removeRefImage = () => {
    setRefImage(null)
    setRefImageName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim()
    // 有参考图时 prompt 可选，无参考图时 prompt 必填
    if (!trimmed && !refImage) {
      setError('请输入模型描述或上传参考图')
      return
    }

    setLoading(true)
    setError('')
    setProgress(0)
    setResult(null)
    setStatusText(refImage ? '上传参考图并提交任务…' : '提交任务中…')

    const res = await generateModelWithPoll(
      trimmed,
      undefined,
      (r) => {
        setProgress(r.progress)
        setStatusText(
          r.status === 'queued' ? '排队中…' :
          r.status === 'running' ? `生成中 ${r.progress}%` :
          r.status === 'success' ? '生成完成' :
          r.status === 'failed' ? '生成失败' : '处理中…'
        )
      },
      3000,
      5 * 60 * 1000,
      refImage || undefined,
    )

    setResult(res)
    setLoading(false)
    if (!res.success) {
      setError(res.error || '生成失败，请重试')
    }
  }, [prompt, refImage])

  // 优先使用 GLB 格式；其次取任意可用格式
  const modelUrl = result?.models?.glb || (result?.models ? Object.values(result.models)[0] : '')

  const handleDownload = useCallback(() => {
    if (!modelUrl) return
    // 优先使用原始直链下载（避免代理的缓存头影响下载体验）
    const a = document.createElement('a')
    a.href = modelUrl
    a.download = `tripo-model-${Date.now()}.glb`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [modelUrl])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* 标题 */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-foreground flex items-center justify-center gap-2">
          <Box size={18} className="text-primary" />
          AI 生成 3D 模型
        </h2>
        <p className="text-sm text-muted-foreground">输入文字描述或上传参考图，由 Tripo AI 生成可交互的 3D 模型</p>
      </div>

      {/* 输入区 */}
      <div className="glass rounded-2xl p-5 space-y-4 border border-[hsl(var(--foreground)/0.06)]">
        {/* 参考图上传区 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-primary">
              <ImagePlus size={12} />
              <span>参考图（可选，上传后以图生 3D 模式生成）</span>
            </div>
            {refImage && (
              <button
                onClick={removeRefImage}
                disabled={loading}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
              >
                <X size={10} />
                移除
              </button>
            )}
          </div>

          {refImage ? (
            <div className="relative rounded-lg overflow-hidden border border-[hsl(var(--primary)/0.15)]">
              <img
                src={refImage}
                alt="参考图"
                className="w-full max-h-48 object-contain bg-[hsl(var(--surface-secondary)/0.5)]"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] text-foreground/80 truncate">{refImageName}</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors disabled:opacity-40"
                >
                  更换图片
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleImageDrop}
              className="flex flex-col items-center justify-center gap-2 py-6 rounded-lg border border-dashed border-[hsl(var(--foreground)/0.1)] bg-[hsl(var(--surface-secondary)/0.3)] cursor-pointer hover:border-[hsl(var(--primary)/0.25)] hover:bg-[hsl(var(--primary)/0.03)] transition-all duration-300 group"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-200">
                <Upload size={15} className="text-primary/50 group-hover:text-primary/70 transition-colors" />
              </div>
              <div className="text-center">
                <p className="text-xs text-foreground/70">点击上传或拖拽图片到此处</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">支持 PNG、JPG、WEBP 格式，建议 ≥256×256px</p>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {/* 提示词输入区（有参考图时可选） */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={refImage ? '补充描述（可选），例如：生成低多边形风格' : '描述你想要的 3D 模型，例如：一只可爱的猫咪'}
            rows={3}
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.06)] text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[hsl(var(--primary)/0.3)] focus:ring-1 focus:ring-[hsl(var(--primary)/0.15)] transition-all resize-none"
          />
        </div>

        {/* 示例词（仅文生模式显示） */}
        {!refImage && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => setPrompt(p)}
                disabled={loading}
                className="px-2.5 py-1 rounded-lg text-[11px] text-muted-foreground/70 bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--foreground)/0.06)] hover:text-primary hover:border-[hsl(var(--primary)/0.25)] transition-all disabled:opacity-40"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/50">
            引擎：Tripo v3.1 · {refImage ? '图生 3D' : '文生 3D'} · 异步任务模式
          </span>
          <Button
            variant="glow"
            size="sm"
            className="gap-1.5"
            onClick={handleGenerate}
            disabled={loading || (!prompt.trim() && !refImage)}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {loading ? '生成中' : '生成模型'}
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400"
          >
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 进度提示 */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass rounded-2xl p-5 space-y-3 border border-[hsl(var(--foreground)/0.06)]"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin text-primary" />
                {statusText}
              </span>
              <span className="text-primary font-medium">{progress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[hsl(var(--surface-secondary)/0.8)] overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary/60 to-primary"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 模型查看器 */}
      <AnimatePresence>
        {result?.success && modelUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="glass rounded-2xl p-4 border border-[hsl(var(--foreground)/0.06)] space-y-3"
          >
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-sm font-medium text-foreground">模型生成完成</span>
                <span className="text-[10px] text-muted-foreground/50">
                  可用格式：{Object.keys(result.models).join(' / ') || 'glb'}
                </span>
              </div>
              <Button variant="glass" size="sm" className="gap-1.5" onClick={handleDownload}>
                <Download size={12} />
                下载 GLB
              </Button>
            </div>

            {/* 3D 渲染区 */}
            <div className="w-full h-[420px] rounded-xl overflow-hidden bg-gradient-to-br from-[hsl(var(--surface-secondary)/0.8)] to-[hsl(var(--surface)/0.6)] border border-[hsl(var(--foreground)/0.06)]">
              <Model3DViewerLazy modelUrl={proxyModelUrl(modelUrl)} />
            </div>

            <p className="text-[10px] text-muted-foreground/40 text-center">
              鼠标拖拽旋转 · 滚轮缩放 · 右键平移
            </p>

            {/* GLB 文件兼容工具说明 */}
            <div className="px-3 py-2.5 rounded-lg bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--foreground)/0.06)]">
              <p className="text-[11px] text-muted-foreground/70 mb-1.5">
                生成结束后可下载 GLB 3D 模型文件，可直接在以下工具中使用：
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['Blender', 'Unity', 'Unreal Engine', 'Three.js', 'Babylon.js', 'model-viewer'].map((tool) => (
                  <span
                    key={tool}
                    className="px-2 py-0.5 rounded-md text-[10px] text-muted-foreground/80 bg-[hsl(var(--surface)/0.6)] border border-[hsl(var(--foreground)/0.06)]"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Model3DViewerLazy({ modelUrl }: { modelUrl: string }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin mr-2" />
          加载 3D 引擎…
        </div>
      }
    >
      <Model3DViewer modelUrl={modelUrl} />
    </Suspense>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Upload, Download, Loader2, X } from 'lucide-react'
import { Button } from './ui/button'
import type { SvgTraceOptions } from '../services/imageToSvg'

const presets = {
  icon: { label: '彩色图标', mode: 'color', colorCount: 16, turdSize: 0, alphaMax: 1, opttolerance: 0.1 },
  detail: { label: '精细插画', mode: 'color', colorCount: 48, turdSize: 0, alphaMax: 0.8, opttolerance: 0.1 },
  hmi: { label: 'HMI 精细还原', mode: 'color', colorCount: 32, turdSize: 0, alphaMax: 0.8, opttolerance: 0.05 },
  mono: { label: '单色标识', mode: 'brightness', colorCount: 2, turdSize: 2, alphaMax: 1, opttolerance: 0.1 },
} as const
const checker = { backgroundColor: '#25252d', backgroundImage: 'conic-gradient(#35353f 25%,transparent 0 50%,#35353f 0 75%,transparent 0)', backgroundSize: '20px 20px' }

export default function VectorTracePanel() {
  const [source, setSource] = useState<{ url: string; name: string; width: number; height: number; pixels: ImageData } | null>(null)
  const [options, setOptions] = useState<Partial<SvgTraceOptions>>({ ...presets.hmi, brightnessThreshold: 0.45 })
  const [result, setResult] = useState<{ url: string; svg: string; count: number; seconds: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [view, setView] = useState<'compare' | 'original' | 'vector'>('compare')
  const worker = useRef<Worker | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const input = useRef<HTMLInputElement>(null)
  const revision = useRef(0)
  useEffect(() => () => { worker.current?.terminate(); clearTimeout(timer.current); revision.current++ }, [])
  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url) }, [source])
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url) }, [result])
  function stop() { worker.current?.terminate(); worker.current = null; clearTimeout(timer.current); setBusy(false) }
  async function upload(file?: File) {
    if (!file) return
    const id = ++revision.current
    stop(); setError(''); setResult(null); setSource(null)
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('请选择 PNG、JPG 或 WebP 图片'); return }
    if (file.size > 30 * 1024 * 1024) { setError('图片不能超过 30 MB'); return }
    const url = URL.createObjectURL(file)
    try {
      const img = new Image(); img.src = url; await img.decode()
      if (id !== revision.current) { URL.revokeObjectURL(url); return }
      if (img.naturalWidth * img.naturalHeight > 4_000_000) throw new Error('图片超过 400 万像素，请先缩小或裁剪，以保留可控的转换时间')
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('浏览器不支持图片处理')
      ctx.drawImage(img, 0, 0)
      setSource({ url, name: file.name, width: canvas.width, height: canvas.height, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height) })
      setStale(false); setZoom(100)
    } catch (e) { URL.revokeObjectURL(url); if (id === revision.current) setError(e instanceof Error ? e.message : '图片读取失败') }
  }
  function update(next: Partial<SvgTraceOptions>) { setOptions(o => ({ ...o, ...next })); if (result) setStale(true) }
  function convert() {
    if (!source) return
    stop(); setBusy(true); setError('')
    const start = performance.now()
    try {
      const w = new Worker(new URL('../services/vectorTrace.worker.ts', import.meta.url), { type: 'module' }); worker.current = w
      timer.current = setTimeout(() => { stop(); setError('转换超时，请减少颜色数量或缩小图片后重试') }, 120000)
      w.onmessage = ({ data }: MessageEvent<{ svg?: string; error?: string }>) => {
        stop()
        if (!data.svg) { setError(data.error || '未生成有效结果'); return }
        const doc = new DOMParser().parseFromString(data.svg, 'image/svg+xml')
        if (doc.querySelector('parsererror, image, script, foreignObject') || !doc.querySelector('path')) { setError('转换结果无效，请调整参数后重试'); return }
        setResult({ svg: data.svg, url: URL.createObjectURL(new Blob([data.svg], { type: 'image/svg+xml' })), count: doc.querySelectorAll('path').length, seconds: ((performance.now() - start) / 1000).toFixed(1) }); setStale(false)
      }
      w.onerror = () => { stop(); setError('矢量引擎加载失败，请刷新页面后重试') }
      const pixels = new Uint8ClampedArray(source.pixels.data)
      w.postMessage({ pixels, width: source.width, height: source.height, options }, [pixels.buffer])
    } catch { stop(); setError('浏览器无法启动矢量引擎，请更换现代浏览器后重试') }
  }
  return <section className="max-w-6xl mx-auto space-y-5 text-sm">
    <div><h2 className="text-xl font-semibold">PNG 转 SVG</h2><p className="text-muted-foreground mt-2">将图标与平面素材转成真实矢量路径。图片仅在当前设备处理，无需 API。</p></div>
    <div className="grid lg:grid-cols-[260px_1fr] gap-5">
      <div className="glass rounded-xl p-5 space-y-5">
        <Button variant="outline" className="w-full gap-2" onClick={() => input.current?.click()}><Upload size={16} />{source ? '更换图片' : '上传图片'}</Button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }} />
        {source && <p className="break-all text-muted-foreground">{source.name}<br />{source.width} × {source.height} px</p>}
        <fieldset disabled={busy} className="space-y-5 disabled:opacity-50">
          <legend className="font-medium mb-3">描摹设置</legend>
          <div className="flex flex-wrap gap-2">{Object.entries(presets).map(([key, p]) => <button key={key} onClick={() => update(p)} className="border border-primary/30 rounded-lg px-3 py-2 hover:bg-primary/10">{p.label}</button>)}</div>
          <label className="block">描摹模式<select className="block w-full mt-2 bg-background border rounded-lg p-2" value={options.mode} onChange={e => update({ mode: e.target.value as 'color' | 'brightness' })}><option value="color">彩色 · 保留配色</option><option value="brightness">单色 · 黑色轮廓</option></select></label>
          {options.mode === 'color' ? <label className="block">颜色数量：{options.colorCount}<input aria-label="颜色数量" className="block w-full mt-2 accent-purple-500" type="range" min="2" max="64" value={options.colorCount} onChange={e => update({ colorCount: +e.target.value })} /></label> : <label className="block">亮度阈值：{options.brightnessThreshold}<input aria-label="亮度阈值" className="block w-full mt-2" type="range" min="0.05" max="0.95" step="0.05" value={options.brightnessThreshold} onChange={e => update({ brightnessThreshold: +e.target.value })} /></label>}
          <label className="block">细节精度<select className="block w-full mt-2 bg-background border rounded-lg p-2" value={options.opttolerance} onChange={e => update({ opttolerance: +e.target.value })}><option value="0.05">精细 · 更多轮廓节点</option><option value="0.1">均衡</option><option value="0.3">精简 · 更小文件</option></select></label>
          <label className="block">去除小斑点：{options.turdSize} px<input aria-label="去除小斑点" className="block w-full mt-2" type="range" min="0" max="20" value={options.turdSize} onChange={e => update({ turdSize: +e.target.value })} /></label>
          <label className="block">曲线平滑：{options.alphaMax}<input aria-label="曲线平滑" className="block w-full mt-2" type="range" min="0" max="1.33" step="0.01" value={options.alphaMax} onChange={e => update({ alphaMax: +e.target.value })} /></label>
          <p className="text-muted-foreground text-xs leading-relaxed">平面图标、标识效果更好。照片、渐变和小字号文字会被近似描摹，文字不会自动恢复为可编辑文本。需要拆分界面元素时使用 AI 组件识别。</p>
        </fieldset>
        <Button variant="glow" className="w-full" onClick={convert} disabled={!source || busy}>{busy ? <><Loader2 size={16} className="animate-spin mr-2" />正在描摹…</> : result ? '重新转换' : '开始转换'}</Button>
        {busy && <Button variant="outline" className="w-full" onClick={stop}><X size={16} />取消转换</Button>}
      </div>
      <div className="glass rounded-xl p-4 space-y-4 min-w-0" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files?.[0]) }}>
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2">{(['compare','original','vector'] as const).map((v,i) => <button key={v} disabled={v !== 'original' && !result} onClick={() => setView(v)} className={`px-3 py-2 rounded-lg disabled:opacity-40 ${view === v ? 'bg-primary/20 text-primary' : 'bg-background'}`}>{['并排对比','原图','矢量'][i]}</button>)}</div>
          <label>缩放 <select className="bg-background rounded p-2" value={zoom} onChange={e => setZoom(+e.target.value)}>{[100,200,400].map(n => <option key={n} value={n}>{n}%</option>)}</select></label>
        </div>
        {!source ? <button className="w-full min-h-80 border border-dashed border-primary/30 rounded-xl text-muted-foreground" onClick={() => input.current?.click()}>点击或拖入 PNG / JPG / WebP<br /><span className="text-xs">最大 30 MB，400 万像素</span></button> : <div className={`grid gap-3 ${view === 'compare' && result ? 'md:grid-cols-2' : ''}`}>
          {(view === 'compare' || view === 'original' || !result) && <div><p className="mb-2 text-muted-foreground">原图</p><div className="h-96 overflow-auto rounded-lg" style={checker}><img src={source.url} alt="原始位图" style={{ width: `${zoom}%`, maxWidth: 'none' }} /></div></div>}
          {result && view !== 'original' && <div><p className="mb-2 text-muted-foreground">矢量结果</p><div className="h-96 overflow-auto rounded-lg" style={checker}><img src={result.url} alt="SVG 矢量结果" style={{ width: `${zoom}%`, maxWidth: 'none' }} /></div></div>}
        </div>}
        {error && <p role="alert" className="text-red-400 p-3 border border-red-400/30 rounded-lg">{error}</p>}
        {stale && <p role="status" className="text-amber-400">参数已更改。当前预览为上一次结果，请重新转换后下载。</p>}
        {result && <div className="flex flex-wrap justify-between gap-3 items-center"><p className="text-muted-foreground">{result.count} 个颜色路径 · {(new Blob([result.svg]).size / 1024).toFixed(1)} KB · {result.seconds} 秒</p><Button disabled={stale || busy} onClick={() => { const a = document.createElement('a'); a.href = result.url; a.download = `${source?.name.replace(/\.[^.]+$/, '') || 'vector'}.svg`; a.click() }}><Download size={16} className="mr-2" />下载 SVG</Button></div>}
      </div>
    </div>
  </section>
}

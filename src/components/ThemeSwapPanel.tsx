import { useRef, useState } from 'react'
import { ArrowRightLeft, Copy, Download, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { getStoredFigmaToken } from '../services/apiStorage'
import { listThemeFrames, normalizeThemeMapping, type ThemeFrame, type ThemeRule } from '../services/themeSwap'

const field = 'w-full min-w-0 h-10 rounded-lg border border-border bg-background px-3 text-sm'
const example = JSON.stringify([{ name: '背景', light: '#FFFFFF', dark: '#121212' }], null, 2)

export default function ThemeSwapPanel() {
  const [token, setToken] = useState(getStoredFigmaToken)
  const [fileUrl, setFileUrl] = useState('')
  const [size, setSize] = useState('all')
  const [frames, setFrames] = useState<ThemeFrame[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [rules, setRules] = useState<ThemeRule[]>([])
  const [draft, setDraft] = useState('')
  const [light, setLight] = useState('#FFFFFF')
  const [dark, setDark] = useState('#121212')
  const [direction, setDirection] = useState('light-to-dark')
  const requestId = useRef(0)
  const upload = useRef<HTMLInputElement>(null)
  const serialized = JSON.stringify(rules, null, 2)

  function invalidate() {
    requestId.current++
    setFrames([]); setSelected([]); setFileName(''); setError(''); setNotice(''); setLoading(false)
  }
  async function readFrames() {
    const id = ++requestId.current
    setLoading(true); setError(''); setNotice(''); setFrames([]); setSelected([]); setFileName('')
    try {
      const widths = size === 'car' ? [1800, 2000] : size === 'phone' ? [350, 430] : size === 'tablet' ? [900, 1100] : [0, 100000]
      const result = await listThemeFrames(fileUrl, token, widths[0], widths[1])
      if (id !== requestId.current) return
      setFrames(result.frames); setFileName(result.fileName)
      setNotice(result.frames.length ? `已读取 ${result.frames.length} 个画板。请在 Figma 中选中需要换色的画板。` : '读取成功，当前尺寸筛选下没有画板，请切换为全部尺寸。')
    } catch (e) { if (id === requestId.current) setError(e instanceof Error ? e.message : '读取失败') }
    finally { if (id === requestId.current) setLoading(false) }
  }
  function importRules(text: string) {
    try {
      const next = normalizeThemeMapping(JSON.parse(text))
      setRules(next); setDraft(''); setError(''); setNotice(`已在本页导入 ${next.length} 条规则，尚未修改 Figma。`)
    } catch (e) { setError(e instanceof Error ? e.message : 'JSON 格式无效') }
  }
  function downloadRules() {
    const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'hmi-theme-mapping.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('规则已导出，请在 Figma 插件中粘贴配置并执行。')
  }
  async function copyRules() {
    try { await navigator.clipboard.writeText(serialized); setError(''); setNotice('规则已复制。请在 Figma 插件中配置颜色映射，然后执行换色。') }
    catch { setError('浏览器不允许复制，请手动复制下方规则，或下载 JSON。') }
  }
  const command = direction === 'light-to-dark' ? 'Light → Dark' : 'Dark → Light'

  return <div className="space-y-5">
    <div><h2 className="text-xl font-semibold flex items-center gap-2"><ArrowRightLeft size={22} />Figma 一键换色</h2>
      <p className="mt-2 text-sm text-muted-foreground">网页读取画板并配置颜色映射，在 Figma 插件中执行原文件换色。</p></div>
    <section className="glass rounded-xl p-5 space-y-4">
      <h3 className="font-medium">1. 读取 Figma 画板（可选）</h3>
      <label className="block text-sm">Figma Token<input type="password" autoComplete="off" className={field + ' mt-2'} value={token} onChange={e => { invalidate(); setToken(e.target.value) }} placeholder="使用设置中的 Token；服务端已配置时可留空" /></label>
      <p className="text-xs text-muted-foreground">本页输入的 Token 仅用于请求，不会在此保存。读取成功才会显示画板结果。</p>
      <label className="block text-sm">Figma 文件链接<input className={field + ' mt-2'} value={fileUrl} onChange={e => { invalidate(); setFileUrl(e.target.value) }} placeholder="https://www.figma.com/design/..." /></label>
      <div className="flex flex-wrap gap-3">
        <select aria-label="画板尺寸筛选" className={field + ' sm:w-56'} value={size} onChange={e => { invalidate(); setSize(e.target.value) }}>
          <option value="all">全部尺寸</option><option value="car">车机横屏 1920×1080</option><option value="phone">手机竖屏 390×844</option><option value="tablet">平板 1024×768</option>
        </select>
        <Button variant="glow" disabled={loading || !fileUrl.trim()} onClick={readFrames}>{loading && <Loader2 size={16} className="mr-2 animate-spin" />}{loading ? '读取中…' : '获取画板列表'}</Button>
      </div>
      {frames.length > 0 && <div className="space-y-2"><p className="text-sm">{fileName} · {frames.length} 个画板</p><p className="text-xs text-muted-foreground">勾选仅作操作清单，不会自动选择 Figma 中的画板。</p>
        <div className="max-h-64 overflow-auto space-y-2">{frames.map(frame => <label key={frame.id} className="flex gap-3 items-center rounded-lg border border-border p-3 text-sm">
          <input type="checkbox" checked={selected.includes(frame.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, frame.id] : prev.filter(id => id !== frame.id))} />
          <span className="min-w-0 flex-1 break-words">{frame.name} <span className="text-muted-foreground">{frame.width}×{frame.height}</span></span>
          <a className="text-primary shrink-0" href={(() => { const url = new URL(fileUrl); url.searchParams.set('node-id', frame.id); return url.href })()} target="_blank" rel="noreferrer">打开画板</a>
        </label>)}</div></div>}
    </section>
    <section className="glass rounded-xl p-5 space-y-4">
      <h3 className="font-medium">2. 配置颜色映射</h3>
      <p className="text-sm text-muted-foreground">填写原文件的实际颜色，或导入已有 JSON。插件按颜色匹配替换。</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm flex-1 min-w-32">浅色值<input className={field + ' mt-2'} value={light} onChange={e => setLight(e.target.value)} /></label>
        <label className="text-sm flex-1 min-w-32">深色值<input className={field + ' mt-2'} value={dark} onChange={e => setDark(e.target.value)} /></label>
        <Button variant="outline" onClick={() => { try { setRules(normalizeThemeMapping([...rules, { name: `颜色 ${rules.length + 1}`, light, dark }])); setError(''); setNotice('规则已更新，尚未修改 Figma。') } catch (e) { setError((e as Error).message) } }}><Plus size={16} className="mr-1" />添加规则</Button>
      </div>
      <textarea aria-label="颜色映射 JSON" className="w-full h-32 rounded-lg border border-border bg-background p-3 font-mono text-xs" placeholder={example} value={draft} onChange={e => setDraft(e.target.value)} />
      <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={!draft.trim()} onClick={() => importRules(draft)}>导入粘贴内容</Button><Button variant="outline" onClick={() => upload.current?.click()}>导入 JSON 文件</Button></div>
      <input ref={upload} type="file" accept=".json,application/json" className="hidden" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; if (file.size > 1000000) { setError('JSON 文件请小于 1 MB'); return } try { importRules(await file.text()) } catch { setError('文件读取失败') } }} />
      <div className="max-h-56 overflow-auto space-y-2">{rules.map((rule, i) => <div key={i} className="flex items-center gap-2 text-sm border-b border-border py-2"><span className="flex-1">{rule.name}：{rule.light} → {rule.dark}</span><button aria-label={`删除规则 ${i + 1}`} onClick={() => { setRules(rules.filter((_, index) => index !== i)); setNotice('') }}><Trash2 size={16} /></button></div>)}</div>
    </section>
    <section className="glass rounded-xl p-5 space-y-4">
      <h3 className="font-medium">3. 在 Figma 插件中执行</h3>
      <select aria-label="换色方向" className={field} value={direction} onChange={e => setDirection(e.target.value)}><option value="light-to-dark">浅色 → 深色</option><option value="dark-to-light">深色 → 浅色</option></select>
      <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
        <li><a href="/downloads/hmi-theme-swap-plugin.zip" download className="text-primary underline">下载 Figma 插件</a>，解压后在 Figma 桌面端通过 Plugins → Development → Import plugin from manifest 导入 manifest.json。</li>
        <li>运行 HMI Codex &amp; Theme Tools → 配置颜色映射，粘贴下方规则并保存。</li>
        <li>在目标 Figma 文件中选中画板，再运行插件菜单的 <strong className="text-foreground">{command}</strong>。锁定图层自动跳过。</li>
      </ol>
      {selected.length > 0 && <p className="text-sm">待操作画板：{frames.filter(f => selected.includes(f.id)).map(f => f.name).join('、')}。请在 Figma 中手动选中。</p>}
      <div className="flex flex-wrap gap-3"><Button variant="glow" disabled={!rules.length} onClick={copyRules}><Copy size={16} className="mr-2" />复制换色规则</Button><Button variant="outline" disabled={!rules.length} onClick={downloadRules}><Download size={16} className="mr-2" />下载 JSON</Button></div>
      {rules.length > 0 && <textarea aria-label="可复制的换色规则" readOnly value={serialized} className="w-full h-40 rounded-lg border border-border bg-background p-3 font-mono text-xs" />}
      <p className="text-xs text-muted-foreground">网页不连接插件，不会显示换色成功。实际结果以 Figma 插件反馈为准。</p>
    </section>
    {error && <p role="alert" className="text-sm text-red-400 border border-red-500/20 rounded-lg p-3">{error}</p>}
    {notice && <p role="status" className="text-sm text-primary border border-primary/20 rounded-lg p-3">{notice}</p>}
  </div>
}

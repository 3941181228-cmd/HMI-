// HMI SVG 组件服务 - 处理后端返回的SVG数据

export type HMISectionCategory =
  | 'icon'
  | 'gauge'
  | 'button'
  | 'card'
  | 'background'
  | 'mask'
  | 'popup'
  | 'progress'
  | 'text'
  | 'indicator'
  | 'nav_item'
  | 'media_cover'
  | 'divider'
  | 'shape'
  | 'status_bar'
  | 'navigation'
  | 'dashboard'
  | 'media'
  | 'climate'
  | 'vehicle_info'
  | 'map'
  | 'settings'
  | 'notification'
  | 'control'
  | 'widget'

export interface SVGComponent {
  id: string
  name: string
  category: HMISectionCategory | string
  x: number
  y: number
  width: number
  height: number
  svg: string
  categoryLabel: string
  innerContent: string
  normalizedSvg: string
}

export interface CanvasInfo {
  width: number
  height: number
  background: string
}

export interface SVGGenerationResult {
  canvas: CanvasInfo
  svgComponents: SVGComponent[]
  summary: string
  hasError: boolean
  errorMessage?: string
  _raw?: string
}

// HMI 元素分类中文映射
const CATEGORY_LABELS: Record<string, string> = {
  // 新的切图元素类型
  icon: '图标',
  gauge: '仪表/圆环',
  button: '按钮',
  card: '卡片/面板',
  background: '底图/背景',
  mask: '遮罩层',
  popup: '弹窗',
  progress: '进度条',
  text: '文本',
  indicator: '指示灯',
  nav_item: '导航项',
  media_cover: '媒体封面',
  divider: '分割线',
  shape: '图形装饰',
  // 兼容旧的大区域分类
  status_bar: '状态栏',
  navigation: '导航栏',
  dashboard: '仪表盘',
  media: '媒体中心',
  climate: '空调控制',
  vehicle_info: '车辆信息',
  map: '地图区域',
  settings: '设置面板',
  notification: '通知中心',
  control: '快捷控制',
  widget: '通用组件',
}

// 清理SVG：移除<image>标签和外部URL引用，防止ORB错误
function sanitizeSVG(svgStr: string): string {
  let cleaned = svgStr.replace(/<image\b[^>]*\/?>/gi, '')
  cleaned = cleaned.replace(/<image\b[^>]*>[\s\S]*?<\/image>/gi, '')
  cleaned = cleaned.replace(/\s+(?:xlink:)?href\s*=\s*["']https?:\/\/[^"']*["']/gi, '')
  return cleaned
}

// 从SVG字符串中提取viewBox尺寸
function extractViewBox(svgStr: string): { w: number; h: number } | null {
  const viewBoxMatch = svgStr.match(/viewBox=["']([^"']+)["']/i)
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/[\s,]+/).map(Number)
    if (parts.length === 4 && !parts.some(isNaN)) {
      return { w: parts[2], h: parts[3] }
    }
  }
  return null
}

// 提取SVG内部内容（去掉外层<svg>标签）
function extractInnerContent(svgStr: string): string {
  let content = svgStr.replace(/<\?xml[^?]*\?>/gi, '').trim()
  const innerMatch = content.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
  if (innerMatch) {
    return innerMatch[1].trim()
  }
  const openTagEnd = content.indexOf('>')
  if (openTagEnd !== -1) {
    const rest = content.substring(openTagEnd + 1)
    const closeIdx = rest.lastIndexOf('</svg>')
    if (closeIdx !== -1) return rest.substring(0, closeIdx).trim()
    return rest.trim()
  }
  return content
}

// 规范化SVG
function normalizeSVG(svgStr: string, width: number, height: number): string {
  let svg = sanitizeSVG((svgStr || '').trim())
  if (!svg) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#1e293b" rx="8"/>
  <text x="${width/2}" y="${height/2}" font-size="14" fill="#94a3b8" text-anchor="middle" font-family="system-ui,sans-serif">空SVG</text>
</svg>`
  }

  if (!/<svg/i.test(svg)) {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${svg}</svg>`
  }
  if (!/xmlns=/.test(svg)) {
    svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
  }
  if (!/viewBox=/i.test(svg)) {
    svg = svg.replace(/<svg([^>]*)>/i, `<svg$1 viewBox="0 0 ${width} ${height}">`)
  }
  if (!/^<\?xml/i.test(svg)) {
    svg = `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`
  }
  return svg
}

// 主函数：处理后端返回的结果
export function processAIResult(rawResult: Record<string, unknown> | null | undefined): SVGGenerationResult {
  if (!rawResult || typeof rawResult !== 'object') {
    return {
      canvas: { width: 1920, height: 1080, background: '#0f172a' },
      svgComponents: [],
      summary: '返回数据为空',
      hasError: true,
      errorMessage: '返回数据为空',
    }
  }

  const rawCanvas = (rawResult.canvas as Record<string, unknown>) || {}
  const canvas: CanvasInfo = {
    width: Number(rawCanvas.width) || 1920,
    height: Number(rawCanvas.height) || 1080,
    background: String(rawCanvas.background || '#0f172a'),
  }

  let rawComponents: Array<Record<string, unknown>> = []
  const svgCompsVal = rawResult.svgComponents
  if (Array.isArray(svgCompsVal)) {
    rawComponents = svgCompsVal as Array<Record<string, unknown>>
  }

  const svgComponents: SVGComponent[] = rawComponents
    .filter(c => c && typeof c === 'object')
    .map((raw, idx) => {
      const rawSvg = String(raw.svg || '')
      const cat = String(raw.category || 'widget')
      const name = String(raw.name || CATEGORY_LABELS[cat] || `组件 ${idx + 1}`)
      const w = Number(raw.width) || extractViewBox(rawSvg)?.w || 200
      const h = Number(raw.height) || extractViewBox(rawSvg)?.h || 100

      return {
        id: String(raw.id || `svg_${idx}`),
        name,
        category: cat,
        x: Number(raw.x) || 0,
        y: Number(raw.y) || 0,
        width: w,
        height: h,
        svg: rawSvg,
        categoryLabel: CATEGORY_LABELS[cat] || name,
        innerContent: extractInnerContent(rawSvg),
        normalizedSvg: normalizeSVG(rawSvg, w, h),
      }
    })
    .filter(c => c.svg && c.svg.length > 10)

  const _raw = rawResult._raw as string | undefined
  const rawSummary = typeof rawResult.summary === 'string' ? rawResult.summary : ''
  const hasError = svgComponents.length === 0
  const errorMsg = hasError
    ? (rawSummary || 'AI 未能生成有效的 SVG 组件，请重试或更换更清晰的截图')
    : undefined

  return {
    canvas,
    svgComponents,
    summary: hasError ? errorMsg! : (rawSummary || `成功生成 ${svgComponents.length} 个 SVG 组件`),
    hasError,
    errorMessage: errorMsg,
    _raw,
  }
}

// 导出单个 SVG
export function downloadSVGComponent(svgComp: SVGComponent) {
  const blob = new Blob([svgComp.normalizedSvg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hmi_${svgComp.category}_${svgComp.id}.svg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 批量导出
export function downloadAllSVGComponents(svgComponents: SVGComponent[]) {
  svgComponents.forEach((comp, i) => {
    setTimeout(() => downloadSVGComponent(comp), i * 300)
  })
}

// 获取分类颜色
export function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    // 切图元素类型颜色
    icon: '#6366f1',        // 图标 - 靛蓝
    gauge: '#06b6d4',       // 仪表/圆环 - 青色
    button: '#f59e0b',      // 按钮 - 琥珀
    card: '#8b5cf6',        // 卡片 - 紫色
    background: '#475569',  // 底图 - 石板灰
    mask: '#64748b',        // 遮罩 - 灰色
    popup: '#ec4899',       // 弹窗 - 粉色
    progress: '#14b8a6',    // 进度条 - 青绿
    text: '#10b981',        // 文本 - 绿色
    indicator: '#ef4444',   // 指示灯 - 红色
    nav_item: '#3b82f6',    // 导航项 - 蓝色
    media_cover: '#a855f7', // 媒体封面 - 紫
    divider: '#94a3b8',     // 分割线 - 浅灰
    shape: '#e879f9',       // 图形装饰 - 亮紫
    // 兼容旧分类
    status_bar: '#6366f1',
    navigation: '#8b5cf6',
    dashboard: '#06b6d4',
    media: '#ec4899',
    climate: '#f59e0b',
    vehicle_info: '#10b981',
    map: '#3b82f6',
    settings: '#64748b',
    notification: '#ef4444',
    control: '#14b8a6',
    widget: '#a855f7',
  }
  return colorMap[category] || '#6366f1'
}

// 复制SVG代码
export async function copySVGCode(svg: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(svg)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = svg
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      return true
    } catch {
      return false
    }
  }
}

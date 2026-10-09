import analyzeHmi from './hmi-analysis.mjs'
import { streamImageGeneration } from './image-stream.mjs'
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3'
const DEFAULT_MODEL = 'doubao-seedream-5-0-260128'
const FIGMA_API_BASE = 'https://api.figma.com/v1'
const OPENAI_API_BASE = 'https://api.openai.com/v1'
const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-2'
const DEFAULT_OPENAI_CODEX_MODEL = 'gpt-5.3-codex'

const HMI_FIGMA_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'documentName', 'pageName', 'summary', 'frame', 'palette', 'nodes'],
  properties: {
    version: { type: 'string', enum: ['1.0'] },
    documentName: { type: 'string' },
    pageName: { type: 'string' },
    summary: { type: 'string' },
    frame: {
      type: 'object', additionalProperties: false,
      required: ['name', 'width', 'height', 'background'],
      properties: {
        name: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' }, background: { type: 'string' },
      },
    },
    palette: {
      type: 'object', additionalProperties: false,
      required: ['background', 'surface', 'primary', 'secondary', 'accent', 'text', 'muted', 'warning'],
      properties: Object.fromEntries(['background', 'surface', 'primary', 'secondary', 'accent', 'text', 'muted', 'warning'].map(key => [key, { type: 'string' }])),
    },
    nodes: {
      type: 'array', maxItems: 160,
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'parentId', 'type', 'name', 'x', 'y', 'width', 'height', 'opacity', 'rotation', 'cornerRadius', 'fill', 'stroke', 'strokeWidth', 'text', 'textStyle', 'layout'],
        properties: {
          id: { type: 'string' },
          parentId: { type: ['string', 'null'] },
          type: { type: 'string', enum: ['FRAME', 'COMPONENT', 'RECTANGLE', 'ELLIPSE', 'LINE', 'TEXT'] },
          name: { type: 'string' },
          x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' },
          opacity: { type: 'number' }, rotation: { type: 'number' }, cornerRadius: { type: 'number' },
          fill: { type: 'string' }, stroke: { type: 'string' }, strokeWidth: { type: 'number' }, text: { type: 'string' },
          textStyle: {
            type: 'object', additionalProperties: false,
            required: ['fontSize', 'fontWeight', 'textAlign', 'verticalAlign', 'lineHeight', 'letterSpacing', 'color'],
            properties: {
              fontSize: { type: 'number' }, fontWeight: { type: 'number' },
              textAlign: { type: 'string', enum: ['LEFT', 'CENTER', 'RIGHT'] },
              verticalAlign: { type: 'string', enum: ['TOP', 'CENTER', 'BOTTOM'] },
              lineHeight: { type: 'number' }, letterSpacing: { type: 'number' }, color: { type: 'string' },
            },
          },
          layout: {
            type: 'object', additionalProperties: false,
            required: ['mode', 'itemSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'clipContent'],
            properties: {
              mode: { type: 'string', enum: ['NONE', 'HORIZONTAL', 'VERTICAL'] },
              itemSpacing: { type: 'number' }, paddingTop: { type: 'number' }, paddingRight: { type: 'number' },
              paddingBottom: { type: 'number' }, paddingLeft: { type: 'number' }, clipContent: { type: 'boolean' },
            },
          },
        },
      },
    },
  },
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function verifyKey(key, upstream, manual = false) {
  if (!key) return { ok: false, configured: false, credit: '尚未配置默认 API' }
  try {
    const response = await upstream(`${ARK_BASE}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    })
    return {
      ok: response.ok,
      configured: true,
      credit: response.ok ? (manual ? 'API Key 已验证' : '默认 API 已验证') :
        [401, 403].includes(response.status) ? (manual ? 'API Key 无效或已过期' : '默认 API 验证失败') : '暂时无法验证连接，请稍后重试',
    }
  } catch {
    return { ok: false, configured: true, credit: '暂时无法连接火山方舟，请稍后重试' }
  }
}

function isAllowedFigmaImageUrl(target) {
  if (target.protocol !== 'https:' || target.username || target.password || target.port) return false
  const host = target.hostname.toLowerCase()
  if (host === 'figma.com' || host.endsWith('.figma.com')) return true
  if (host === 's3-us-west-2.amazonaws.com' || host === 's3.us-west-2.amazonaws.com') {
    return target.pathname.startsWith('/figma')
  }
  return host.endsWith('.amazonaws.com') && host.includes('.s3') && host.split('.')[0].includes('figma')
}

function figmaFileKey(value) {
  if (typeof value !== 'string') return ''
  const input = value.trim()
  if (/^[A-Za-z0-9_-]{1,200}$/.test(input)) return input
  try {
    const url = new URL(input)
    if (!['figma.com', 'www.figma.com'].includes(url.hostname.toLowerCase())) return ''
    return url.pathname.match(/^\/(?:design|file|proto|board)\/([A-Za-z0-9_-]{1,200})(?:\/|$)/)?.[1] || ''
  } catch { return '' }
}

function collectFigmaFrames(document) {
  const frames = []
  const supported = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION'])
  const visit = (node) => {
    if (!node || typeof node !== 'object') return
    if (supported.has(node.type) && node.absoluteBoundingBox) {
      const width = Math.round(Number(node.absoluteBoundingBox.width) || 0)
      const height = Math.round(Number(node.absoluteBoundingBox.height) || 0)
      if (width > 0 && height > 0 && typeof node.id === 'string') {
        frames.push({ id: node.id, name: String(node.name || '未命名画板'), width, height, type: node.type })
      }
    }
    if (Array.isArray(node.children)) node.children.forEach(visit)
  }
  visit(document)
  return frames
}

function normalizeHex(value) {
  if (typeof value !== 'string') return ''
  const match = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!match) return ''
  const raw = match[1].length === 3 ? [...match[1]].map(char => char + char).join('') : match[1]
  return `#${raw.toUpperCase()}`
}

function recolorSvg(svg, mapping, direction) {
  const colors = new Map()
  for (const rule of mapping) {
    const source = normalizeHex(direction === 'dark-to-light' ? rule.dark : rule.light)
    const target = normalizeHex(direction === 'dark-to-light' ? rule.light : rule.dark)
    if (source && target && source !== target) colors.set(source, target)
  }
  let replacedColors = 0
  const replace = (hex) => {
    const target = colors.get(normalizeHex(hex))
    if (!target) return hex
    replacedColors += 1
    return target
  }
  let output = svg.replace(/#[0-9a-f]{6}(?![0-9a-f])/gi, replace)
  output = output.replace(/#[0-9a-f]{3}(?![0-9a-f])/gi, replace)
  output = output.replace(/rgb\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)/gi,
    (match, r, g, b) => replace(`#${[r, g, b].map(value => Math.min(255, Number(value)).toString(16).padStart(2, '0')).join('')}`))
  return { svg: output, replacedColors }
}

async function figmaJson(upstream, target, token) {
  const response = await upstream(target, {
    headers: { 'X-Figma-Token': token },
    signal: AbortSignal.timeout(45000),
  })
  let data = null
  try { data = await response.json() } catch {}
  if (!response.ok) {
    const message = data?.err || data?.message || `Figma API 请求失败（${response.status}）`
    throw Object.assign(new Error(message), { status: response.status })
  }
  return data
}

async function handleFigmaApi(request, env, upstream) {
  const url = new URL(request.url)
  const path = url.pathname
  const error = (message, status = 400) => json({ ok: false, error: message }, status)

  if (path === '/api/figma/proxy-image' && request.method === 'GET') {
    let target
    try { target = new URL(url.searchParams.get('url')) } catch { return error('图片地址无效') }
    if (!isAllowedFigmaImageUrl(target)) return error('不支持此图片来源', 403)
    try {
      const response = await upstream(target.href, { redirect: 'error', signal: AbortSignal.timeout(30000) })
      const contentType = response.headers.get('Content-Type') || ''
      if (!response.ok || !contentType.startsWith('image/')) return error('图片下载失败', 502)
      return new Response(response.body, { headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      } })
    } catch { return error('图片下载失败，请稍后重试', 502) }
  }

  if (request.method === 'POST' && request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) {
    return error('请求来源无效', 403)
  }

  const requestToken = request.headers.get('X-Figma-Token')?.trim() || ''
  const isManualValidation = path === '/api/figma/validate'
  const token = isManualValidation ? requestToken : (env.FIGMA_API_TOKEN || requestToken)
  if (!token) return error('尚未配置 Figma Token', 401)

  if (request.method === 'POST' && ['/api/figma/list-frames', '/api/figma/recolor-svg'].includes(path)) {
    let data
    try { data = await request.json() } catch { return error('请求格式无效') }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return error('请求格式无效')
    const key = figmaFileKey(data.fileUrl || data.fileKey)
    if (!key) return error('Figma 文件链接或文件 Key 无效')

    if (path === '/api/figma/list-frames') {
      const minWidth = Math.max(0, Number(data.minWidth) || 0)
      const maxWidth = Math.min(100000, Number(data.maxWidth) || 100000)
      if (minWidth > maxWidth) return error('最小宽度不能大于最大宽度')
      try {
        const target = new URL(`${FIGMA_API_BASE}/files/${key}`)
        target.searchParams.set('depth', '3')
        const file = await figmaJson(upstream, target.href, token)
        const allFrames = collectFigmaFrames(file?.document)
        const frames = allFrames.filter(frame => frame.width >= minWidth && frame.width <= maxWidth)
        return json({ ok: true, fileName: String(file?.name || ''), allFrames: allFrames.length, frames })
      } catch (caught) {
        return error(caught instanceof Error ? caught.message : '读取 Figma 文件失败', caught?.status || 502)
      }
    }

    const selectedFrames = Array.isArray(data.frames) ? data.frames.slice(0, 21) : []
    if (!selectedFrames.length) return error('请至少选择一个画板')
    if (selectedFrames.length > 20) return error('每次最多处理 20 个画板')
    const frames = selectedFrames.map(frame => ({
      id: typeof frame?.id === 'string' && /^[A-Za-z0-9:_-]{1,200}$/.test(frame.id) ? frame.id : '',
      name: typeof frame?.name === 'string' ? frame.name.slice(0, 160) : '未命名画板',
    }))
    if (frames.some(frame => !frame.id)) return error('画板 ID 无效')
    if (!Array.isArray(data.mapping) || !data.mapping.length) return error('请先导入颜色映射')
    if (data.mapping.length > 500) return error('颜色映射最多支持 500 条')
    const mapping = data.mapping.map(rule => ({
      light: normalizeHex(rule?.light),
      dark: normalizeHex(rule?.dark),
    }))
    if (mapping.some(rule => !rule.light || !rule.dark)) return error('颜色映射格式无效')
    const direction = data.direction === 'dark-to-light' ? 'dark-to-light' : 'light-to-dark'

    try {
      const target = new URL(`${FIGMA_API_BASE}/images/${key}`)
      target.searchParams.set('ids', frames.map(frame => frame.id).join(','))
      target.searchParams.set('format', 'svg')
      target.searchParams.set('svg_include_id', 'true')
      target.searchParams.set('svg_simplify_stroke', 'false')
      const rendered = await figmaJson(upstream, target.href, token)
      const exports = []
      let totalBytes = 0
      for (const frame of frames) {
        const imageUrl = rendered?.images?.[frame.id]
        if (typeof imageUrl !== 'string' || !imageUrl) continue
        let imageTarget
        try { imageTarget = new URL(imageUrl) } catch { continue }
        if (!isAllowedFigmaImageUrl(imageTarget)) continue
        const response = await upstream(imageTarget.href, { redirect: 'error', signal: AbortSignal.timeout(45000) })
        if (!response.ok) continue
        const svg = await response.text()
        const bytes = new TextEncoder().encode(svg).byteLength
        totalBytes += bytes
        if (!svg.trimStart().startsWith('<svg') || bytes > 4_000_000 || totalBytes > 12_000_000) {
          return error('所选画板导出文件过大，请减少画板数量后重试', 413)
        }
        const recolored = recolorSvg(svg, mapping, direction)
        exports.push({ id: frame.id, name: frame.name, ...recolored })
      }
      if (!exports.length) return error('Figma 未能导出所选画板，请检查文件权限', 502)
      return json({ ok: true, exports, total: exports.length })
    } catch (caught) {
      return error(caught instanceof Error ? caught.message : '导出换色文件失败', caught?.status || 502)
    }
  }

  if (request.method !== 'GET') return error('请使用 GET 请求', 405)

  let figmaPath
  if (path === '/api/figma/me' || isManualValidation) {
    figmaPath = '/me'
  } else {
    const match = path.match(/^\/api\/figma\/(files|images)\/([A-Za-z0-9_-]{1,200})$/)
    if (!match) return error('Figma 接口不存在', 404)
    figmaPath = `/${match[1]}/${match[2]}`
  }

  const target = new URL(`${FIGMA_API_BASE}${figmaPath}`)
  target.search = url.search
  try {
    const response = await upstream(target.href, {
      headers: { 'X-Figma-Token': token },
      signal: AbortSignal.timeout(45000),
    })
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch { return error('Figma API 暂时无法响应，请稍后重试', 504) }
}

function openAIError(data, fallback) {
  return data?.error?.message || data?.message || fallback
}

function openAIImages(data) {
  if (!Array.isArray(data?.data)) return []
  return data.data.flatMap((item) => {
    if (typeof item?.url === 'string' && item.url) return [item.url]
    if (typeof item?.b64_json === 'string' && item.b64_json) {
      return [`data:image/png;base64,${item.b64_json}`]
    }
    return []
  })
}

function openAIOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text) return data.output_text
  if (!Array.isArray(data?.output)) return ''
  for (const item of data.output) {
    if (!Array.isArray(item?.content)) continue
    for (const content of item.content) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return ''
}

function finiteNumber(value, fallback, min, max) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function validHex(value, fallback = '') {
  const normalized = normalizeHex(value)
  return normalized || fallback
}

function normalizeFigmaDesign(input, requestedWidth, requestedHeight) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Codex 返回的设计结构无效')
  const frame = input.frame && typeof input.frame === 'object' ? input.frame : {}
  const palette = input.palette && typeof input.palette === 'object' ? input.palette : {}
  const fallbackPalette = {
    background: '#0B0F14', surface: '#151C24', primary: '#4DA3FF', secondary: '#6B7A90',
    accent: '#35D0A0', text: '#F4F7FA', muted: '#95A2B3', warning: '#FFB547',
  }
  const normalizedPalette = Object.fromEntries(Object.entries(fallbackPalette).map(([keyName, fallback]) => [keyName, validHex(palette[keyName], fallback)]))
  const nodes = []
  const ids = new Set()
  const allowedTypes = new Set(['FRAME', 'COMPONENT', 'RECTANGLE', 'ELLIPSE', 'LINE', 'TEXT'])
  const sourceNodes = Array.isArray(input.nodes) ? input.nodes.slice(0, 160) : []
  for (let index = 0; index < sourceNodes.length; index++) {
    const source = sourceNodes[index]
    if (!source || typeof source !== 'object' || !allowedTypes.has(source.type)) continue
    let id = String(source.id || `node-${index + 1}`).slice(0, 120)
    if (!id || ids.has(id)) id = `node-${index + 1}`
    ids.add(id)
    const textStyle = source.textStyle && typeof source.textStyle === 'object' ? source.textStyle : {}
    const layout = source.layout && typeof source.layout === 'object' ? source.layout : {}
    nodes.push({
      id,
      parentId: typeof source.parentId === 'string' ? source.parentId.slice(0, 120) : null,
      type: source.type,
      name: String(source.name || `${source.type} ${index + 1}`).slice(0, 160),
      x: finiteNumber(source.x, 0, -10000, 10000), y: finiteNumber(source.y, 0, -10000, 10000),
      width: finiteNumber(source.width, 100, 1, 7680), height: finiteNumber(source.height, 100, 1, 7680),
      opacity: finiteNumber(source.opacity, 1, 0, 1), rotation: finiteNumber(source.rotation, 0, -360, 360),
      cornerRadius: finiteNumber(source.cornerRadius, 0, 0, 999),
      fill: validHex(source.fill), stroke: validHex(source.stroke), strokeWidth: finiteNumber(source.strokeWidth, 0, 0, 100),
      text: String(source.text || '').slice(0, 4000),
      textStyle: {
        fontSize: finiteNumber(textStyle.fontSize, 16, 6, 240), fontWeight: finiteNumber(textStyle.fontWeight, 400, 100, 900),
        textAlign: ['LEFT', 'CENTER', 'RIGHT'].includes(textStyle.textAlign) ? textStyle.textAlign : 'LEFT',
        verticalAlign: ['TOP', 'CENTER', 'BOTTOM'].includes(textStyle.verticalAlign) ? textStyle.verticalAlign : 'TOP',
        lineHeight: finiteNumber(textStyle.lineHeight, 20, 6, 400), letterSpacing: finiteNumber(textStyle.letterSpacing, 0, -20, 100),
        color: validHex(textStyle.color, normalizedPalette.text),
      },
      layout: {
        mode: ['NONE', 'HORIZONTAL', 'VERTICAL'].includes(layout.mode) ? layout.mode : 'NONE',
        itemSpacing: finiteNumber(layout.itemSpacing, 0, 0, 1000), paddingTop: finiteNumber(layout.paddingTop, 0, 0, 1000),
        paddingRight: finiteNumber(layout.paddingRight, 0, 0, 1000), paddingBottom: finiteNumber(layout.paddingBottom, 0, 0, 1000),
        paddingLeft: finiteNumber(layout.paddingLeft, 0, 0, 1000), clipContent: layout.clipContent === true,
      },
    })
  }
  const validIds = new Set(nodes.map(node => node.id))
  for (const node of nodes) if (node.parentId && !validIds.has(node.parentId)) node.parentId = null
  return {
    version: '1.0',
    documentName: String(input.documentName || 'Codex HMI').slice(0, 120),
    pageName: String(input.pageName || 'Codex HMI').slice(0, 120),
    summary: String(input.summary || 'Codex 生成的 Figma 原生 HMI 页面').slice(0, 600),
    frame: {
      name: String(frame.name || 'HMI Main').slice(0, 160),
      width: finiteNumber(frame.width, requestedWidth, 320, 7680),
      height: finiteNumber(frame.height, requestedHeight, 320, 7680),
      background: validHex(frame.background, normalizedPalette.background),
    },
    palette: normalizedPalette,
    nodes,
  }
}

async function verifyOpenAIKey(key, env, upstream) {
  if (!key) return { ok: false, configured: false, credit: '尚未配置默认 OpenAI API' }
  const model = env.OPENAI_IMAGE_MODEL || DEFAULT_OPENAI_IMAGE_MODEL
  try {
    const response = await upstream(`${OPENAI_API_BASE}/models/${encodeURIComponent(model)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    })
    if (response.ok) return { ok: true, configured: true, credit: 'OpenAI API 已验证' }
    let data = null
    try { data = await response.json() } catch {}
    return {
      ok: false,
      configured: true,
      credit: [401, 403].includes(response.status)
        ? 'OpenAI API Key 无效或无权访问当前模型'
        : openAIError(data, `OpenAI API 验证失败（${response.status}）`),
    }
  } catch {
    return { ok: false, configured: true, credit: '暂时无法连接 OpenAI API，请稍后重试' }
  }
}

async function handleOpenAIApi(request, env, upstream) {
  const url = new URL(request.url)
  const path = url.pathname
  const requestKey = request.headers.get('X-OpenAI-Api-Key')?.trim() || ''
  const defaultKey = env.OPENAI_API_KEY || ''
  const key = defaultKey || requestKey
  const error = (message, status = 400) => json({ ok: false, images: [], error: message, message }, status)

  if (path === '/api/openai/status' && request.method === 'GET') {
    return json(await verifyOpenAIKey(key, env, upstream))
  }

  if (request.method !== 'POST') return error('请使用 POST 请求', 405)
  let data
  try { data = await request.json() } catch { return error('请求格式无效') }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return error('请求格式无效')

  if (path === '/api/openai/save_key') {
    const candidate = requestKey || (typeof data.api_key === 'string' ? data.api_key.trim() : '')
    if (!candidate) return error('请输入 OpenAI API Key', 400)
    const status = await verifyOpenAIKey(candidate, env, upstream)
    return json({ ...status, message: status.ok ? 'OpenAI API Key 已验证，可保存在当前浏览器' : status.credit }, status.ok ? 200 : 401)
  }

  if (!['/api/openai/text2image', '/api/openai/image2image', '/api/openai/hmi-design'].includes(path)) {
    return error('OpenAI 接口不存在', 404)
  }
  if (!key) return error('尚未配置默认 OpenAI API', 503)
  if (typeof data.prompt !== 'string' || !data.prompt.trim()) return error('请输入生成描述')

  if (path === '/api/openai/hmi-design') {
    const requestedModel = data.model ?? 'default'
    if (!['default', 'gpt-5.3-codex', 'gpt-5', 'gpt-5-mini'].includes(requestedModel)) return error('不支持所选模型，请重新选择')
    const generationModel = requestedModel === 'default' ? (env.OPENAI_CODEX_MODEL || DEFAULT_OPENAI_CODEX_MODEL) : requestedModel
    const width = finiteNumber(data.width, 1920, 320, 7680)
    const height = finiteNumber(data.height, 1080, 320, 7680)
    if (Number(data.width) !== width || Number(data.height) !== height) return error('画板尺寸需在 320 到 7680 像素之间')
    const referenceImage = typeof data.reference_image === 'string' ? data.reference_image : ''
    if (referenceImage && (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(referenceImage) || referenceImage.length > 11_200_000)) {
      return error('参考图必须是小于 8MB 的图片')
    }
    const requestDetails = {
      task: data.prompt.trim().slice(0, 6000),
      scenario: String(data.scenario || 'home').slice(0, 100),
      style: String(data.style || '通用科技风').slice(0, 200),
      requestedComponents: Array.isArray(data.components) ? data.components.slice(0, 30).map(item => String(item).slice(0, 100)) : [],
      canvas: { width, height },
    }
    const systemPrompt = [
      'You are a senior automotive HMI designer and Figma document architect.',
      'Return a production-oriented HMI design as the required JSON document only.',
      'Every visible element must be represented by editable native Figma primitives: frames, components, rectangles, ellipses, lines, and text.',
      'Never use bitmap layers, generated images, SVG markup, vector paths, URLs, gradients, blur, or unsupported effects.',
      'Use at most 160 nodes. Coordinates are relative to the parent. Top-level nodes have parentId null.',
      'Prefer nested FRAME and COMPONENT nodes with semantic English/Chinese names. IDs must be unique and parents must appear before children.',
      'The root frame itself is described by frame, so do not duplicate it in nodes.',
      'Use full six-digit hex colors. Empty fill or stroke is represented by an empty string.',
      'Prioritize glanceability, strong hierarchy, large touch targets, safe contrast, and restrained driver distraction.',
      'Honor the exact requested canvas size and express all geometry in pixels.',
      'For fields irrelevant to a node type, still provide safe neutral values so the schema remains complete.',
    ].join(' ')
    const content = [{ type: 'input_text', text: JSON.stringify(requestDetails) }]
    if (referenceImage) content.push({ type: 'input_image', image_url: referenceImage, detail: 'low' })
    let response
    try {
      response = await upstream(`${OPENAI_API_BASE}/responses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: generationModel,
          reasoning: { effort: 'medium' },
          input: [
            { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
            { role: 'user', content },
          ],
          text: { format: { type: 'json_schema', name: 'hmi_figma_document', strict: true, schema: HMI_FIGMA_SCHEMA } },
        }),
        signal: AbortSignal.timeout(180000),
      })
    } catch {
      return error('Codex API 暂时无法响应，请稍后重试', 504)
    }
    let result
    try { result = await response.json() } catch { return error('Codex 返回了无法识别的数据', 502) }
    if (!response.ok) return error(openAIError(result, `Codex API 请求失败（${response.status}）`), response.status)
    try {
      const output = openAIOutputText(result)
      if (!output) return error('Codex 未返回设计结构', 502)
      const design = normalizeFigmaDesign(JSON.parse(output), width, height)
      if (!design.nodes.length) return error('Codex 返回的设计没有可写入的图层', 502)
      return json({ ok: true, model: generationModel, design })
    } catch (caught) {
      return error(caught instanceof Error ? caught.message : 'Codex 返回的设计结构无效', 502)
    }
  }

  const model = env.OPENAI_IMAGE_MODEL || DEFAULT_OPENAI_IMAGE_MODEL
  let response
  try {
    if (path === '/api/openai/text2image') {
      response = await upstream(`${OPENAI_API_BASE}/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: data.prompt.trim(),
          n: 1,
          size: '1536x1024',
        }),
        signal: AbortSignal.timeout(120000),
      })
    } else {
      if (typeof data.image_base64 !== 'string' || !data.image_base64) return error('请先上传参考图')
      const match = data.image_base64.match(/^data:([^;]+);base64,(.+)$/s)
      const mime = match?.[1]?.startsWith('image/') ? match[1] : 'image/png'
      const encoded = match ? match[2] : data.image_base64
      let bytes
      try {
        const binary = atob(encoded)
        bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      } catch { return error('参考图数据无效') }
      const form = new FormData()
      form.append('model', model)
      form.append('prompt', data.hmi_preview === true ? data.prompt.trim() :
        'Color palette replacement ONLY. Keep the layout, composition, UI positions, sizes, shapes, icons, text and spacing identical. ' +
        'Only change colors, backgrounds, highlights, borders and gradients. ' + data.prompt.trim())
      form.append('size', '1536x1024')
      form.append('n', '1')
      form.append('image', new Blob([bytes], { type: mime }), 'reference.png')
      response = await upstream(`${OPENAI_API_BASE}/images/edits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: AbortSignal.timeout(120000),
      })
    }
  } catch {
    return error('OpenAI API 暂时无法响应，请稍后重试', 504)
  }

  let result
  try { result = await response.json() } catch { return error('OpenAI 返回了无法识别的数据', 502) }
  if (!response.ok) return error(openAIError(result, `OpenAI API 请求失败（${response.status}）`), response.status)
  const images = openAIImages(result)
  return images.length ? json({ ok: true, images }) : error('OpenAI 未返回图片', 502)
}

export async function handleApi(request, env, upstream = fetch) {
  const url = new URL(request.url)
  const path = url.pathname
  if (request.method === 'POST' && request.headers.get('X-HMI-Keep-Alive') === '1' &&
      /^\/api\/(jimeng|openai)\/(text2image|image2image)$/.test(path)) {
    if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json({ ok: false, error: '请求来源无效' }, 403)
    const headers = new Headers(request.headers)
    headers.delete('X-HMI-Keep-Alive')
    const forwarded = new Request(request, { headers })
    return streamImageGeneration(() => handleApi(forwarded, env, upstream))
  }
  if (path === '/api/hmi/vision_status' && request.method === 'GET') {
    const configured = !!(env.JIMENG_API_KEY || env.ARK_API_KEY)
    return json({ ok: configured, configured, verified: false, source: 'server', message: configured ? '已使用服务端默认视觉接入点' : '服务端默认 API Key 未配置' })
  }
  if (path === '/api/hmi/analyze') {
    const result = await analyzeHmi({ httpMethod: request.method, body: request.method === 'POST' ? await request.text() : '' }, env, upstream)
    return new Response(result.body, { status: result.statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  }
  if (path.startsWith('/api/figma/')) return handleFigmaApi(request, env, upstream)
  if (path.startsWith('/api/openai/')) return handleOpenAIApi(request, env, upstream)
  const requestKey = request.headers.get('X-Jimeng-Api-Key')?.trim() || ''
  const defaultKey = env.JIMENG_API_KEY || env.ARK_API_KEY || ''
  const key = defaultKey || requestKey
  const error = (message, status = 400) => json({ ok: false, images: [], error: message, message }, status)
  if (!path.startsWith('/api/jimeng/')) return error('此服务尚未配置', 404)
  if (request.method === 'POST' && request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) {
    return error('请求来源无效', 403)
  }
  if (path === '/api/jimeng/status' && request.method === 'GET') {
    return json(await verifyKey(key, upstream))
  }
  if (path === '/api/jimeng/download' && request.method === 'GET') {
    let target
    try { target = new URL(url.searchParams.get('url')) } catch { return error('图片地址无效') }
    const allowed = ['volces.com', 'byteimg.com', 'ibyteimg.com', 'volccdn.com']
    if (target.protocol !== 'https:' || target.username || target.password || target.port ||
        !allowed.some(host => target.hostname === host || target.hostname.endsWith(`.${host}`))) {
      return error('不支持此图片来源')
    }
    try {
      const response = await upstream(target.href, { redirect: 'error', signal: AbortSignal.timeout(30000) })
      if (!response.ok || !response.headers.get('Content-Type')?.startsWith('image/')) return error('图片下载失败', 502)
      return new Response(response.body, { headers: {
        'Content-Type': response.headers.get('Content-Type'),
        'Content-Disposition': 'attachment; filename="generated-image.png"',
        'Cache-Control': 'private, no-store',
      } })
    } catch { return error('图片下载失败，请稍后重试', 502) }
  }
  if (!['/api/jimeng/save_key', '/api/jimeng/text2image', '/api/jimeng/image2image'].includes(path)) {
    return error('接口不存在', 404)
  }
  if (request.method !== 'POST') return error('请使用 POST 请求', 405)
  if (!key && path !== '/api/jimeng/save_key') return error('尚未配置默认 API', 503)
  let data
  try { data = await request.json() } catch { return error('请求格式无效') }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return error('请求格式无效')
  if (path === '/api/jimeng/save_key') {
    const candidateKey = requestKey || (typeof data.api_key === 'string' ? data.api_key.trim() : '')
    const saveKey = candidateKey || defaultKey
    if (!saveKey) return error('请输入 API Key，或在部署平台配置 JIMENG_API_KEY', 400)
    const status = await verifyKey(saveKey, upstream, !!candidateKey)
    return json({ ...status, message: status.ok ? (candidateKey ? 'API Key 已在当前浏览器保存并验证' : '默认 API 已验证') : status.credit })
  }
  if (typeof data.prompt !== 'string' || !data.prompt.trim()) return error('请输入生成描述')
  const body = {
    model: data.model_version || env.DEFAULT_MODEL || DEFAULT_MODEL,
    prompt: data.prompt.trim(),
    sequential_image_generation: 'disabled',
    size: typeof data.size === 'string' && data.size ? data.size : '2K',
    response_format: data.hmi_preview === true ? 'b64_json' : 'url', stream: false, watermark: false,
  }
  if (path.endsWith('/image2image')) {
    if (typeof data.image_base64 !== 'string' || !data.image_base64) return error('请先上传参考图')
    body.image = [data.image_base64.startsWith('data:') ? data.image_base64 : `data:image/png;base64,${data.image_base64}`]
  }
  try {
    const response = await upstream(`${ARK_BASE}/images/generations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body), signal: AbortSignal.timeout(180000),
    })
    const result = await response.json()
    if (!response.ok) {
      const message = String(result.error?.message || result.message || `生成请求失败（${response.status}）`).split(key).join('[已隐藏]')
      return error(message, response.status)
    }
    const images = (Array.isArray(result.data) ? result.data : []).flatMap(item => {
      if (typeof item.b64_json === 'string' && item.b64_json) {
        const mime = item.b64_json.startsWith('/9j/') ? 'image/jpeg' : item.b64_json.startsWith('UklGR') ? 'image/webp' : 'image/png'
        return [`data:${mime};base64,${item.b64_json}`]
      }
      return item.url ? [item.url] : []
    })
    if (!images.length) return error('服务未返回图片，请调整描述后重试', 502)
    return json({ ok: true, images })
  } catch { return error('生成服务暂时无法响应，请稍后重试', 502) }
}

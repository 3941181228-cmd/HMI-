import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import https from 'node:https'
import http from 'node:http'
import OpenAI from 'openai'
import { toFile } from 'openai'

const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3'
const DEFAULT_MODEL = 'doubao-seedream-5-0-260128'
const FIGMA_API_BASE = 'https://api.figma.com/v1'
// Tripo 3D 生成 API（异步任务模式：提交 → 轮询 → 获取模型 URL）
const TRIPO_API_BASE = 'https://openapi.tripo3d.com/v3'
const TRIPO_DEFAULT_MODEL = 'v3.1-20260211'

// In-memory API key storage (persists during dev session)
let storedApiKey = process.env.ARK_API_KEY || ''
let storedOpenAIKey = process.env.OPENAI_API_KEY || ''
let storedVisionEndpoint = 'ep-20260522095644-hdr5h'  // Endpoint ID for Ark vision model
let storedFigmaKey = process.env.FIGMA_API_TOKEN || ''
// Tripo API Key（用户提供的默认 token，可在运行时覆盖）
let storedTripoKey = process.env.TRIPO_API_KEY || ''

function json(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
  })
}

async function callArkAPI(apiKey: string, requestBody: Record<string, unknown>): Promise<{
  ok: boolean
  images: string[]
  error?: string
  raw?: unknown
}> {
  const resp = await fetch(`${ARK_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  const data = await resp.json()

  if (!resp.ok) {
    const errMsg = data.error?.message || data.error?.code || data.message || ''
    return {
      ok: false,
      images: [],
      error: errMsg || `API 返回错误 (HTTP ${resp.status})`,
      raw: data,
    }
  }

  // Extract image URLs from response
  const images: string[] = []
  if (data.data && Array.isArray(data.data)) {
    for (const item of data.data) {
      if (item.url) images.push(item.url)
      else if (item.b64_json) images.push(`data:image/png;base64,${item.b64_json}`)
    }
  }

  if (images.length > 0) {
    return { ok: true, images }
  }

  return {
    ok: false,
    images: [],
    error: data.error?.message || 'No images in response',
    raw: data,
  }
}

export function jimengServerPlugin(): Plugin {
  return {
    name: 'jimeng-server',
    configureServer(server: ViteDevServer) {

      // Get current API key status (with lightweight validation)
      server.middlewares.use('/api/jimeng/status', async (_req, res) => {
        const hasKey = !!storedApiKey
        if (!hasKey) {
          json(res, 200, { ok: false, credit: '' })
          return
        }

        try {
          const resp = await fetch(`${ARK_BASE}/models`, {
            headers: { 'Authorization': `Bearer ${storedApiKey}` },
          })
          if (resp.ok) {
            json(res, 200, { ok: true, credit: 'API Key 已验证有效' })
          } else if (resp.status === 401 || resp.status === 403) {
            json(res, 200, { ok: false, credit: 'API Key 无效或已过期' })
          } else {
            json(res, 200, { ok: true, credit: 'API Key 已配置（状态未知）' })
          }
        } catch {
          json(res, 200, { ok: false, credit: '无法连接至 Ark API，请检查网络' })
        }
      })

      // Save API key
      server.middlewares.use('/api/jimeng/save_key', async (req, res) => {
        if (req.method !== 'POST') {
          json(res, 405, { error: 'Method Not Allowed' })
          return
        }

        const body = await readBody(req)
        try {
          const data = JSON.parse(body)
          const key = (data.api_key || '').trim()
          if (!key) {
            json(res, 400, { error: 'api_key is required' })
            return
          }
          storedApiKey = key

          try {
            const checkResp = await fetch(`${ARK_BASE}/models`, {
              headers: { 'Authorization': `Bearer ${key}` },
            })
            if (checkResp.ok) {
              json(res, 200, { ok: true, message: 'API Key 已验证有效，保存成功' })
            } else if (checkResp.status === 401 || checkResp.status === 403) {
              json(res, 200, { ok: false, message: 'API Key 无效或已过期，已保存但不可用' })
            } else {
              json(res, 200, { ok: true, message: 'API Key 已保存（无法验证状态）' })
            }
          } catch {
            json(res, 200, { ok: true, message: 'API Key 已保存（无法连接至 Ark API）' })
          }
        } catch {
          json(res, 400, { error: 'Invalid JSON' })
        }
      })

      // Text to Image
      server.middlewares.use('/api/jimeng/text2image', async (req, res) => {
        if (req.method !== 'POST') {
          json(res, 405, { error: 'Method Not Allowed' })
          return
        }

        if (!storedApiKey) {
          json(res, 401, { error: '请先配置 API Key' })
          return
        }

        const body = await readBody(req)
        try {
          const data = JSON.parse(body)
          const prompt = data.prompt || ''
          if (!prompt) {
            json(res, 400, { error: 'prompt is required' })
            return
          }

          const requestBody: Record<string, unknown> = {
            model: data.model_version || DEFAULT_MODEL,
            prompt,
            sequential_image_generation: 'disabled',
            // 支持前端传入具体尺寸（如 "2560x1440"）或档位（如 "2K"），默认 2K
            size: data.size || '2K',
            response_format: 'url',
            stream: false,
            watermark: false,
          }

          const result = await callArkAPI(storedApiKey, requestBody)
          json(res, result.ok ? 200 : 500, result)
        } catch (err) {
          json(res, 500, { ok: false, images: [], error: String(err) })
        }
      })

      // Image to Image
      server.middlewares.use('/api/jimeng/image2image', async (req, res) => {
        if (req.method !== 'POST') {
          json(res, 405, { error: 'Method Not Allowed' })
          return
        }

        if (!storedApiKey) {
          json(res, 401, { error: '请先配置 API Key' })
          return
        }

        const body = await readBody(req)
        try {
          const data = JSON.parse(body)
          const prompt = data.prompt || ''
          const imageBase64 = data.image_base64 || ''

          if (!imageBase64) {
            json(res, 400, { error: 'image_base64 is required' })
            return
          }

          // For the Ark API, we need to pass image as a URL or base64 data URI
          // The API accepts data URIs in the image array
          const imageDataUri = imageBase64.startsWith('data:')
            ? imageBase64
            : `data:image/png;base64,${imageBase64}`

          const requestBody: Record<string, unknown> = {
            model: data.model_version || DEFAULT_MODEL,
            prompt,
            image: [imageDataUri],
            // strength < 0.5 keeps structure close to original; only colors change
            strength: typeof data.strength === 'number' ? data.strength : 0.35,
            sequential_image_generation: 'disabled',
            // 支持前端传入具体尺寸（如 "2560x1440"）或档位（如 "2K"），默认 2K
            size: data.size || '2K',
            response_format: 'url',
            stream: false,
            watermark: false,
          }

          const result = await callArkAPI(storedApiKey, requestBody)
          json(res, result.ok ? 200 : 500, result)
        } catch (err) {
          json(res, 500, { ok: false, images: [], error: String(err) })
        }
      })

      // Query result (kept for backwards compat, but Ark API is synchronous)
      server.middlewares.use('/api/jimeng/query_result', async (_req, res) => {
        json(res, 200, { success: false, querying: false, gen_status: 'not_applicable' })
      })

      // Proxy download: fetch external image and pipe back to avoid CORS
      server.middlewares.use('/api/jimeng/download', async (req, res) => {
        const url = new URL(req.url || '', 'http://localhost')
        const imageUrl = url.searchParams.get('url')
        if (!imageUrl) {
          json(res, 400, { error: 'url is required' })
          return
        }
        try {
          const resp = await fetch(imageUrl)
          if (!resp.ok) {
            json(res, 502, { error: `Upstream ${resp.status}` })
            return
          }
          const contentType = resp.headers.get('content-type') || 'image/jpeg'
          const buffer = await resp.arrayBuffer()
          res.statusCode = 200
          res.setHeader('Content-Type', contentType)
          res.setHeader('Content-Disposition', 'attachment; filename="hmi-generated.png"')
          res.end(Buffer.from(buffer))
        } catch (err) {
          json(res, 500, { error: String(err) })
        }
      })

      // Proxy image display: fetch external image and serve for inline display
      server.middlewares.use('/api/jimeng/proxy_image', async (req, res) => {
        const url = new URL(req.url || '', 'http://localhost')
        const imageUrl = url.searchParams.get('url')
        if (!imageUrl) {
          json(res, 400, { error: 'url is required' })
          return
        }
        try {
          const resp = await fetch(imageUrl)
          if (!resp.ok) {
            json(res, 502, { error: `Upstream ${resp.status}` })
            return
          }
          const contentType = resp.headers.get('content-type') || 'image/jpeg'
          const buffer = await resp.arrayBuffer()
          res.statusCode = 200
          res.setHeader('Content-Type', contentType)
          res.setHeader('Cache-Control', 'max-age=3600')
          res.end(Buffer.from(buffer))
        } catch (err) {
          json(res, 500, { error: String(err) })
        }
      })

      // ── OpenAI GPT-image-1 ────────────────────────────────────────────

      // Save OpenAI API key
      server.middlewares.use('/api/openai/save_key', async (req, res) => {
        if (req.method !== 'POST') { json(res, 405, { error: 'Method Not Allowed' }); return }
        const body = await readBody(req)
        try {
          const data = JSON.parse(body)
          const key = (data.api_key || '').trim()
          if (!key) { json(res, 400, { error: 'api_key is required' }); return }
          storedOpenAIKey = key
          json(res, 200, { ok: true })
        } catch { json(res, 400, { error: 'Invalid JSON' }) }
      })

      // OpenAI status
      server.middlewares.use('/api/openai/status', async (_req, res) => {
        json(res, 200, { ok: !!storedOpenAIKey })
      })

      // OpenAI text to image (gpt-image-1)
      server.middlewares.use('/api/openai/text2image', async (req, res) => {
        if (req.method !== 'POST') { json(res, 405, { error: 'Method Not Allowed' }); return }
        if (!storedOpenAIKey) { json(res, 401, { error: '请先配置 OpenAI API Key' }); return }

        const body = await readBody(req)
        try {
          const data = JSON.parse(body)
          const prompt = data.prompt || ''
          if (!prompt) { json(res, 400, { error: 'prompt is required' }); return }

          const openai = new OpenAI({ apiKey: storedOpenAIKey })
          const response = await openai.images.generate({
            model: 'gpt-image-1',
            prompt,
            n: 1,
            size: '1536x1024',
          })

          const images: string[] = []
          for (const item of response.data ?? []) {
            if (item.url) images.push(item.url)
            else if (item.b64_json) images.push(`data:image/png;base64,${item.b64_json}`)
          }
          json(res, images.length > 0 ? 200 : 500, { ok: images.length > 0, images, error: images.length > 0 ? undefined : 'No images returned' })
        } catch (err) {
          json(res, 500, { ok: false, images: [], error: err instanceof Error ? err.message : String(err) })
        }
      })

      // OpenAI image to image (gpt-image-1 edit)
      server.middlewares.use('/api/openai/image2image', async (req, res) => {
        if (req.method !== 'POST') { json(res, 405, { error: 'Method Not Allowed' }); return }
        if (!storedOpenAIKey) { json(res, 401, { error: '请先配置 OpenAI API Key' }); return }

        const body = await readBody(req)
        try {
          const data = JSON.parse(body)
          const userPrompt = data.prompt || ''
          const imageBase64 = data.image_base64 || ''
          if (!imageBase64) { json(res, 400, { error: 'image_base64 is required' }); return }

          // Prepend strict color-only instruction for gpt-image-1
          const prompt =
            'Color palette replacement ONLY. ' +
            'Keep 100% identical: layout, composition, all UI element positions, sizes, shapes, icons, text content, and spacing. ' +
            'Do NOT add, remove, or move any element. ' +
            'ONLY change color values (backgrounds, highlights, borders, text colors, gradients) to match the specified palette. ' +
            userPrompt

          const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
          const imgBuffer = Buffer.from(base64Data, 'base64')
          const imgFile = await toFile(imgBuffer, 'reference.png', { type: 'image/png' })

          const openai = new OpenAI({ apiKey: storedOpenAIKey })
          const response = await openai.images.edit({
            model: 'gpt-image-1',
            image: imgFile,
            prompt,
            n: 1,
            size: '1536x1024',
          })

          const images: string[] = []
          for (const item of response.data ?? []) {
            if (item.url) images.push(item.url)
            else if (item.b64_json) images.push(`data:image/png;base64,${item.b64_json}`)
          }
          json(res, images.length > 0 ? 200 : 500, { ok: images.length > 0, images, error: images.length > 0 ? undefined : 'No images returned' })
        } catch (err) {
          json(res, 500, { ok: false, images: [], error: err instanceof Error ? err.message : String(err) })
        }
      })

      // ── HMI Edit: Image Analysis (PNG → editable / Text extraction) ───
      // Uses Volcengine Ark API vision model (requires Endpoint ID)

      // Save vision endpoint ID
      server.middlewares.use('/api/hmi/save_vision_endpoint', async (req, res) => {
        if (req.method !== 'POST') { json(res, 405, { error: 'Method Not Allowed' }); return }
        const body = await readBody(req)
        try {
          const data = JSON.parse(body)
          const ep = (data.endpoint_id || '').trim()
          if (!ep) { json(res, 400, { error: 'endpoint_id is required' }); return }
          storedVisionEndpoint = ep
          json(res, 200, { ok: true })
        } catch { json(res, 400, { error: 'Invalid JSON' }) }
      })

      // Get vision endpoint status
      server.middlewares.use('/api/hmi/vision_status', async (_req, res) => {
        json(res, 200, { ok: !!storedVisionEndpoint, endpoint_id: storedVisionEndpoint ? storedVisionEndpoint.slice(0, 8) + '...' : '' })
      })

      server.middlewares.use('/api/hmi/analyze', async (req, res) => {
        if (req.method !== 'POST') { json(res, 405, { error: 'Method Not Allowed' }); return }
        if (!storedApiKey) { json(res, 401, { error: '请先配置火山方舟 API Key' }); return }
        if (!storedVisionEndpoint) { json(res, 401, { error: '请先配置视觉模型推理接入点（Endpoint ID），在设置面板中填写' }); return }

        const body = await readBody(req)
        try {
          const data = JSON.parse(body)
          const mode = data.mode || 'png2svg' // 'png2svg' | 'text_extract'
          const imageBase64 = data.image_base64 || ''
          if (!imageBase64) { json(res, 400, { error: 'image_base64 is required' }); return }

          const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
          const imageUrl = `data:image/png;base64,${base64Data}`

          let systemPrompt: string
          if (mode === 'text_extract') {
            systemPrompt = `你是一个专业的 HMI 界面文本提取专家。用户会给你一张 HMI 界面的截图，你需要：
1. 识别并提取图片中所有可见文本
2. 按区域分组（如：状态栏、导航区、仪表区、媒体区、空调区等）
3. 返回 JSON 格式结果，结构如下：
{
  "regions": [
    {
      "name": "区域名称",
      "texts": [
        { "content": "文本内容", "type": "label|value|unit|title|button", "description": "文本用途说明" }
      ]
    }
  ],
  "summary": "整体文本概要"
}
只返回纯 JSON，不要其他文字。`
          } else {
            // PNG转SVG切图模式：让AI直接输出SVG，按独立元素切分，用标记分隔避免JSON转义问题
            systemPrompt = `你是专业的 UI 切图专家。请仔细观察用户上传的 HMI 车载界面 PNG 截图，将画面中每一个独立的 UI 元素识别出来，并为每个元素单独绘制一个 SVG。

【核心要求】
不是按"状态栏/仪表盘"这种大区域划分，而是要切到最小独立元素级别！每个图标、每个按钮、每个圆环、每个弹窗、每个遮罩、每个卡片、每个进度条、每个文字块、每个指示灯都要单独生成一个 SVG。

【需要识别并切分的元素类型】
1. icon - 所有独立小图标（设置图标、返回箭头、菜单图标、蓝牙图标、信号图标、音量图标、空调风向图标等）
2. gauge - 仪表盘圆环、速度表、转速表、进度环（每个环单独一个SVG）
3. button - 可点击按钮（圆形按钮、方形按钮、文字按钮、图标按钮等）
4. card - 独立卡片/面板/容器（弹窗面板、信息卡片、设置项等）
5. background - 底图/背景层（整体背景、渐变背景、地图底图）
6. mask - 遮罩层（半透明遮罩、模糊遮罩、渐变遮罩）
7. popup - 弹窗/对话框（整个弹窗作为一个元素）
8. progress - 进度条/滑块条
9. text - 独立文本块（时间显示、速度数值、温度数值、标题文字等，如果是独立文本就单独切）
10. indicator - 指示灯/状态点/小圆点
11. nav_item - 导航栏中的每个导航项
12. media_cover - 媒体封面/专辑封面
13. divider - 分割线/分隔线
14. shape - 其他独立几何图形（装饰条、装饰圆、边框等）

【输出格式】
对每个识别到的独立元素，按以下格式输出一个块：

[HMI_SVG_BEGIN id="唯一英文ID" name="中文描述名称" category="元素类型" x="元素在原图左上角x坐标" y="元素在原图左上角y坐标" width="元素宽度" height="元素高度"]
<svg viewBox="0 0 宽 高" xmlns="http://www.w3.org/2000/svg">
  <!-- 只绘制这个元素本身，不要包含其他元素 -->
  <!-- viewBox的宽高刚好包裹该元素 -->
</svg>
[HMI_SVG_END]

例如，如果画面中有：
- 一个半透明遮罩 → 单独一个mask类型的SVG
- 一个弹窗面板 → 单独一个popup类型的SVG（包含弹窗内部的背景和边框）
- 弹窗里有一个关闭X图标 → 单独一个icon类型的SVG
- 弹窗里有一段标题文字 → 单独一个text类型的SVG
- 弹窗里有两个按钮 → 每个按钮单独一个button类型的SVG
- 底部有3个导航图标 → 每个图标单独一个icon类型的SVG
- 中央有一个速度圆环 → 单独一个gauge类型的SVG
- 速度圆环中间有数字"80" → 单独一个text类型的SVG
- 右上角有信号、蓝牙、电量3个小图标 → 每个单独一个icon类型的SVG
- 整体深色背景 → 单独一个background类型的SVG
...以此类推，直到所有独立元素都被切分出来。

【SVG绘制规范】
1. 每个<svg>必须有viewBox="0 0 W H"，W和H是该元素自身的宽高（不是整个画面的）
2. 每个<svg>必须有xmlns="http://www.w3.org/2000/svg"
3. 只绘制当前元素本身，不要包含其他元素（其他元素会有自己的SVG块）
4. 坐标(x,y)是该元素在原始界面中的精确像素位置（左上角为原点）
5. width/height是该元素精确的像素宽高
6. 颜色尽量匹配原图，使用#RRGGBB格式
7. 使用标准SVG元素：rect, circle, ellipse, path, line, polyline, polygon, text, g
8. 【绝对禁止】使用<image>标签引用任何外部图片或URL，所有图形必须用SVG基本元素绘制
9. 文字使用<text>标签，字体用font-family="system-ui,sans-serif"
10. 圆角用rx/ry属性，环形进度用stroke-dasharray/stroke-dashoffset
11. 切出8-15个主要的独立元素即可（优先切大的、显眼的元素）

【非常重要】
- 严格按照上面的标记格式输出，[HMI_SVG_BEGIN...]和[HMI_SVG_END]必须成对出现
- 标记里的id/name/category/x/y/width/height属性都要用双引号括起来
- 不要输出markdown代码块，不要输出解释文字，不要说"好的"或"以下是"
- 直接以[HMI_SVG_BEGIN开头开始输出所有元素
- 一个元素一个块，连续输出所有块
- SVG代码尽量简洁，不要写注释`
          }

          const requestBody = {
            model: storedVisionEndpoint,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: imageUrl } },
                  { type: 'text', text: mode === 'text_extract'
                    ? '请提取这张 HMI 界面中的所有文本'
                    : '请根据这张HMI界面截图，按照要求的格式生成各个独立元素的SVG切图。'
                  },
                ],
              },
            ],
            max_tokens: mode === 'text_extract' ? 4096 : 12288,
            temperature: mode === 'text_extract' ? 0.3 : 0.2,
          }

          const resp = await fetch(`${ARK_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${storedApiKey}`,
            },
            body: JSON.stringify(requestBody),
          })

          const respData = await resp.json()

          if (!resp.ok) {
            const errMsg = respData.error?.message || respData.message || `Ark vision API error ${resp.status}`
            json(res, resp.status, { ok: false, error: errMsg, raw: respData })
            return
          }

          const rawContent: string = respData.choices?.[0]?.message?.content || ''

          if (mode === 'text_extract') {
            // 文本提取模式：尝试解析JSON
            const codeMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/)
            const toParse = codeMatch ? codeMatch[1].trim() : rawContent.substring(rawContent.indexOf('{'), rawContent.lastIndexOf('}') + 1)
            let parsed: unknown
            try {
              parsed = JSON.parse(toParse)
            } catch {
              parsed = { regions: [], summary: '文本提取结果解析失败', _raw: rawContent.substring(0, 500) }
            }
            json(res, 200, { ok: true, mode, result: parsed })
          } else {
            // SVG切图模式：直接从文本提取SVG块，完全避免JSON解析
            const extracted = extractSVGBlocksFromText(rawContent)
            json(res, 200, { ok: true, mode, result: extracted })
          }
        } catch (err) {
          json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) })
        }
      })

      // ── SVG 块提取函数 ──────────────────────────────────────────────
      // 清理SVG：移除<image>标签和外部引用，防止浏览器加载无效URL
      function sanitizeSVG(svgStr: string): string {
        // 移除所有<image ... />或<image ...></image>标签（自闭合或成对）
        let cleaned = svgStr.replace(/<image\b[^>]*\/?>/gi, '')
        cleaned = cleaned.replace(/<image\b[^>]*>[\s\S]*?<\/image>/gi, '')
        // 移除任何包含href或xlink:href引用外部URL的属性
        cleaned = cleaned.replace(/\s+(?:xlink:)?href\s*=\s*["']https?:\/\/[^"']*["']/gi, '')
        return cleaned
      }

      function extractSVGBlocksFromText(text: string) {
        interface ExtractedComp { id: string; name: string; category: string; x: number; y: number; width: number; height: number; svg: string }
        const components: ExtractedComp[] = []
        let canvasBg = '#0f172a'

        // 尝试提取背景色
        const bgMatch = text.match(/background["']?\s*[:=]\s*["']?(#[0-9a-fA-F]{3,8})/)
        if (bgMatch) canvasBg = bgMatch[1]

        // 方法1: 使用 [HMI_SVG_BEGIN ...]...<svg>...</svg>...[HMI_SVG_END] 标记提取
        const markerRegex = /\[HMI_SVG_BEGIN([^\]]*)\]([\s\S]*?)\[HMI_SVG_END\]/gi
        let m: RegExpExecArray | null
        while ((m = markerRegex.exec(text)) !== null) {
          const attrsStr = m[1] || ''
          const content = m[2] || ''
          const attrs: Record<string, string> = {}
          const attrRegex = /(\w+)="([^"]*)"/g
          let am: RegExpExecArray | null
          while ((am = attrRegex.exec(attrsStr)) !== null) {
            attrs[am[1].toLowerCase()] = am[2]
          }
          const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/i)
          if (svgMatch) {
            let svgContent = sanitizeSVG(svgMatch[0])
            const viewBoxMatch = svgContent.match(/viewBox=["']\d+\s+\d+\s+(\d+)\s+(\d+)["']/i)
            const wAttrMatch = svgContent.match(/width=["'](\d+)["']/i)
            const hAttrMatch = svgContent.match(/height=["'](\d+)["']/i)
            let w = Number(attrs.width) || (viewBoxMatch ? Number(viewBoxMatch[1]) : 0) || (wAttrMatch ? Number(wAttrMatch[1]) : 0) || 200
            let h = Number(attrs.height) || (viewBoxMatch ? Number(viewBoxMatch[2]) : 0) || (hAttrMatch ? Number(hAttrMatch[1]) : 0) || 100
            if (!/xmlns=/.test(svgContent)) {
              svgContent = svgContent.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
            }
            components.push({
              id: attrs.id || `svg_${components.length}`,
              name: attrs.name || `组件 ${components.length + 1}`,
              category: attrs.category || 'widget',
              x: Number(attrs.x) || 0,
              y: Number(attrs.y) || 0,
              width: w,
              height: h,
              svg: svgContent,
            })
          }
        }

        // 方法2: 如果没有标记，直接提取所有<svg>...</svg>块（备用方案）
        if (components.length === 0) {
          const svgRegex = /<svg[\s\S]*?<\/svg>/gi
          let sm: RegExpExecArray | null
          let idx = 0
          const categoryNames = ['icon','gauge','button','card','background','mask','popup','progress','text','indicator','nav_item','media_cover','divider','shape','dashboard','map','media','climate','widget','status_bar','navigation','control']
          const nameMap: Record<string, string> = {
            icon:'图标',gauge:'仪表/圆环',button:'按钮',card:'卡片/面板',background:'底图/背景',
            mask:'遮罩层',popup:'弹窗',progress:'进度条',text:'文本',indicator:'指示灯',
            nav_item:'导航项',media_cover:'媒体封面',divider:'分割线',shape:'图形装饰',
            status_bar:'状态栏',navigation:'导航栏',dashboard:'仪表盘',map:'地图区域',
            media:'媒体中心',climate:'空调控制',vehicle_info:'车辆信息',control:'快捷控制',widget:'通用组件',
          }
          while ((sm = svgRegex.exec(text)) !== null && idx < 50) {
            const svgContent0 = sanitizeSVG(sm[0])
            const vbMatch = svgContent0.match(/viewBox=["']\d+\s+\d+\s+(\d+)\s+(\d+)["']/i)
            const wMatchA = svgContent0.match(/width=["'](\d+)["']/i)
            const hMatchA = svgContent0.match(/height=["'](\d+)["']/i)
            const w0 = (vbMatch ? Number(vbMatch[1]) : 0) || (wMatchA ? Number(wMatchA[1]) : 0) || 200
            const h0 = (vbMatch ? Number(vbMatch[2]) : 0) || (hMatchA ? Number(hMatchA[1]) : 0) || 100
            const beforeText = text.substring(Math.max(0, sm.index - 200), sm.index)
            let category = 'widget'
            let name = `组件 ${idx + 1}`
            for (const cat of categoryNames) {
              if (beforeText.toLowerCase().includes(cat.replace('_','')) || beforeText.includes(nameMap[cat] || '')) {
                category = cat; name = nameMap[cat] || name; break
              }
            }
            let finalSvg = svgContent0
            if (!/xmlns=/.test(finalSvg)) {
              finalSvg = finalSvg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
            }
            components.push({ id:`svg_${idx}`, name, category, x:0, y:idx*200, width:w0, height:h0, svg:finalSvg })
            idx++
          }
        }

        // 估算画布尺寸
        let maxW = 1920, maxH = 1080
        for (const c of components) {
          maxW = Math.max(maxW, c.x + c.width + 100)
          maxH = Math.max(maxH, c.y + c.height + 100)
        }

        return {
          canvas: { width: maxW, height: maxH, background: canvasBg },
          svgComponents: components,
          summary: components.length > 0
            ? `成功提取 ${components.length} 个 SVG 切图元素`
            : 'AI 未能生成有效的 SVG 组件，请重试或更换更清晰的截图',
        }
      }

      // ── Tripo 3D 模型生成（异步任务模式）──────────────────────────────

      // 提交文生 3D 模型任务，返回 task_id
      server.middlewares.use('/api/tripo/text-to-model', async (req, res) => {
        if (req.method !== 'POST') { json(res, 405, { error: 'Method Not Allowed' }); return }
        if (!storedTripoKey) { json(res, 401, { error: '请先配置 Tripo API Key' }); return }

        const body = await readBody(req)
        try {
          const data = JSON.parse(body)
          const prompt = data.prompt || ''
          if (!prompt) { json(res, 400, { error: 'prompt is required' }); return }

          const requestBody: Record<string, unknown> = {
            prompt,
            model: data.model || TRIPO_DEFAULT_MODEL,
          }

          const resp = await fetch(`${TRIPO_API_BASE}/generation/text-to-model`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${storedTripoKey}`,
            },
            body: JSON.stringify(requestBody),
          })

          const respData = await resp.json()
          // Tripo 成功返回 { code: 0, data: { task_id } }；失败返回 { code, status:'error', message }
          if (!resp.ok || respData.code !== 0) {
            json(res, resp.ok ? 400 : resp.status, {
              ok: false,
              error: respData.message || respData.error || `Tripo API 返回错误 (HTTP ${resp.status})`,
              code: respData.code,
            })
            return
          }

          json(res, 200, { ok: true, task_id: respData.data?.task_id })
        } catch (err) {
          json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) })
        }
      })

      // 图生 3D 模型：POST /api/tripo/image-to-model
      // 流程：前端传 base64 图片 → 后端上传到 /v3/files 获取 file_token → 调用 image-to-model
      server.middlewares.use('/api/tripo/image-to-model', async (req, res) => {
        if (req.method !== 'POST') { json(res, 405, { error: 'Method Not Allowed' }); return }
        if (!storedTripoKey) { json(res, 401, { error: '请先配置 Tripo API Key' }); return }

        const body = await readBody(req)
        try {
          const data = JSON.parse(body)
          const image = data.image || ''
          if (!image) { json(res, 400, { error: 'image is required' }); return }

          // 解析 data URI，提取 mime 类型与 base64 数据
          const m = image.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/)
          if (!m) { json(res, 400, { error: '图片格式无效，需为 data URI' }); return }
          const mime = m[1]
          const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
          const imgBuffer = Buffer.from(m[2], 'base64')

          // 1. 上传图片到 Tripo /v3/files，构造 multipart/form-data
          const boundary = `----TripoBoundary${Date.now()}`
          const multipartBody = Buffer.concat([
            Buffer.from(`--${boundary}\r\n`),
            Buffer.from(`Content-Disposition: form-data; name="file"; filename="upload.${ext}"\r\n`),
            Buffer.from(`Content-Type: ${mime}\r\n\r\n`),
            imgBuffer,
            Buffer.from(`\r\n--${boundary}--\r\n`),
          ])

          const uploadResp = await fetch(`${TRIPO_API_BASE}/files`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${storedTripoKey}`,
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: multipartBody,
          })
          const uploadData = await uploadResp.json()
          if (!uploadResp.ok || uploadData.code !== 0) {
            json(res, uploadResp.ok ? 400 : uploadResp.status, {
              ok: false,
              error: uploadData.message || `图片上传失败 (HTTP ${uploadResp.status})`,
            })
            return
          }
          const fileToken = uploadData.data?.file_token
          if (!fileToken) { json(res, 500, { ok: false, error: '图片上传成功但未返回 file_token' }); return }

          // 2. 用 file_token 调用 image-to-model
          const genResp = await fetch(`${TRIPO_API_BASE}/generation/image-to-model`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${storedTripoKey}`,
            },
            body: JSON.stringify({
              input: fileToken,
              model: data.model || TRIPO_DEFAULT_MODEL,
            }),
          })
          const genData = await genResp.json()
          if (!genResp.ok || genData.code !== 0) {
            json(res, genResp.ok ? 400 : genResp.status, {
              ok: false,
              error: genData.message || `image-to-model 失败 (HTTP ${genResp.status})`,
              code: genData.code,
            })
            return
          }

          json(res, 200, { ok: true, task_id: genData.data?.task_id })
        } catch (err) {
          json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) })
        }
      })

      // 轮询任务状态：GET /api/tripo/task?id=<task_id>
      // 返回统一格式 { ok, status, progress, models: {glb,...}, error }
      server.middlewares.use('/api/tripo/task', async (req, res) => {
        if (!storedTripoKey) { json(res, 401, { error: '请先配置 Tripo API Key' }); return }

        const url = new URL(req.url || '', 'http://localhost')
        const taskId = url.searchParams.get('id')
        if (!taskId) { json(res, 400, { error: 'id (task_id) is required' }); return }

        try {
          const resp = await fetch(`${TRIPO_API_BASE}/tasks/${taskId}`, {
            headers: { 'Authorization': `Bearer ${storedTripoKey}` },
          })
          const respData = await resp.json()

          if (!resp.ok || respData.code !== 0) {
            json(res, resp.ok ? 400 : resp.status, {
              ok: false,
              status: 'error',
              error: respData.message || `查询任务失败 (HTTP ${resp.status})`,
            })
            return
          }

          const task = respData.data || {}
          // Tripo 任务状态：queued / running / success / failed / cancelled
          const status: string = task.status || 'unknown'
          const progress: number = typeof task.progress === 'number' ? task.progress : 0

          // 成功时提取模型输出（多种格式：glb / usdz / fbx / obj 等）
          const models: Record<string, string> = {}
          const output = task.output || {}
          if (status === 'success' && output && typeof output === 'object') {
            for (const [key, val] of Object.entries(output)) {
              if (typeof val === 'string' && /^https?:\/\//.test(val)) {
                models[key] = val
              }
            }
          }

          json(res, 200, {
            ok: status === 'success',
            status,
            progress,
            models,
            error: status === 'failed' ? (task.message || '任务生成失败') : undefined,
          })
        } catch (err) {
          json(res, 500, { ok: false, status: 'error', error: err instanceof Error ? err.message : String(err) })
        }
      })

      // 代理 3D 模型文件，规避浏览器 CORS 限制：GET /api/tripo/proxy-model?url=<model_url>
      server.middlewares.use('/api/tripo/proxy-model', async (req, res) => {
        const url = new URL(req.url || '', 'http://localhost')
        const modelUrl = url.searchParams.get('url')
        if (!modelUrl) { json(res, 400, { error: 'url is required' }); return }

        try {
          const resp = await fetch(modelUrl)
          if (!resp.ok) { json(res, 502, { error: `Upstream ${resp.status}` }); return }
          const contentType = resp.headers.get('content-type') || 'model/gltf-binary'
          const buffer = await resp.arrayBuffer()
          res.statusCode = 200
          res.setHeader('Content-Type', contentType)
          res.setHeader('Cache-Control', 'max-age=3600')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(Buffer.from(buffer))
        } catch (err) {
          json(res, 500, { error: String(err) })
        }
      })

      // ── Figma API 动态代理 ──────────────────────────────────────────
      // 优先使用服务端默认 Token；未配置时允许浏览器本地 Token 作为回退
      // 服务端 fetch 带 45 秒超时，防止 Node.js undici 默认 5 分钟 headersTimeout 导致卡死
      async function proxyFigmaRequest(req: IncomingMessage, res: ServerResponse, figmaPath: string, validateManual = false) {
        const requestToken = (req.headers['x-figma-token'] as string || '').trim()
        const token = validateManual ? requestToken : (storedFigmaKey || requestToken)
        if (!token) {
          json(res, 401, { ok: false, error: '请先配置 Figma Personal Access Token' })
          return
        }

        // 构建Figma API URL，保留query string
        const rawUrl = req.url || ''
        const queryIndex = rawUrl.indexOf('?')
        const queryString = queryIndex >= 0 ? rawUrl.substring(queryIndex) : ''
        const targetUrl = `${FIGMA_API_BASE}${figmaPath}${queryString}`

        console.log('[Figma Proxy] 请求Figma API:', targetUrl)

        // 45 秒超时，比前端 60s/30s 超时更短，确保服务端先返回错误而非让前端干等
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 45000)

        try {
          const figmaResp = await fetch(targetUrl, {
            method: req.method || 'GET',
            headers: {
              'X-Figma-Token': token,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          })

          const data = await figmaResp.json()
          console.log('[Figma Proxy] Figma响应状态:', figmaResp.status, data.err || data.message || '')
          res.statusCode = figmaResp.status
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify(data))
        } catch (err) {
          const isTimeout = err instanceof Error && err.name === 'AbortError'
          console.error('[Figma Proxy] 请求失败:', isTimeout ? '超时(45s)' : err)
          json(res, 504, { ok: false, error: isTimeout
            ? 'Figma API 请求超时（45秒），请检查网络连接后重试'
            : `Figma API 请求失败: ${err instanceof Error ? err.message : String(err)}` })
        } finally {
          clearTimeout(timeout)
        }
      }

      // Figma 用户信息（验证Token）
      server.middlewares.use('/api/figma/me', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Figma-Token')
          res.end()
          return
        }
        await proxyFigmaRequest(req, res, '/me')
      })

      // 单独验证用户手动输入的 Token，避免默认 Token 掩盖无效输入
      server.middlewares.use('/api/figma/validate', async (req, res) => {
        await proxyFigmaRequest(req, res, '/me', true)
      })

      // Figma 获取文件
      server.middlewares.use('/api/figma/files', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Figma-Token')
          res.end()
          return
        }
        // 从URL中提取fileKey: 可能是 /api/figma/files/FILE_KEY 或 /FILE_KEY (挂载后的相对路径)
        const urlPath = req.url || ''
        const pathMatch = urlPath.match(/^\/api\/figma\/files\/([^/?]+)/) || urlPath.match(/^\/([^/?]+)/)
        if (!pathMatch) {
          console.error('[Figma Proxy] 无法解析文件Key, req.url:', urlPath)
          json(res, 400, { ok: false, error: '缺少文件 Key' })
          return
        }
        const fileKey = pathMatch[1]
        console.log('[Figma Proxy] 获取文件:', fileKey, 'query:', urlPath.split('?')[1] || '')
        await proxyFigmaRequest(req, res, `/files/${fileKey}`)
      })

      // Figma 获取图片
      server.middlewares.use('/api/figma/images', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Figma-Token')
          res.end()
          return
        }
        const urlPath = req.url || ''
        const pathMatch = urlPath.match(/^\/api\/figma\/images\/([^/?]+)/) || urlPath.match(/^\/([^/?]+)/)
        if (!pathMatch) {
          json(res, 400, { ok: false, error: '缺少文件 Key' })
          return
        }
        await proxyFigmaRequest(req, res, `/images/${pathMatch[1]}`)
      })

      // Figma 图片代理：代理 S3 图片下载，避免浏览器直接访问 S3 被阻止
      server.middlewares.use('/api/figma/proxy-image', async (req, res) => {
        const url = new URL(req.url || '', 'http://localhost')
        const imageUrl = url.searchParams.get('url')
        if (!imageUrl) {
          json(res, 400, { error: 'url parameter is required' })
          return
        }

        // 验证URL是否为Figma S3域名（安全检查）
        const isFigmaUrl = imageUrl.includes('figma-alpha-api.s3') || 
                           imageUrl.includes('s3-us-west-2.amazonaws.com') ||
                           imageUrl.includes('amazonaws.com/figma') ||
                           imageUrl.includes('figma.com/image') ||
                           (imageUrl.includes('s3.') && imageUrl.includes('amazonaws.com') && imageUrl.includes('figma'))
        if (!isFigmaUrl) {
          json(res, 403, { error: 'Only Figma S3 URLs are allowed' })
          return
        }

        // 使用 Node.js 原生 https 模块下载图片，带重试
        const downloadImage = (imgUrl: string, retries = 3): Promise<{ buffer: Buffer; contentType: string }> => {
          return new Promise((resolve, reject) => {
            const attempt = (remaining: number) => {
              const parsedUrl = new URL(imgUrl)
              const lib = parsedUrl.protocol === 'https:' ? https : http
              
              const options: https.RequestOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'image/*,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.5',
                  'Accept-Encoding': 'identity',
                  'Connection': 'keep-alive',
                },
                // TLS 选项
                rejectUnauthorized: false,
              }

              const request = lib.request(options, (response) => {
                // 处理重定向
                if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                  response.resume()
                  const redirectUrl = response.headers.location
                  downloadImage(redirectUrl, remaining).then(resolve).catch(reject)
                  return
                }

                if (response.statusCode !== 200) {
                  response.resume()
                  if (remaining > 0) {
                    setTimeout(() => attempt(remaining - 1), 1000)
                    return
                  }
                  reject(new Error(`HTTP ${response.statusCode}`))
                  return
                }

                const contentType = response.headers['content-type'] || 'image/png'
                const chunks: Buffer[] = []
                
                response.on('data', (chunk: Buffer) => {
                  chunks.push(chunk)
                })
                
                response.on('end', () => {
                  resolve({ buffer: Buffer.concat(chunks), contentType })
                })
                
                response.on('error', (err) => {
                  if (remaining > 0) {
                    setTimeout(() => attempt(remaining - 1), 1000)
                    return
                  }
                  reject(err)
                })
              })

              request.on('error', (err) => {
                if (remaining > 0) {
                  console.warn(`[Figma Proxy] 图片下载重试 (${remaining} 次剩余):`, err.message)
                  setTimeout(() => attempt(remaining - 1), 1000)
                  return
                }
                reject(err)
              })

              request.setTimeout(15000, () => {
                request.destroy(new Error('Request timeout'))
              })

              request.end()
            }

            attempt(retries)
          })
        }

        try {
          const { buffer, contentType } = await downloadImage(imageUrl)
          res.statusCode = 200
          res.setHeader('Content-Type', contentType)
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Cache-Control', 'public, max-age=3600')
          res.end(buffer)
        } catch (err) {
          console.error('[Figma Proxy] 图片代理失败:', err instanceof Error ? err.message : err)
          json(res, 500, { error: `Image proxy failed: ${err instanceof Error ? err.message : String(err)}` })
        }
      })
    },
  }
}

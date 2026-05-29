import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import OpenAI from 'openai'
import { toFile } from 'openai'

const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3'
const DEFAULT_MODEL = 'doubao-seedream-5-0-260128'

// In-memory API key storage (persists during dev session)
let storedApiKey = process.env.ARK_API_KEY || 'ark-83c3387c-3a20-463b-a888-2aad7be0b97a-31c09'
let storedOpenAIKey = process.env.OPENAI_API_KEY || ''
let storedVisionEndpoint = 'ep-20260522095644-hdr5h'  // Endpoint ID for Ark vision model

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
            size: '2K',
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
            size: '2K',
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
          const mode = data.mode || 'png2edit' // 'png2edit' | 'text_extract'
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
            systemPrompt = `你是一个专业的 HMI 界面设计分析专家。用户会给你一张 HMI 界面的 PNG 截图，你需要将其分解为可编辑的设计组件。请分析：
1. 整体布局结构（行/列/网格）
2. 每个可视组件的类型、位置、尺寸、颜色、圆角、阴影等属性
3. 文本元素及其字体、大小、颜色、对齐方式
4. 图标和图形元素
5. 背景和渐变

返回 JSON 格式结果，结构如下：
{
  "canvas": { "width": 数字, "height": 数字, "background": "背景色" },
  "components": [
    {
      "id": "组件ID",
      "type": "container|text|icon|gauge|button|card|divider|image|progress",
      "label": "组件描述",
      "bounds": { "x": 数字, "y": 数字, "width": 数字, "height": 数字 },
      "styles": { "backgroundColor": "色值", "borderRadius": 数字, "opacity": 数字, "fontSize": 数字, "color": "色值", "fontWeight": "字重", "boxShadow": "阴影描述" },
      "children": [ ... ]
    }
  ],
  "summary": "界面概要描述"
}
只返回纯 JSON，不要其他文字。`
          }

          // Use raw fetch instead of OpenAI SDK to ensure exact format compatibility with Ark API
          const requestBody = {
            model: storedVisionEndpoint,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: imageUrl } },
                  { type: 'text', text: mode === 'text_extract' ? '请提取这张 HMI 界面中的所有文本' : '请将这张 HMI 界面 PNG 分解为可编辑的设计组件' },
                ],
              },
            ],
            max_tokens: 4096,
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

          const raw = respData.choices?.[0]?.message?.content || ''
          const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw]
          let parsed: unknown
          try {
            parsed = JSON.parse(jsonMatch[1].trim())
          } catch {
            parsed = { raw }
          }

          json(res, 200, { ok: true, mode, result: parsed })
        } catch (err) {
          json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) })
        }
      })
    },
  }
}

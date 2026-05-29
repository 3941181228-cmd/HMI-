import { ARK_BASE, JIMENG_API_KEY, STORED_VISION_ENDPOINT } from '../_shared'

export default async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    }
  }
  if (!JIMENG_API_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: '请先配置火山方舟 API Key' })
    }
  }
  if (!STORED_VISION_ENDPOINT) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: '请先配置视觉模型推理接入点（Endpoint ID）' })
    }
  }

  try {
    const data = JSON.parse(event.body || '{}')
    const mode = data.mode || 'png2edit'
    const imageBase64 = data.image_base64 || ''
    if (!imageBase64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'image_base64 is required' })
      }
    }

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
  "canvas": { "width": 0, "height": 0, "background": "背景色" },
  "components": [
    {
      "id": "组件ID",
      "type": "container|text|icon|gauge|button|card|divider|image|progress",
      "label": "组件描述",
      "bounds": { "x": 0, "y": 0, "width": 0, "height": 0 },
      "styles": { "backgroundColor": "色值", "borderRadius": 0, "opacity": 0, "fontSize": 0, "color": "色值", "fontWeight": "字重", "boxShadow": "阴影描述" },
      "children": []
    }
  ],
  "summary": "界面概要描述"
}
只返回纯 JSON，不要其他文字。`
    }

    const requestBody = {
      model: STORED_VISION_ENDPOINT,
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
        'Authorization': `Bearer ${JIMENG_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    })

    const respData = await resp.json()

    if (!resp.ok) {
      const errMsg = respData.error?.message || respData.message || `Ark vision API error ${resp.status}`
      return {
        statusCode: resp.status,
        body: JSON.stringify({ ok: false, error: errMsg, raw: respData })
      }
    }

    const raw = respData.choices?.[0]?.message?.content || ''
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw]
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonMatch[1].trim())
    } catch {
      parsed = { raw }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, mode, result: parsed })
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ARK_BASE, JIMENG_API_KEY, STORED_VISION_ENDPOINT } from '../_shared'

// SVG组件结果类型
interface ExtractedSVGComponent {
  id: string
  name: string
  category: string
  x: number
  y: number
  width: number
  height: number
  svg: string
}

interface ExtractedResult {
  canvas: { width: number; height: number; background: string }
  svgComponents: ExtractedSVGComponent[]
  summary: string
}

// 从AI原始文本中提取SVG组件块
function sanitizeSVG(svgStr: string): string {
  // 移除所有<image ... />或<image ...></image>标签（自闭合或成对），防止浏览器加载外部URL
  let cleaned = svgStr.replace(/<image\b[^>]*\/?>/gi, '')
  cleaned = cleaned.replace(/<image\b[^>]*>[\s\S]*?<\/image>/gi, '')
  // 移除任何包含href或xlink:href引用外部URL的属性
  cleaned = cleaned.replace(/\s+(?:xlink:)?href\s*=\s*["']https?:\/\/[^"']*["']/gi, '')
  return cleaned
}

function extractSVGBlocks(text: string): ExtractedResult {
  const components: ExtractedSVGComponent[] = []
  let canvasBg = '#0f172a'

  // 尝试提取背景色
  const bgMatch = text.match(/background["']?\s*[:=]\s*["']?(#[0-9a-fA-F]{3,8})/)
  if (bgMatch) canvasBg = bgMatch[1]

  // 方法1: 使用 [HMI_SVG_BEGIN ...]...<svg>...</svg>...[HMI_SVG_END] 标记提取
  const beginMarker = /\[HMI_SVG_BEGIN([^\]]*)\]/gi
  const endMarker = '[HMI_SVG_END]'

  let match: RegExpExecArray | null
  const regex = new RegExp('\\[HMI_SVG_BEGIN([^\\]]*)\\]([\\s\\S]*?)\\[HMI_SVG_END\\]', 'gi')

  while ((match = regex.exec(text)) !== null) {
    const attrsStr = match[1] || ''
    const content = match[2] || ''

    // 解析属性
    const attrs: Record<string, string> = {}
    const attrRegex = /(\w+)="([^"]*)"/g
    let attrMatch: RegExpExecArray | null
    while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
      attrs[attrMatch[1].toLowerCase()] = attrMatch[2]
    }

    // 提取SVG内容
    const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/i)
    if (svgMatch) {
      const svgContent = sanitizeSVG(svgMatch[0])
      // 从viewBox或width/height提取尺寸
      const viewBoxMatch = svgContent.match(/viewBox=["']\d+\s+\d+\s+(\d+)\s+(\d+)["']/i)
      const wAttrMatch = svgContent.match(/width=["'](\d+)["']/i)
      const hAttrMatch = svgContent.match(/height=["'](\d+)["']/i)

      let w = Number(attrs.width) || (viewBoxMatch ? Number(viewBoxMatch[1]) : 0) || (wAttrMatch ? Number(wAttrMatch[1]) : 0) || 200
      let h = Number(attrs.height) || (viewBoxMatch ? Number(viewBoxMatch[2]) : 0) || (hAttrMatch ? Number(hAttrMatch[1]) : 0) || 100

      // 确保svg有xmlns
      let finalSvg = svgContent
      if (!/xmlns=/.test(finalSvg)) {
        finalSvg = finalSvg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
      }

      components.push({
        id: attrs.id || `svg_${components.length}`,
        name: attrs.name || `组件 ${components.length + 1}`,
        category: attrs.category || 'widget',
        x: Number(attrs.x) || 0,
        y: Number(attrs.y) || 0,
        width: w,
        height: h,
        svg: finalSvg,
      })
    }
  }

  // 方法2: 如果没有标记，直接提取所有<svg>...</svg>块
  if (components.length === 0) {
    const svgRegex = /<svg[\s\S]*?<\/svg>/gi
    let svgMatch: RegExpExecArray | null
    let idx = 0
    const categoryNames = ['icon', 'gauge', 'button', 'card', 'background', 'mask', 'popup', 'progress', 'text', 'indicator', 'nav_item', 'media_cover', 'divider', 'shape', 'dashboard', 'map', 'media', 'climate', 'widget', 'status_bar', 'navigation', 'control']
    const nameMap: Record<string, string> = {
      icon: '图标', gauge: '仪表/圆环', button: '按钮', card: '卡片/面板',
      background: '底图/背景', mask: '遮罩层', popup: '弹窗', progress: '进度条',
      text: '文本', indicator: '指示灯', nav_item: '导航项', media_cover: '媒体封面',
      divider: '分割线', shape: '图形装饰',
      status_bar: '状态栏', navigation: '导航栏', dashboard: '仪表盘',
      map: '地图区域', media: '媒体中心', climate: '空调控制',
      vehicle_info: '车辆信息', control: '快捷控制', widget: '通用组件',
    }

    while ((svgMatch = svgRegex.exec(text)) !== null) {
      const svgContent = sanitizeSVG(svgMatch[0])
      // 提取尺寸
      const viewBoxMatch = svgContent.match(/viewBox=["']\d+\s+\d+\s+(\d+)\s+(\d+)["']/i)
      const wAttrMatch = svgContent.match(/width=["'](\d+)["']/i)
      const hAttrMatch = svgContent.match(/height=["'](\d+)["']/i)
      const w = (viewBoxMatch ? Number(viewBoxMatch[1]) : 0) || (wAttrMatch ? Number(wAttrMatch[1]) : 0) || 200
      const h = (viewBoxMatch ? Number(viewBoxMatch[2]) : 0) || (hAttrMatch ? Number(hAttrMatch[1]) : 0) || 100

      // 尝试从上下文推断名称和类别
      const beforeText = text.substring(Math.max(0, svgMatch.index - 200), svgMatch.index)
      let category = 'widget'
      let name = `组件 ${idx + 1}`

      for (const cat of categoryNames) {
        if (beforeText.toLowerCase().includes(cat.replace('_', '')) || beforeText.includes(nameMap[cat] || '')) {
          category = cat
          name = nameMap[cat] || name
          break
        }
      }

      // 确保svg有xmlns
      let finalSvg = svgContent
      if (!/xmlns=/.test(finalSvg)) {
        finalSvg = finalSvg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
      }

      components.push({
        id: `svg_${idx}`,
        name,
        category,
        x: 0,
        y: idx * 200,
        width: w,
        height: h,
        svg: finalSvg,
      })
      idx++
      if (idx >= 20) break // 限制最大数量
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
      ? `成功提取 ${components.length} 个 SVG 组件`
      : '未能从AI输出中提取到SVG内容',
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }
  if (!JIMENG_API_KEY) {
    res.status(401).json({ error: '请先配置火山方舟 API Key' })
    return
  }
  if (!STORED_VISION_ENDPOINT) {
    res.status(401).json({ error: '请先配置视觉模型推理接入点（Endpoint ID）' })
    return
  }

  try {
    const data = req.body
    const mode = data.mode || 'png2svg'
    const imageBase64 = data.image_base64 || ''
    if (!imageBase64) {
      res.status(400).json({ error: 'image_base64 is required' })
      return
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
      // PNG转SVG模式：让AI直接输出SVG，按独立元素切图，每个元素一个SVG
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
      model: STORED_VISION_ENDPOINT,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: mode === 'text_extract'
              ? '请提取这张 HMI 界面中的所有文本'
              : '请根据这张HMI界面截图，按照要求的格式生成各个功能区域的SVG代码。'
            },
          ],
        },
      ],
      max_tokens: 12288,
      temperature: 0.2,
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
      const errMsg = respData.error?.message || respData.message || `API error ${resp.status}`
      res.status(resp.status).json({ ok: false, error: errMsg })
      return
    }

    const rawContent: string = respData.choices?.[0]?.message?.content || ''

    if (mode === 'text_extract') {
      // 文本提取模式：尝试解析JSON
      function parseJSON(text: string): unknown {
        const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
        const toParse = codeMatch ? codeMatch[1].trim() : text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1)
        try {
          return JSON.parse(toParse)
        } catch {
          return { regions: [], summary: '文本提取结果解析失败' }
        }
      }
      res.status(200).json({ ok: true, mode, result: parseJSON(rawContent) })
    } else {
      // SVG模式：直接从文本提取SVG块，完全避免JSON解析
      const extracted = extractSVGBlocks(rawContent)
      // 将原始AI输出也附带，方便调试
      ;(extracted as unknown as Record<string, unknown>)._raw = rawContent.substring(0, 2000)
      res.status(200).json({ ok: true, mode, result: extracted })
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}

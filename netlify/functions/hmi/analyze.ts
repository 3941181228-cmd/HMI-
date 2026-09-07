import { ARK_BASE, JIMENG_API_KEY, STORED_VISION_ENDPOINT } from '../_shared'

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

// 清理SVG：移除<image>标签和外部引用，防止浏览器加载无效URL导致ORB错误
function sanitizeSVG(svgStr: string): string {
  let cleaned = svgStr.replace(/<image\b[^>]*\/?>/gi, '')
  cleaned = cleaned.replace(/<image\b[^>]*>[\s\S]*?<\/image>/gi, '')
  cleaned = cleaned.replace(/\s+(?:xlink:)?href\s*=\s*["']https?:\/\/[^"']*["']/gi, '')
  return cleaned
}

function extractSVGBlocks(text: string) {
  const components: ExtractedSVGComponent[] = []
  let canvasBg = '#0f172a'

  const bgMatch = text.match(/background["']?\s*[:=]\s*["']?(#[0-9a-fA-F]{3,8})/)
  if (bgMatch) canvasBg = bgMatch[1]

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

export default async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  }
  if (!JIMENG_API_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: '请先配置火山方舟 API Key' }) }
  }
  if (!STORED_VISION_ENDPOINT) {
    return { statusCode: 401, body: JSON.stringify({ error: '请先配置视觉模型推理接入点（Endpoint ID）' }) }
  }

  try {
    const data = JSON.parse(event.body || '{}')
    const mode = data.mode || 'png2svg'
    const imageBase64 = data.image_base64 || ''
    if (!imageBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'image_base64 is required' }) }
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
    { "name": "区域名称", "texts": [ { "content": "文本内容", "type": "label|value|unit|title|button", "description": "文本用途说明" } ] }
  ],
  "summary": "整体文本概要"
}
只返回纯 JSON，不要其他文字。`
    } else {
      systemPrompt = `你是专业的 UI 切图专家。请仔细观察用户上传的 HMI 车载界面 PNG 截图，将画面中每一个独立的 UI 元素识别出来，并为每个元素单独绘制一个 SVG。

【核心要求】
切到最小独立元素级别！每个图标、每个按钮、每个圆环、每个弹窗、每个遮罩、每个卡片、每个进度条、每个文字块、每个指示灯都要单独生成一个 SVG。

【元素类型】icon(图标), gauge(仪表/圆环), button(按钮), card(卡片/面板), background(底图), mask(遮罩), popup(弹窗), progress(进度条), text(文本), indicator(指示灯), nav_item(导航项), media_cover(媒体封面), divider(分割线), shape(装饰图形)

【输出格式】每个元素输出一个块：
[HMI_SVG_BEGIN id="id" name="名称" category="类型" x="x" y="y" width="w" height="h"]
<svg viewBox="0 0 W H" xmlns="http://www.w3.org/2000/svg">...</svg>
[HMI_SVG_END]

【SVG规范】
1. 每个svg必须有viewBox和xmlns，viewBox尺寸刚好包裹该元素
2. 只绘制当前元素，不包含其他元素
3. x,y是该元素在原图中的位置，width,height是元素尺寸
4. 使用rect,circle,ellipse,path,line,text,g等标准元素，【绝对禁止】使用<image>标签引用外部URL
5. 颜色用#RRGGBB，文字用<text>标签，font-family="system-ui,sans-serif"
6. 切出8-15个主要的独立元素即可（优先切大的、显眼的元素）

【重要】严格按标记格式输出，不要markdown代码块，不要解释文字，直接以[HMI_SVG_BEGIN开头输出。SVG代码尽量简洁，不要写注释。`
    }

    const requestBody = {
      model: STORED_VISION_ENDPOINT,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: mode === 'text_extract' ? '请提取这张 HMI 界面中的所有文本' : '请根据这张HMI界面截图，按照要求的格式生成各个独立元素的SVG切图。' },
          ],
        },
      ],
      max_tokens: mode === 'text_extract' ? 4096 : 12288,
      temperature: mode === 'text_extract' ? 0.3 : 0.2,
    }

    const resp = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${JIMENG_API_KEY}` },
      body: JSON.stringify(requestBody),
    })

    const respData = await resp.json()
    if (!resp.ok) {
      const errMsg = respData.error?.message || respData.message || `API error ${resp.status}`
      return { statusCode: resp.status, body: JSON.stringify({ ok: false, error: errMsg }) }
    }

    const rawContent: string = respData.choices?.[0]?.message?.content || ''

    if (mode === 'text_extract') {
      const codeMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/)
      const toParse = codeMatch ? codeMatch[1].trim() : rawContent.substring(rawContent.indexOf('{'), rawContent.lastIndexOf('}') + 1)
      let parsed: any
      try { parsed = JSON.parse(toParse) } catch { parsed = { regions: [], summary: '文本提取结果解析失败', _raw: rawContent.substring(0, 500) } }
      return { statusCode: 200, body: JSON.stringify({ ok: true, mode, result: parsed }) }
    } else {
      const extracted = extractSVGBlocks(rawContent)
      ;(extracted as any)._raw = rawContent.substring(0, 2000)
      return { statusCode: 200, body: JSON.stringify({ ok: true, mode, result: extracted }) }
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }) }
  }
}

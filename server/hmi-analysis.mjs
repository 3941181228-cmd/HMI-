function sanitizeSVG(svgStr) {
  let cleaned = svgStr.replace(/<image\b[^>]*\/?>/gi, "");
  cleaned = cleaned.replace(/<image\b[^>]*>[\s\S]*?<\/image>/gi, "");
  cleaned = cleaned.replace(/\s+(?:xlink:)?href\s*=\s*["']https?:\/\/[^"']*["']/gi, "");
  return cleaned;
}
function extractSVGBlocks(text) {
  const components = [];
  let canvasBg = "#0f172a";
  const bgMatch = text.match(/background["']?\s*[:=]\s*["']?(#[0-9a-fA-F]{3,8})/);
  if (bgMatch) canvasBg = bgMatch[1];
  const markerRegex = /\[HMI_SVG_BEGIN([^\]]*)\]([\s\S]*?)\[HMI_SVG_END\]/gi;
  let m;
  while ((m = markerRegex.exec(text)) !== null) {
    const attrsStr = m[1] || "";
    const content = m[2] || "";
    const attrs = {};
    const attrRegex = /(\w+)="([^"]*)"/g;
    let am;
    while ((am = attrRegex.exec(attrsStr)) !== null) {
      attrs[am[1].toLowerCase()] = am[2];
    }
    const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/i);
    if (svgMatch) {
      let svgContent = sanitizeSVG(svgMatch[0]);
      const viewBoxMatch = svgContent.match(/viewBox=["']\d+\s+\d+\s+(\d+)\s+(\d+)["']/i);
      const wAttrMatch = svgContent.match(/width=["'](\d+)["']/i);
      const hAttrMatch = svgContent.match(/height=["'](\d+)["']/i);
      let w = Number(attrs.width) || (viewBoxMatch ? Number(viewBoxMatch[1]) : 0) || (wAttrMatch ? Number(wAttrMatch[1]) : 0) || 200;
      let h = Number(attrs.height) || (viewBoxMatch ? Number(viewBoxMatch[2]) : 0) || (hAttrMatch ? Number(hAttrMatch[1]) : 0) || 100;
      if (!/xmlns=/.test(svgContent)) {
        svgContent = svgContent.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      components.push({
        id: attrs.id || `svg_${components.length}`,
        name: attrs.name || `\u7EC4\u4EF6 ${components.length + 1}`,
        category: attrs.category || "widget",
        x: Number(attrs.x) || 0,
        y: Number(attrs.y) || 0,
        width: w,
        height: h,
        svg: svgContent
      });
    }
  }
  if (components.length === 0) {
    const svgRegex = /<svg[\s\S]*?<\/svg>/gi;
    let sm;
    let idx = 0;
    const categoryNames = ["icon", "gauge", "button", "card", "background", "mask", "popup", "progress", "text", "indicator", "nav_item", "media_cover", "divider", "shape", "dashboard", "map", "media", "climate", "widget", "status_bar", "navigation", "control"];
    const nameMap = {
      icon: "\u56FE\u6807",
      gauge: "\u4EEA\u8868/\u5706\u73AF",
      button: "\u6309\u94AE",
      card: "\u5361\u7247/\u9762\u677F",
      background: "\u5E95\u56FE/\u80CC\u666F",
      mask: "\u906E\u7F69\u5C42",
      popup: "\u5F39\u7A97",
      progress: "\u8FDB\u5EA6\u6761",
      text: "\u6587\u672C",
      indicator: "\u6307\u793A\u706F",
      nav_item: "\u5BFC\u822A\u9879",
      media_cover: "\u5A92\u4F53\u5C01\u9762",
      divider: "\u5206\u5272\u7EBF",
      shape: "\u56FE\u5F62\u88C5\u9970",
      status_bar: "\u72B6\u6001\u680F",
      navigation: "\u5BFC\u822A\u680F",
      dashboard: "\u4EEA\u8868\u76D8",
      map: "\u5730\u56FE\u533A\u57DF",
      media: "\u5A92\u4F53\u4E2D\u5FC3",
      climate: "\u7A7A\u8C03\u63A7\u5236",
      vehicle_info: "\u8F66\u8F86\u4FE1\u606F",
      control: "\u5FEB\u6377\u63A7\u5236",
      widget: "\u901A\u7528\u7EC4\u4EF6"
    };
    while ((sm = svgRegex.exec(text)) !== null && idx < 50) {
      const svgContent0 = sanitizeSVG(sm[0]);
      const vbMatch = svgContent0.match(/viewBox=["']\d+\s+\d+\s+(\d+)\s+(\d+)["']/i);
      const wMatchA = svgContent0.match(/width=["'](\d+)["']/i);
      const hMatchA = svgContent0.match(/height=["'](\d+)["']/i);
      const w0 = (vbMatch ? Number(vbMatch[1]) : 0) || (wMatchA ? Number(wMatchA[1]) : 0) || 200;
      const h0 = (vbMatch ? Number(vbMatch[2]) : 0) || (hMatchA ? Number(hMatchA[1]) : 0) || 100;
      const beforeText = text.substring(Math.max(0, sm.index - 200), sm.index);
      let category = "widget";
      let name = `\u7EC4\u4EF6 ${idx + 1}`;
      for (const cat of categoryNames) {
        if (beforeText.toLowerCase().includes(cat.replace("_", "")) || beforeText.includes(nameMap[cat] || "")) {
          category = cat;
          name = nameMap[cat] || name;
          break;
        }
      }
      let finalSvg = svgContent0;
      if (!/xmlns=/.test(finalSvg)) {
        finalSvg = finalSvg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      components.push({ id: `svg_${idx}`, name, category, x: 0, y: idx * 200, width: w0, height: h0, svg: finalSvg });
      idx++;
    }
  }
  let maxW = 1920, maxH = 1080;
  for (const c of components) {
    maxW = Math.max(maxW, c.x + c.width + 100);
    maxH = Math.max(maxH, c.y + c.height + 100);
  }
  return {
    canvas: { width: maxW, height: maxH, background: canvasBg },
    svgComponents: components,
    summary: components.length > 0 ? `\u6210\u529F\u63D0\u53D6 ${components.length} \u4E2A SVG \u5207\u56FE\u5143\u7D20` : "AI \u672A\u80FD\u751F\u6210\u6709\u6548\u7684 SVG \u7EC4\u4EF6\uFF0C\u8BF7\u91CD\u8BD5\u6216\u66F4\u6362\u66F4\u6E05\u6670\u7684\u622A\u56FE"
  };
}
async function handler(event, env, upstream = fetch) {
  const ARK_BASE = "https://ark.cn-beijing.volces.com/api/v3";
  const JIMENG_API_KEY = env.JIMENG_API_KEY || env.ARK_API_KEY || "";
  const STORED_VISION_ENDPOINT = env.VISION_ENDPOINT_ID || "ep-20260522095644-hdr5h";
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }
  if (!JIMENG_API_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: "\u8BF7\u5148\u914D\u7F6E\u706B\u5C71\u65B9\u821F API Key" }) };
  }
  if (!STORED_VISION_ENDPOINT) {
    return { statusCode: 401, body: JSON.stringify({ error: "\u8BF7\u5148\u914D\u7F6E\u89C6\u89C9\u6A21\u578B\u63A8\u7406\u63A5\u5165\u70B9\uFF08Endpoint ID\uFF09" }) };
  }
  try {
    const data = JSON.parse(event.body || "{}");
    const mode = data.mode || "png2svg";
    if (!["png2svg", "text_extract"].includes(mode)) return { statusCode: 400, body: JSON.stringify({ ok: false, error: "\u4E0D\u652F\u6301\u7684\u5206\u6790\u6A21\u5F0F" }) };
    const imageBase64 = data.image_base64 || "";
    if (typeof imageBase64 !== "string" || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(imageBase64) || imageBase64.length > 16e6) {
      return { statusCode: 400, body: JSON.stringify({ error: "image_base64 is required" }) };
    }
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageUrl = imageBase64;
    let systemPrompt;
    if (mode === "text_extract") {
      systemPrompt = `\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684 HMI \u754C\u9762\u6587\u672C\u63D0\u53D6\u4E13\u5BB6\u3002\u7528\u6237\u4F1A\u7ED9\u4F60\u4E00\u5F20 HMI \u754C\u9762\u7684\u622A\u56FE\uFF0C\u4F60\u9700\u8981\uFF1A
1. \u8BC6\u522B\u5E76\u63D0\u53D6\u56FE\u7247\u4E2D\u6240\u6709\u53EF\u89C1\u6587\u672C
2. \u6309\u533A\u57DF\u5206\u7EC4\uFF08\u5982\uFF1A\u72B6\u6001\u680F\u3001\u5BFC\u822A\u533A\u3001\u4EEA\u8868\u533A\u3001\u5A92\u4F53\u533A\u3001\u7A7A\u8C03\u533A\u7B49\uFF09
3. \u8FD4\u56DE JSON \u683C\u5F0F\u7ED3\u679C\uFF0C\u7ED3\u6784\u5982\u4E0B\uFF1A
{
  "regions": [
    { "name": "\u533A\u57DF\u540D\u79F0", "texts": [ { "content": "\u6587\u672C\u5185\u5BB9", "type": "label|value|unit|title|button", "description": "\u6587\u672C\u7528\u9014\u8BF4\u660E" } ] }
  ],
  "summary": "\u6574\u4F53\u6587\u672C\u6982\u8981"
}
\u53EA\u8FD4\u56DE\u7EAF JSON\uFF0C\u4E0D\u8981\u5176\u4ED6\u6587\u5B57\u3002`;
    } else {
      systemPrompt = `\u4F60\u662F\u4E13\u4E1A\u7684 UI \u5207\u56FE\u4E13\u5BB6\u3002\u8BF7\u4ED4\u7EC6\u89C2\u5BDF\u7528\u6237\u4E0A\u4F20\u7684 HMI \u8F66\u8F7D\u754C\u9762 PNG \u622A\u56FE\uFF0C\u5C06\u753B\u9762\u4E2D\u6BCF\u4E00\u4E2A\u72EC\u7ACB\u7684 UI \u5143\u7D20\u8BC6\u522B\u51FA\u6765\uFF0C\u5E76\u4E3A\u6BCF\u4E2A\u5143\u7D20\u5355\u72EC\u7ED8\u5236\u4E00\u4E2A SVG\u3002

\u3010\u6838\u5FC3\u8981\u6C42\u3011
\u5207\u5230\u6700\u5C0F\u72EC\u7ACB\u5143\u7D20\u7EA7\u522B\uFF01\u6BCF\u4E2A\u56FE\u6807\u3001\u6BCF\u4E2A\u6309\u94AE\u3001\u6BCF\u4E2A\u5706\u73AF\u3001\u6BCF\u4E2A\u5F39\u7A97\u3001\u6BCF\u4E2A\u906E\u7F69\u3001\u6BCF\u4E2A\u5361\u7247\u3001\u6BCF\u4E2A\u8FDB\u5EA6\u6761\u3001\u6BCF\u4E2A\u6587\u5B57\u5757\u3001\u6BCF\u4E2A\u6307\u793A\u706F\u90FD\u8981\u5355\u72EC\u751F\u6210\u4E00\u4E2A SVG\u3002

\u3010\u5143\u7D20\u7C7B\u578B\u3011icon(\u56FE\u6807), gauge(\u4EEA\u8868/\u5706\u73AF), button(\u6309\u94AE), card(\u5361\u7247/\u9762\u677F), background(\u5E95\u56FE), mask(\u906E\u7F69), popup(\u5F39\u7A97), progress(\u8FDB\u5EA6\u6761), text(\u6587\u672C), indicator(\u6307\u793A\u706F), nav_item(\u5BFC\u822A\u9879), media_cover(\u5A92\u4F53\u5C01\u9762), divider(\u5206\u5272\u7EBF), shape(\u88C5\u9970\u56FE\u5F62)

\u3010\u8F93\u51FA\u683C\u5F0F\u3011\u6BCF\u4E2A\u5143\u7D20\u8F93\u51FA\u4E00\u4E2A\u5757\uFF1A
[HMI_SVG_BEGIN id="id" name="\u540D\u79F0" category="\u7C7B\u578B" x="x" y="y" width="w" height="h"]
<svg viewBox="0 0 W H" xmlns="http://www.w3.org/2000/svg">...</svg>
[HMI_SVG_END]

\u3010SVG\u89C4\u8303\u3011
1. \u6BCF\u4E2Asvg\u5FC5\u987B\u6709viewBox\u548Cxmlns\uFF0CviewBox\u5C3A\u5BF8\u521A\u597D\u5305\u88F9\u8BE5\u5143\u7D20
2. \u53EA\u7ED8\u5236\u5F53\u524D\u5143\u7D20\uFF0C\u4E0D\u5305\u542B\u5176\u4ED6\u5143\u7D20
3. x,y\u662F\u8BE5\u5143\u7D20\u5728\u539F\u56FE\u4E2D\u7684\u4F4D\u7F6E\uFF0Cwidth,height\u662F\u5143\u7D20\u5C3A\u5BF8
4. \u4F7F\u7528rect,circle,ellipse,path,line,text,g\u7B49\u6807\u51C6\u5143\u7D20\uFF0C\u3010\u7EDD\u5BF9\u7981\u6B62\u3011\u4F7F\u7528<image>\u6807\u7B7E\u5F15\u7528\u5916\u90E8URL
5. \u989C\u8272\u7528#RRGGBB\uFF0C\u6587\u5B57\u7528<text>\u6807\u7B7E\uFF0Cfont-family="system-ui,sans-serif"
6. 保留所有可见且能辨认的独立 UI 元素，不限制为几个大组件；不得省略小图标、文字、细线或状态指示。优先准确还原，再分组。
7. 严格按原图的比例、坐标、间距、圆角和层级绘制，不美化、不重新设计。保留原始配色、透明度及线宽；真实渐变使用 linearGradient 或 radialGradient，避免用大块纯色替代。
8. 保留可辨认的原始文本，不编造文字；难以辨认的细节保守处理。

\u3010\u91CD\u8981\u3011\u4E25\u683C\u6309\u6807\u8BB0\u683C\u5F0F\u8F93\u51FA\uFF0C\u4E0D\u8981markdown\u4EE3\u7801\u5757\uFF0C\u4E0D\u8981\u89E3\u91CA\u6587\u5B57\uFF0C\u76F4\u63A5\u4EE5[HMI_SVG_BEGIN\u5F00\u5934\u8F93\u51FA\u3002SVG\u4EE3\u7801\u5C3D\u91CF\u7B80\u6D01\uFF0C\u4E0D\u8981\u5199\u6CE8\u91CA\u3002`;
    }
    const requestBody = {
      model: STORED_VISION_ENDPOINT,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: mode === "text_extract" ? "\u8BF7\u63D0\u53D6\u8FD9\u5F20 HMI \u754C\u9762\u4E2D\u7684\u6240\u6709\u6587\u672C" : "\u8BF7\u6839\u636E\u8FD9\u5F20HMI\u754C\u9762\u622A\u56FE\uFF0C\u6309\u7167\u8981\u6C42\u7684\u683C\u5F0F\u751F\u6210\u5404\u4E2A\u72EC\u7ACB\u5143\u7D20\u7684SVG\u5207\u56FE\u3002" }
          ]
        }
      ],
      max_tokens: mode === "text_extract" ? 4096 : 12288,
      temperature: mode === "text_extract" ? 0.3 : 0.2
    };
    const resp = await upstream(`${ARK_BASE}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(12e4),
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${JIMENG_API_KEY}` },
      body: JSON.stringify(requestBody)
    });
    const respData = await resp.json();
    if (!resp.ok) {
      const errMsg = respData.error?.message || respData.message || `API error ${resp.status}`;
      return { statusCode: resp.status, body: JSON.stringify({ ok: false, error: errMsg }) };
    }
    if (respData.choices?.[0]?.finish_reason === "length") return { statusCode: 422, body: JSON.stringify({ ok: false, error: "结果超出模型输出长度，请裁剪为一个界面区域再转换，以保留完整细节" }) };
    const rawContent = respData.choices?.[0]?.message?.content || "";
    if (mode === "text_extract") {
      const codeMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      const toParse = codeMatch ? codeMatch[1].trim() : rawContent.substring(rawContent.indexOf("{"), rawContent.lastIndexOf("}") + 1);
      let parsed;
      try {
        parsed = JSON.parse(toParse);
      } catch {
        parsed = { regions: [], summary: "\u6587\u672C\u63D0\u53D6\u7ED3\u679C\u89E3\u6790\u5931\u8D25", _raw: rawContent.substring(0, 500) };
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true, mode, result: parsed }) };
    } else {
      const extracted = extractSVGBlocks(rawContent);
      extracted._raw = rawContent.substring(0, 2e3);
      return { statusCode: 200, body: JSON.stringify({ ok: true, mode, result: extracted }) };
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }) };
  }
}
export {
  handler as default
};

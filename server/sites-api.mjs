const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3'
const DEFAULT_MODEL = 'doubao-seedream-5-0-260128'
const FIGMA_API_BASE = 'https://api.figma.com/v1'
const OPENAI_API_BASE = 'https://api.openai.com/v1'
const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-2'

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

async function handleFigmaApi(request, env, upstream) {
  const url = new URL(request.url)
  const path = url.pathname
  const error = (message, status = 400) => json({ ok: false, error: message }, status)

  if (request.method !== 'GET') return error('请使用 GET 请求', 405)

  if (path === '/api/figma/proxy-image') {
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

  const requestToken = request.headers.get('X-Figma-Token')?.trim() || ''
  const isManualValidation = path === '/api/figma/validate'
  const token = isManualValidation ? requestToken : (env.FIGMA_API_TOKEN || requestToken)
  if (!token) return error('尚未配置 Figma Token', 401)

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

  if (!['/api/openai/text2image', '/api/openai/image2image'].includes(path)) {
    return error('OpenAI 接口不存在', 404)
  }
  if (!key) return error('尚未配置默认 OpenAI API', 503)
  if (typeof data.prompt !== 'string' || !data.prompt.trim()) return error('请输入生成描述')

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
      form.append('prompt',
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
    response_format: 'url', stream: false, watermark: false,
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
    const images = (Array.isArray(result.data) ? result.data : []).flatMap(item =>
      item.url ? [item.url] : item.b64_json ? [`data:image/png;base64,${item.b64_json}`] : [])
    if (!images.length) return error('服务未返回图片，请调整描述后重试', 502)
    return json({ ok: true, images })
  } catch { return error('生成服务暂时无法响应，请稍后重试', 502) }
}

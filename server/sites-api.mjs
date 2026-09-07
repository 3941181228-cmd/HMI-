const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3'
const DEFAULT_MODEL = 'doubao-seedream-5-0-260128'

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

export async function handleApi(request, env, upstream = fetch) {
  const url = new URL(request.url)
  const path = url.pathname
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

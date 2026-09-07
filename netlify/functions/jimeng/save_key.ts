import { ARK_BASE, resolveJimengApiKey } from '../_shared'

// For Netlify Functions, since we can't persist state, we just return ok using the env var
export default async function handler(event: any) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ ok: false, message: 'Method Not Allowed' }) }
  let body: any = {}
  try { body = JSON.parse(event.body || '{}') } catch {}
  const key = resolveJimengApiKey(event.headers?.['x-jimeng-api-key'] || body.api_key)
  if (!key) return { statusCode: 400, body: JSON.stringify({ ok: false, message: '请输入 API Key，或在部署平台配置 JIMENG_API_KEY' }) }
  try {
    const response = await fetch(`${ARK_BASE}/models`, { headers: { Authorization: `Bearer ${key}` } })
    const ok = response.ok
    return { statusCode: 200, body: JSON.stringify({ ok, message: ok ? 'API Key 已在当前浏览器保存并验证' : response.status === 401 || response.status === 403 ? 'API Key 无效或已过期' : 'API 暂时无法验证，请稍后重试' }) }
  } catch {
    return { statusCode: 200, body: JSON.stringify({ ok: false, message: '无法连接 Ark API，请稍后重试' }) }
  }
}

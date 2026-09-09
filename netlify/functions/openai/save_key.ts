import { OPENAI_API_BASE, OPENAI_IMAGE_MODEL, resolveOpenAISaveKey } from '../_shared'

export default async function handler(event: any) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ ok: false, message: '请使用 POST 请求' }) }
  let data
  try { data = JSON.parse(event.body || '{}') } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: '请求格式无效' }) }
  }
  const key = resolveOpenAISaveKey(event.headers?.['x-openai-api-key'] || data.api_key)
  if (!key) return { statusCode: 400, body: JSON.stringify({ ok: false, message: '请输入 OpenAI API Key' }) }
  try {
    const response = await fetch(`${OPENAI_API_BASE}/models/${encodeURIComponent(OPENAI_IMAGE_MODEL)}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    return {
      statusCode: response.ok ? 200 : 401,
      body: JSON.stringify({
        ok: response.ok,
        message: response.ok ? 'OpenAI API Key 已验证，可保存在当前浏览器' : 'OpenAI API Key 无效或无权访问当前模型',
      }),
    }
  } catch {
    return { statusCode: 503, body: JSON.stringify({ ok: false, message: '暂时无法连接 OpenAI API' }) }
  }
}

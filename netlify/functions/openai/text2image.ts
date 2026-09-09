import { OPENAI_API_BASE, OPENAI_IMAGE_MODEL, resolveOpenAIApiKey } from '../_shared'

export default async function handler(event: any) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ ok: false, images: [], error: '请使用 POST 请求' }) }
  const key = resolveOpenAIApiKey(event.headers?.['x-openai-api-key'])
  if (!key) return { statusCode: 503, body: JSON.stringify({ ok: false, images: [], error: '尚未配置默认 OpenAI API' }) }
  let data
  try { data = JSON.parse(event.body || '{}') } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, images: [], error: '请求格式无效' }) }
  }
  if (typeof data.prompt !== 'string' || !data.prompt.trim()) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, images: [], error: '请输入生成描述' }) }
  }
  try {
    const response = await fetch(`${OPENAI_API_BASE}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OPENAI_IMAGE_MODEL, prompt: data.prompt.trim(), n: 1, size: '1536x1024' }),
    })
    const result = await response.json() as any
    const images = Array.isArray(result?.data) ? result.data.flatMap((item: any) =>
      item?.url ? [item.url] : item?.b64_json ? [`data:image/png;base64,${item.b64_json}`] : []) : []
    return {
      statusCode: response.ok && images.length ? 200 : response.status || 502,
      body: JSON.stringify({ ok: response.ok && images.length > 0, images, error: response.ok ? (images.length ? undefined : 'OpenAI 未返回图片') : result?.error?.message || 'OpenAI API 请求失败' }),
    }
  } catch {
    return { statusCode: 504, body: JSON.stringify({ ok: false, images: [], error: 'OpenAI API 暂时无法响应' }) }
  }
}

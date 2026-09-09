import { OPENAI_API_BASE, OPENAI_IMAGE_MODEL, resolveOpenAIApiKey } from '../_shared'

export default async function handler(event: any) {
  const key = resolveOpenAIApiKey(event.headers?.['x-openai-api-key'])
  if (!key) return { statusCode: 200, body: JSON.stringify({ ok: false, configured: false, credit: '尚未配置默认 OpenAI API' }) }
  try {
    const response = await fetch(`${OPENAI_API_BASE}/models/${encodeURIComponent(OPENAI_IMAGE_MODEL)}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: response.ok,
        configured: true,
        credit: response.ok ? 'OpenAI API 已验证' : 'OpenAI API Key 无效或无权访问当前模型',
      }),
    }
  } catch {
    return { statusCode: 200, body: JSON.stringify({ ok: false, configured: true, credit: '暂时无法连接 OpenAI API' }) }
  }
}

import { TRIPO_API_BASE, TRIPO_DEFAULT_MODEL, TRIPO_API_KEY } from '../_shared'

// 提交 Tripo 文生 3D 模型任务，返回 task_id
export default async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  }
  if (!TRIPO_API_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: '请先配置 Tripo API Key' }) }
  }

  try {
    const data = JSON.parse(event.body || '{}')
    const prompt = data.prompt || ''
    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'prompt is required' }) }
    }

    const resp = await fetch(`${TRIPO_API_BASE}/generation/text-to-model`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TRIPO_API_KEY}`,
      },
      body: JSON.stringify({ prompt, model: data.model || TRIPO_DEFAULT_MODEL }),
    })

    const respData = await resp.json()
    if (!resp.ok || respData.code !== 0) {
      return {
        statusCode: resp.ok ? 400 : resp.status,
        body: JSON.stringify({ ok: false, error: respData.message || `Tripo API 返回错误 (HTTP ${resp.status})`, code: respData.code }),
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, task_id: respData.data?.task_id }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(err) }) }
  }
}

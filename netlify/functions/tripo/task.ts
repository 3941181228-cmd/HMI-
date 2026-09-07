import { TRIPO_API_BASE, TRIPO_API_KEY } from '../_shared'

// 轮询 Tripo 任务状态：GET /api/tripo/task?id=<task_id>
export default async function handler(event: any) {
  if (!TRIPO_API_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: '请先配置 Tripo API Key' }) }
  }

  const params = event.queryStringParameters || {}
  const taskId = params.id
  if (!taskId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'id (task_id) is required' }) }
  }

  try {
    const resp = await fetch(`${TRIPO_API_BASE}/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${TRIPO_API_KEY}` },
    })
    const respData = await resp.json()

    if (!resp.ok || respData.code !== 0) {
      return {
        statusCode: resp.ok ? 400 : resp.status,
        body: JSON.stringify({ ok: false, status: 'error', error: respData.message || `查询任务失败 (HTTP ${resp.status})` }),
      }
    }

    const task = respData.data || {}
    const status: string = task.status || 'unknown'
    const progress: number = typeof task.progress === 'number' ? task.progress : 0

    const models: Record<string, string> = {}
    const output = task.output || {}
    if (status === 'success' && output && typeof output === 'object') {
      for (const [key, val] of Object.entries(output)) {
        if (typeof val === 'string' && /^https?:\/\//.test(val)) {
          models[key] = val
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: status === 'success',
        status,
        progress,
        models,
        error: status === 'failed' ? (task.message || '任务生成失败') : undefined,
      }),
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, status: 'error', error: String(err) }) }
  }
}

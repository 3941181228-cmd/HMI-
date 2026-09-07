import type { VercelRequest, VercelResponse } from '@vercel/node'
import { TRIPO_API_BASE, TRIPO_API_KEY } from '../_shared'

// 轮询 Tripo 任务状态：GET /api/tripo/task?id=<task_id>
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!TRIPO_API_KEY) {
    res.status(401).json({ error: '请先配置 Tripo API Key' })
    return
  }

  const taskId = (req.query.id as string) || ''
  if (!taskId) {
    res.status(400).json({ error: 'id (task_id) is required' })
    return
  }

  try {
    const resp = await fetch(`${TRIPO_API_BASE}/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${TRIPO_API_KEY}` },
    })
    const respData = await resp.json()

    if (!resp.ok || respData.code !== 0) {
      res.status(resp.ok ? 400 : resp.status).json({
        ok: false,
        status: 'error',
        error: respData.message || `查询任务失败 (HTTP ${resp.status})`,
      })
      return
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

    res.status(200).json({
      ok: status === 'success',
      status,
      progress,
      models,
      error: status === 'failed' ? (task.message || '任务生成失败') : undefined,
    })
  } catch (err) {
    res.status(500).json({ ok: false, status: 'error', error: String(err) })
  }
}

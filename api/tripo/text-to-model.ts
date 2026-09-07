import type { VercelRequest, VercelResponse } from '@vercel/node'
import { TRIPO_API_BASE, TRIPO_DEFAULT_MODEL, TRIPO_API_KEY } from '../_shared'

// 提交 Tripo 文生 3D 模型任务，返回 task_id
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }
  if (!TRIPO_API_KEY) {
    res.status(401).json({ error: '请先配置 Tripo API Key' })
    return
  }

  try {
    const data = req.body
    const prompt = data?.prompt || ''
    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' })
      return
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
      res.status(resp.ok ? 400 : resp.status).json({
        ok: false,
        error: respData.message || `Tripo API 返回错误 (HTTP ${resp.status})`,
        code: respData.code,
      })
      return
    }

    res.status(200).json({ ok: true, task_id: respData.data?.task_id })
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) })
  }
}

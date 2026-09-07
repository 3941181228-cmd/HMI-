import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ARK_BASE, resolveJimengSaveKey } from '../_shared'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' })
  const candidate = req.headers['x-jimeng-api-key'] || req.body?.api_key
  const key = resolveJimengSaveKey(candidate)
  if (!key) return res.status(400).json({ ok: false, message: '请输入 API Key，或在部署平台配置 JIMENG_API_KEY' })
  try {
    const response = await fetch(`${ARK_BASE}/models`, { headers: { Authorization: `Bearer ${key}` } })
    if (response.ok) return res.status(200).json({ ok: true, message: candidate ? 'API Key 已在当前浏览器保存并验证' : '默认 API 已验证' })
    return res.status(200).json({ ok: false, message: response.status === 401 || response.status === 403 ? 'API Key 无效或已过期' : 'API 暂时无法验证，请稍后重试' })
  } catch {
    return res.status(200).json({ ok: false, message: '无法连接 Ark API，请稍后重试' })
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ARK_BASE, resolveJimengApiKey } from '../_shared'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = resolveJimengApiKey(req.headers['x-jimeng-api-key'])
  const hasKey = !!key
  if (!hasKey) {
    res.status(200).json({ ok: false, credit: '' })
    return
  }

  try {
    const resp = await fetch(`${ARK_BASE}/models`, {
      headers: { 'Authorization': `Bearer ${key}` },
    })
    if (resp.ok) {
      res.status(200).json({ ok: true, credit: 'API Key 已验证有效' })
    } else if (resp.status === 401 || resp.status === 403) {
      res.status(200).json({ ok: false, credit: 'API Key 无效或已过期' })
    } else {
      res.status(200).json({ ok: true, credit: 'API Key 已配置（状态未知）' })
    }
  } catch {
    res.status(200).json({ ok: false, credit: '无法连接至 Ark API，请检查网络' })
  }
}

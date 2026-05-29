import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ARK_BASE, JIMENG_API_KEY } from '../_shared'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const hasKey = !!JIMENG_API_KEY
  if (!hasKey) {
    res.status(200).json({ ok: false, credit: '' })
    return
  }

  try {
    const resp = await fetch(`${ARK_BASE}/models`, {
      headers: { 'Authorization': `Bearer ${JIMENG_API_KEY}` },
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
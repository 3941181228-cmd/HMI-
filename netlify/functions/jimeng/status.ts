import { ARK_BASE, JIMENG_API_KEY } from '../_shared'

export default async function handler(event: any) {
  const hasKey = !!JIMENG_API_KEY
  if (!hasKey) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, credit: '' })
    }
  }

  try {
    const resp = await fetch(`${ARK_BASE}/models`, {
      headers: { 'Authorization': `Bearer ${JIMENG_API_KEY}` },
    })
    if (resp.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, credit: 'API Key 已验证有效' })
      }
    } else if (resp.status === 401 || resp.status === 403) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: false, credit: 'API Key 无效或已过期' })
      }
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, credit: 'API Key 已配置（状态未知）' })
      }
    }
  } catch {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, credit: '无法连接至 Ark API，请检查网络' })
    }
  }
}

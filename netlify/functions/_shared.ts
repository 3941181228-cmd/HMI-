export const ARK_BASE = process.env.ARK_BASE || 'https://ark.cn-beijing.volces.com/api/v3'
export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'doubao-seedream-5-0-260128'
export const JIMENG_API_KEY = process.env.JIMENG_API_KEY || 'ark-83c3387c-3a20-463b-a888-2aad7be0b97a-31c09'
export const STORED_VISION_ENDPOINT = 'ep-20260522095644-hdr5h'
export const FIGMA_API_TOKEN = process.env.FIGMA_API_TOKEN || 'figd_wxgzK5DKkvwd8RjL1jEqXPflDkuCr_UUBq5YNxCR'
// Tripo 3D 生成 API（异步任务模式）
export const TRIPO_API_BASE = 'https://openapi.tripo3d.com/v3'
export const TRIPO_DEFAULT_MODEL = 'v3.1-20260211'
export const TRIPO_API_KEY = process.env.TRIPO_API_KEY || 'tsk_rsmyf6rFg2_TKEkcQjAKt0iuNMR0riNopdI_XWzmm2O'

export async function callArkAPI(apiKey: string, requestBody: Record<string, unknown>): Promise<{
  ok: boolean
  images: string[]
  error?: string
  raw?: unknown
}> {
  const resp = await fetch(`${ARK_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  const data = await resp.json()

  if (!resp.ok) {
    const errMsg = data.error?.message || data.error?.code || data.message || ''
    return {
      ok: false,
      images: [],
      error: errMsg || `API 返回错误 (HTTP ${resp.status})`,
      raw: data,
    }
  }

  const images: string[] = []
  if (data.data && Array.isArray(data.data)) {
    for (const item of data.data) {
      if (item.url) images.push(item.url)
      else if (item.b64_json) images.push(`data:image/png;base64,${item.b64_json}`)
    }
  }

  if (images.length > 0) {
    return { ok: true, images }
  }

  return {
    ok: false,
    images: [],
    error: data.error?.message || 'No images in response',
    raw: data,
  }
}

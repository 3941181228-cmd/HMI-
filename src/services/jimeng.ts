// 即梦 AI 服务模块 - 通过火山方舟 Ark API 调用 Seedream 模型
import { getStoredArkKey, saveArkKey } from './apiStorage'

export interface GenerateResult {
  success: boolean
  images: string[]
  querying?: boolean
  submit_id?: string
  error?: string
}

export interface ApiKeyStatus {
  ok: boolean
  credit: string
}

function jimengHeaders(json = false): HeadersInit {
  const key = getStoredArkKey().trim()
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(key ? { 'X-Jimeng-Api-Key': key } : {}),
  }
}

// ---------- 检查 API Key 状态 ----------

export async function checkLoginStatus(): Promise<ApiKeyStatus> {
  try {
    const res = await fetch('/api/jimeng/status', { headers: jimengHeaders() })
    if (res.ok) return await res.json()
    return { ok: false, credit: '' }
  } catch {
    return { ok: false, credit: '' }
  }
}

// ---------- 保存 API Key ----------

export async function saveApiKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const key = apiKey.trim()
    if (key) saveArkKey(key)
    const res = await fetch('/api/jimeng/save_key', {
      method: 'POST',
      headers: jimengHeaders(true),
      body: JSON.stringify({ api_key: key }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data) return data
    return { ok: false, message: data?.message || data?.error || `保存失败（${res.status}）` }
  } catch {
    return { ok: false, message: '请求失败' }
  }
}

// ---------- 文生图 ----------

export async function textToImage(
  prompt: string,
  modelVersion?: string,
  size?: string
): Promise<GenerateResult> {
  try {
    const res = await fetch('/api/jimeng/text2image', {
      method: 'POST',
      headers: jimengHeaders(true),
      body: JSON.stringify({
        prompt,
        model_version: modelVersion,
        size,
      }),
    })

    const data = await res.json()

    if (data.ok && data.images?.length > 0) {
      return { success: true, images: data.images }
    }

    return {
      success: false,
      images: [],
      error: data.error || '生成失败',
    }
  } catch (err) {
    return {
      success: false,
      images: [],
      error: `请求失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ---------- 图生图 ----------

export async function imageToImage(
  prompt: string,
  imageBase64: string,
  modelVersion?: string,
  size?: string
): Promise<GenerateResult> {
  try {
    const res = await fetch('/api/jimeng/image2image', {
      method: 'POST',
      headers: jimengHeaders(true),
      body: JSON.stringify({
        prompt,
        image_base64: imageBase64,
        model_version: modelVersion,
        size,
      }),
    })

    const data = await res.json()

    if (data.ok && data.images?.length > 0) {
      return { success: true, images: data.images }
    }

    return {
      success: false,
      images: [],
      error: data.error || '生成失败',
    }
  } catch (err) {
    return {
      success: false,
      images: [],
      error: `请求失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ---------- 带轮询的完整生成流程 ----------

export async function generateWithPoll(
  prompt: string,
  imageBase64?: string,
  modelVersion?: string,
  size?: string,
): Promise<GenerateResult> {
  // Ark API is synchronous, no polling needed
  if (imageBase64) {
    return imageToImage(prompt, imageBase64, modelVersion, size)
  }
  return textToImage(prompt, modelVersion, size)
}

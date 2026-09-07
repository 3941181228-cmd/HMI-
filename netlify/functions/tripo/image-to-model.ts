import { TRIPO_API_BASE, TRIPO_DEFAULT_MODEL, TRIPO_API_KEY } from '../_shared'

// 图生 3D 模型：前端传 base64 图片 → 上传到 /v3/files 获取 file_token → 调用 image-to-model
export default async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  }
  if (!TRIPO_API_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: '请先配置 Tripo API Key' }) }
  }

  try {
    const data = JSON.parse(event.body || '{}')
    const image = data.image || ''
    if (!image) {
      return { statusCode: 400, body: JSON.stringify({ error: 'image is required' }) }
    }

    // 解析 data URI，提取 mime 类型与 base64 数据
    const m = image.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/)
    if (!m) {
      return { statusCode: 400, body: JSON.stringify({ error: '图片格式无效，需为 data URI' }) }
    }
    const mime = m[1]
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
    const imgBuffer = Buffer.from(m[2], 'base64')

    // 1. 上传图片到 Tripo /v3/files，构造 multipart/form-data
    const boundary = `----TripoBoundary${Date.now()}`
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="upload.${ext}"\r\n`),
      Buffer.from(`Content-Type: ${mime}\r\n\r\n`),
      imgBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])

    const uploadResp = await fetch(`${TRIPO_API_BASE}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TRIPO_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    })
    const uploadData = await uploadResp.json()
    if (!uploadResp.ok || uploadData.code !== 0) {
      return {
        statusCode: uploadResp.ok ? 400 : uploadResp.status,
        body: JSON.stringify({ ok: false, error: uploadData.message || `图片上传失败 (HTTP ${uploadResp.status})` }),
      }
    }
    const fileToken = uploadData.data?.file_token
    if (!fileToken) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: '图片上传成功但未返回 file_token' }) }
    }

    // 2. 用 file_token 调用 image-to-model
    const genResp = await fetch(`${TRIPO_API_BASE}/generation/image-to-model`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TRIPO_API_KEY}`,
      },
      body: JSON.stringify({
        input: fileToken,
        model: data.model || TRIPO_DEFAULT_MODEL,
      }),
    })
    const genData = await genResp.json()
    if (!genResp.ok || genData.code !== 0) {
      return {
        statusCode: genResp.ok ? 400 : genResp.status,
        body: JSON.stringify({ ok: false, error: genData.message || `image-to-model 失败 (HTTP ${genResp.status})`, code: genData.code }),
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, task_id: genData.data?.task_id }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(err) }) }
  }
}

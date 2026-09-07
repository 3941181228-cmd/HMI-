import type { VercelRequest, VercelResponse } from '@vercel/node'
import { TRIPO_API_BASE, TRIPO_DEFAULT_MODEL, TRIPO_API_KEY } from '../_shared'

// 图生 3D 模型：前端传 base64 图片 → 上传到 /v3/files 获取 file_token → 调用 image-to-model
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
    const image = data?.image || ''
    if (!image) {
      res.status(400).json({ error: 'image is required' })
      return
    }

    // 解析 data URI，提取 mime 类型与 base64 数据
    const m = image.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/)
    if (!m) {
      res.status(400).json({ error: '图片格式无效，需为 data URI' })
      return
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
      res.status(uploadResp.ok ? 400 : uploadResp.status).json({
        ok: false,
        error: uploadData.message || `图片上传失败 (HTTP ${uploadResp.status})`,
      })
      return
    }
    const fileToken = uploadData.data?.file_token
    if (!fileToken) {
      res.status(500).json({ ok: false, error: '图片上传成功但未返回 file_token' })
      return
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
      res.status(genResp.ok ? 400 : genResp.status).json({
        ok: false,
        error: genData.message || `image-to-model 失败 (HTTP ${genResp.status})`,
        code: genData.code,
      })
      return
    }

    res.status(200).json({ ok: true, task_id: genData.data?.task_id })
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) })
  }
}

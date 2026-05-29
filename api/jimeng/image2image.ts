import type { VercelRequest, VercelResponse } from '@vercel/node'
import { DEFAULT_MODEL, JIMENG_API_KEY, callArkAPI } from '../_shared'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  if (!JIMENG_API_KEY) {
    res.status(401).json({ error: '请先配置 API Key' })
    return
  }

  try {
    const data = req.body
    const prompt = data.prompt || ''
    const imageBase64 = data.image_base64 || ''

    if (!imageBase64) {
      res.status(400).json({ error: 'image_base64 is required' })
      return
    }

    const imageDataUri = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`

    const requestBody: Record<string, unknown> = {
      model: data.model_version || DEFAULT_MODEL,
      prompt,
      image: [imageDataUri],
      strength: typeof data.strength === 'number' ? data.strength : 0.35,
      sequential_image_generation: 'disabled',
      size: '2K',
      response_format: 'url',
      stream: false,
      watermark: false,
    }

    const result = await callArkAPI(JIMENG_API_KEY, requestBody)
    res.status(result.ok ? 200 : 500).json(result)
  } catch (err) {
    res.status(500).json({ ok: false, images: [], error: String(err) })
  }
}
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ARK_BASE, DEFAULT_MODEL, JIMENG_API_KEY, callArkAPI } from '../_shared'

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
    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' })
      return
    }

    const requestBody: Record<string, unknown> = {
      model: data.model_version || DEFAULT_MODEL,
      prompt,
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
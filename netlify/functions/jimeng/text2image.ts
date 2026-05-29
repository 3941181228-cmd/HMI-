import { DEFAULT_MODEL, JIMENG_API_KEY, callArkAPI } from '../_shared'

export default async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    }
  }

  if (!JIMENG_API_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: '请先配置 API Key' })
    }
  }

  try {
    const data = JSON.parse(event.body || '{}')
    const prompt = data.prompt || ''
    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'prompt is required' })
      }
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
    return {
      statusCode: result.ok ? 200 : 500,
      body: JSON.stringify(result)
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, images: [], error: String(err) })
    }
  }
}

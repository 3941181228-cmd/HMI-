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
    const imageBase64 = data.image_base64 || ''

    if (!imageBase64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'image_base64 is required' })
      }
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

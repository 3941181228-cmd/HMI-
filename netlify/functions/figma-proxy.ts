import { FIGMA_API_TOKEN } from './_shared'
const FIGMA_API_BASE_URL = 'https://api.figma.com/v1'

export default async function handler(event: any) {
  const path = event.path.replace(/^\/api\/figma/, '')
  const isManualValidation = path === '/validate'
  const targetPath = isManualValidation ? '/me' : path
  const url = `${FIGMA_API_BASE_URL}${targetPath}${event.rawQuery ? '?' + event.rawQuery : ''}`
  const requestToken = String(event.headers?.['x-figma-token'] || '').trim()
  const token = isManualValidation ? requestToken : (FIGMA_API_TOKEN || requestToken)

  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ ok: false, error: '尚未配置 Figma Token' }) }
  }

  const headers: Record<string, string> = {
    'X-Figma-Token': token
  }

  // 复制请求头
  for (const [key, value] of Object.entries(event.headers)) {
    if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'x-figma-token') {
      headers[key] = String(value)
    }
  }

  try {
    const response = await fetch(url, {
      method: event.httpMethod,
      headers,
      body: event.body ? event.body : undefined
    })

    const responseHeaders: Record<string, string> = {}
    for (const [key, value] of response.headers.entries()) {
      responseHeaders[key] = value
    }

    const contentType = response.headers.get('content-type') || ''
    let body

    if (contentType.includes('application/json')) {
      body = await response.json()
      body = JSON.stringify(body)
    } else {
      const buffer = await response.arrayBuffer()
      body = Buffer.from(buffer).toString('base64')
    }

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body,
      isBase64Encoded: !contentType.includes('application/json')
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(error) })
    }
  }
}

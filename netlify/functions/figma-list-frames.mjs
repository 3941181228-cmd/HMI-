import { handleApi } from '../../server/sites-api.mjs'

export const handler = async event => {
  const url = new URL(event.rawUrl)
  url.pathname = '/api/figma/list-frames'
  const response = await handleApi(new Request(url, {
    method: event.httpMethod,
    headers: event.headers,
    body: event.httpMethod === 'POST' ? (event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body) : undefined,
  }), process.env)
  return { statusCode: response.status, headers: Object.fromEntries(response.headers), body: await response.text() }
}

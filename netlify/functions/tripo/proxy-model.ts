// 代理 3D 模型文件，规避浏览器 CORS 限制：GET /api/tripo/proxy-model?url=<model_url>
export default async function handler(event: any) {
  const params = event.queryStringParameters || {}
  const modelUrl = params.url
  if (!modelUrl) {
    return { statusCode: 400, body: JSON.stringify({ error: 'url is required' }) }
  }

  try {
    const resp = await fetch(modelUrl)
    if (!resp.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: `Upstream ${resp.status}` }) }
    }
    const contentType = resp.headers.get('content-type') || 'model/gltf-binary'
    const buffer = await resp.arrayBuffer()
    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
      body: Buffer.from(buffer).toString('base64'),
      isBase64Encoded: true,
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) }
  }
}

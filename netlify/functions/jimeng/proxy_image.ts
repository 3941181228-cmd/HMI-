export default async function handler(req: any, res: any) {
  const imageUrl = req.query.url
  if (!imageUrl) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'url is required' })
    }
  }
  try {
    const resp = await fetch(imageUrl)
    if (!resp.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `Upstream ${resp.status}` })
      }
    }
    const contentType = resp.headers.get('content-type') || 'image/jpeg'
    const buffer = await resp.arrayBuffer()
    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'max-age=3600'
      },
      body: Buffer.from(buffer).toString('base64'),
      isBase64Encoded: true
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err) })
    }
  }
}

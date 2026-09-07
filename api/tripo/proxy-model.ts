import type { VercelRequest, VercelResponse } from '@vercel/node'

// 代理 3D 模型文件，规避浏览器 CORS 限制：GET /api/tripo/proxy-model?url=<model_url>
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const modelUrl = (req.query.url as string) || ''
  if (!modelUrl) {
    res.status(400).json({ error: 'url is required' })
    return
  }

  try {
    const resp = await fetch(modelUrl)
    if (!resp.ok) {
      res.status(502).json({ error: `Upstream ${resp.status}` })
      return
    }
    const contentType = resp.headers.get('content-type') || 'model/gltf-binary'
    const buffer = await resp.arrayBuffer()
    res.status(200)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'max-age=3600')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(Buffer.from(buffer))
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
}

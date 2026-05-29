import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const imageUrl = req.query.url as string
  if (!imageUrl) {
    res.status(400).json({ error: 'url is required' })
    return
  }
  try {
    const resp = await fetch(imageUrl)
    if (!resp.ok) {
      res.status(502).json({ error: `Upstream ${resp.status}` })
      return
    }
    const contentType = resp.headers.get('content-type') || 'image/jpeg'
    const buffer = await resp.arrayBuffer()
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', 'attachment; filename="hmi-generated.png"')
    res.status(200).send(Buffer.from(buffer))
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
}
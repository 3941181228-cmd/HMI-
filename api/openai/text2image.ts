import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(401).json({ ok: false, images: [], error: 'OpenAI API 暂不支持在 Vercel 上使用，请使用即梦 API' })
}
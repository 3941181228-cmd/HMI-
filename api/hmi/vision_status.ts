import type { VercelRequest, VercelResponse } from '@vercel/node'
import { STORED_VISION_ENDPOINT } from '../_shared'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const ok = !!STORED_VISION_ENDPOINT
  res.status(200).json({ ok, endpoint_id: ok ? STORED_VISION_ENDPOINT.slice(0, 8) + '...' : '' })
}
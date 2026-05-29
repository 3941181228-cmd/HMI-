import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ success: false, querying: false, gen_status: 'not_applicable' })
}
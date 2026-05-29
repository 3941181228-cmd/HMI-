import { STORED_VISION_ENDPOINT } from '../../_shared'

export default async function handler(_req: any, res: any) {
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true })
  }
}

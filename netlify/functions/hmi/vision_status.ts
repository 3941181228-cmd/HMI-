import { STORED_VISION_ENDPOINT } from '../_shared'

export default async function handler(event: any) {
  const ok = !!STORED_VISION_ENDPOINT
  return {
    statusCode: 200,
    body: JSON.stringify({ ok, endpoint_id: ok ? STORED_VISION_ENDPOINT.slice(0, 8) + '...' : '' })
  }
}

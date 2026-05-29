export default async function handler(_req: any, res: any) {
  // OpenAI is not configured in this deployment, keep for backwards compatibility
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: false })
  }
}

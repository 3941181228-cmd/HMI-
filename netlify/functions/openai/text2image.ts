export default async function handler(event: any) {
  return {
    statusCode: 401,
    body: JSON.stringify({ ok: false, images: [], error: 'OpenAI API 暂不支持，请使用即梦 API' })
  }
}

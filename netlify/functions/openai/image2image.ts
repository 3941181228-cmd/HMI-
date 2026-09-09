import { OPENAI_API_BASE, OPENAI_IMAGE_MODEL, resolveOpenAIApiKey } from '../_shared'

export default async function handler(event: any) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ ok: false, images: [], error: '请使用 POST 请求' }) }
  const key = resolveOpenAIApiKey(event.headers?.['x-openai-api-key'])
  if (!key) return { statusCode: 503, body: JSON.stringify({ ok: false, images: [], error: '尚未配置默认 OpenAI API' }) }
  let data
  try { data = JSON.parse(event.body || '{}') } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, images: [], error: '请求格式无效' }) }
  }
  if (typeof data.image_base64 !== 'string' || !data.image_base64) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, images: [], error: '请先上传参考图' }) }
  }
  const match = data.image_base64.match(/^data:([^;]+);base64,(.+)$/s)
  const mime = match?.[1]?.startsWith('image/') ? match[1] : 'image/png'
  const encoded = match ? match[2] : data.image_base64
  try {
    const form = new FormData()
    form.append('model', OPENAI_IMAGE_MODEL)
    form.append('prompt',
      'Color palette replacement ONLY. Keep the layout, composition, UI positions, sizes, shapes, icons, text and spacing identical. ' +
      'Only change colors, backgrounds, highlights, borders and gradients. ' + String(data.prompt || ''))
    form.append('size', '1536x1024')
    form.append('n', '1')
    form.append('image', new Blob([Buffer.from(encoded, 'base64')], { type: mime }), 'reference.png')
    const response = await fetch(`${OPENAI_API_BASE}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })
    const result = await response.json() as any
    const images = Array.isArray(result?.data) ? result.data.flatMap((item: any) =>
      item?.url ? [item.url] : item?.b64_json ? [`data:image/png;base64,${item.b64_json}`] : []) : []
    return {
      statusCode: response.ok && images.length ? 200 : response.status || 502,
      body: JSON.stringify({ ok: response.ok && images.length > 0, images, error: response.ok ? (images.length ? undefined : 'OpenAI 未返回图片') : result?.error?.message || 'OpenAI API 请求失败' }),
    }
  } catch {
    return { statusCode: 504, body: JSON.stringify({ ok: false, images: [], error: 'OpenAI API 暂时无法响应' }) }
  }
}

import { getStoredArkKey, getStoredOpenAIKey } from './apiStorage'
import { readImageResponse } from './imageResponse'

export type PngProvider = 'jimeng' | 'openai' | 'ark'
export const PNG_PROVIDERS: { id: PngProvider; name: string }[] = [
  { id: 'jimeng', name: '即梦 · Seedream' },
  { id: 'openai', name: 'GPT 图像 · OpenAI' },
  { id: 'ark', name: '火山方舟 · Seedream' },
]

export function defaultPngProvider(): PngProvider {
  try {
    const provider = JSON.parse(localStorage.getItem('api_config_status') || '{}').provider
    if (PNG_PROVIDERS.some(item => item.id === provider)) return provider
  } catch { /* Use the existing default image API. */ }
  return 'jimeng'
}

export async function generateHmiPng(prompt: string, referenceImage: string | null, provider: PngProvider): Promise<string[]> {
  if (!PNG_PROVIDERS.some(item => item.id === provider)) throw new Error('不支持所选图像接口')
  const openai = provider === 'openai'
  const key = (openai ? getStoredOpenAIKey() : getStoredArkKey()).trim()
  let result: Awaited<ReturnType<typeof readImageResponse>>
  try {
    const response = await fetch(`/api/${openai ? 'openai' : 'jimeng'}/${referenceImage ? 'image2image' : 'text2image'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-HMI-Keep-Alive': '1', ...(key ? { [openai ? 'X-OpenAI-Api-Key' : 'X-Jimeng-Api-Key']: key } : {}) },
      body: JSON.stringify({ prompt, image_base64: referenceImage || undefined, hmi_preview: true, size: '2K' }),
      signal: AbortSignal.timeout(210000),
    })
    result = await readImageResponse(response)
  } catch (cause) {
    if (cause instanceof TypeError || (cause instanceof Error && /fetch|network|timeout|abort/i.test(`${cause.name} ${cause.message}`))) {
      throw new Error('生成请求的网络连接已中断，尚未收到结果。请保持页面打开并检查网络；未自动重复提交。')
    }
    throw cause
  }
  const data = result.payload
  if (result.status >= 400 || !data?.ok || !Array.isArray(data.images) || !data.images.length) throw new Error(data?.error || 'PNG 图片生成失败，请检查设置中的图像 API')
  const images: string[] = data.images
  // Decode and encode as PNG: a .png filename alone would not ensure PNG bytes.
  return Promise.all(images.map(async source => {
    let blob: Blob
    const inline = source.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i)
    if (inline) {
      try {
        const binary = atob(inline[2])
        blob = new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], { type: inline[1] })
      } catch { throw new Error('模型返回的图片数据编码无效，无法转换 PNG。') }
    } else {
      const url = provider === 'openai' ? source : `/api/jimeng/download?url=${encodeURIComponent(source)}`
      const response = await fetch(url).catch(() => { throw new Error('模型已返回图片，但读取图片的连接失败，无法转换 PNG。') })
      if (!response.ok) throw new Error(`图片下载接口返回 HTTP ${response.status}，无法导出 PNG。`)
      blob = await response.blob()
    }
    const bitmap = await createImageBitmap(blob).catch(() => { throw new Error('已收到图片数据，但浏览器无法解码为图片。') })
    try {
      if (bitmap.width > 8192 || bitmap.height > 8192) throw new Error('图片尺寸过大，无法在浏览器转换 PNG')
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('浏览器无法处理 PNG 图片')
      context.drawImage(bitmap, 0, 0)
      return canvas.toDataURL('image/png')
    } finally { bitmap.close() }
  }))
}

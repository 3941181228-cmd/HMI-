/**
 * Figma 图片代理工具
 * 将Figma S3图片URL通过第三方图片CDN代理访问，解决网络阻止问题
 */

/**
 * 判断URL是否为Figma S3图片URL
 */
export function isFigmaS3Url(url: string): boolean {
  if (!url) return false
  return url.includes('figma-alpha-api.s3') || 
         url.includes('s3-us-west-2.amazonaws.com') ||
         url.includes('amazonaws.com/figma') ||
         url.includes('figma.com/image') ||
         (url.includes('s3.') && url.includes('amazonaws.com') && url.includes('figma'))
}

/**
 * 构建wsrv.nl代理URL
 * 关键：ssl:前缀不能被编码，只编码域名+路径+查询参数
 */
function buildWsrvUrl(url: string, preview = false): string {
  // 移除协议，保留域名和路径
  const withoutProtocol = url.replace(/^https?:\/\//, '')
  // 只编码URL部分，ssl:前缀保持原样
  const encoded = encodeURIComponent(withoutProtocol)
  let proxyUrl = `https://wsrv.nl/?url=ssl:${encoded}`
  if (preview) {
    proxyUrl += '&w=800&output=webp&q=70'
  }
  return proxyUrl
}

/**
 * 构建allorigins代理URL（备选）
 */
function buildAlloriginsUrl(url: string): string {
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
}

/**
 * 构建corsproxy.io代理URL（备选）
 */
function buildCorsproxyUrl(url: string): string {
  return `https://corsproxy.io/?url=${encodeURIComponent(url)}`
}

/**
 * 构建本地服务器代理URL（最后备选）
 */
function buildLocalProxyUrl(url: string): string {
  return `/api/figma/proxy-image?url=${encodeURIComponent(url)}`
}

/**
 * 将Figma S3图片URL转换为代理URL（预览优化版）
 * @param url 原始Figma S3图片URL
 * @param preview 是否为预览模式（添加压缩参数，加快加载）
 * @returns 代理后的URL
 */
export function getProxiedFigmaImageUrl(url: string, preview = false): string {
  if (!url || !isFigmaS3Url(url)) {
    return url
  }
  return buildWsrvUrl(url, preview)
}

// 代理函数列表（用于fetch下载时依次尝试）
// 优先使用本地服务器代理（最可靠，不受第三方限流影响）
const PROXY_BUILDERS = [
  buildLocalProxyUrl,
  (url: string) => buildWsrvUrl(url, false),
  buildAlloriginsUrl,
  buildCorsproxyUrl,
]

/**
 * 带超时的 fetch（使用 AbortController）
 * @param url 请求 URL
 * @param timeoutMs 超时毫秒（默认 10s，导出场景缩短以加速失败回退）
 */
async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 通过单个代理下载图片（单次尝试，失败立即返回）
 * @param proxyUrl 代理 URL
 * @param timeoutMs 超时毫秒（默认 10s）
 */
async function fetchViaProxyOnce(proxyUrl: string, timeoutMs = 10000): Promise<Blob | null> {
  try {
    const response = await fetchWithTimeout(proxyUrl, timeoutMs)
    if (response.ok) {
      const blob = await response.blob()
      if (blob.size > 0) return blob
    }
    // 4xx 错误码说明代理本身可用，只是资源问题，不重试
  } catch (err: any) {
    // 超时或网络错误，静默失败（外层会尝试下一个代理）
  }
  return null
}

/**
 * 通过代理下载Figma图片并返回Blob（全分辨率，用于下载）
 * 优化：本地代理 + wsrv 并行请求，谁先成功用谁，大幅加速下载
 * @param url 原始Figma S3图片URL
 * @returns Blob对象
 */
export async function fetchFigmaImageAsBlob(url: string): Promise<Blob> {
  if (!url || !isFigmaS3Url(url)) {
    // 非S3 URL直接下载
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch image: HTTP ${response.status}`)
    return await response.blob()
  }

  // 优化：本地代理 + wsrv.nl 并行请求（前 2 个最可靠的代理同时跑）
  // 谁先成功就返回谁，避免串行等待
  const localProxyUrl = buildLocalProxyUrl(url)
  const wsrvProxyUrl = buildWsrvUrl(url, false)

  // Promise.race：并行跑 2 个代理，先到先得
  const racePromise = Promise.race([
    fetchViaProxyOnce(localProxyUrl, 10000).then(b => b || Promise.reject('local failed')),
    fetchViaProxyOnce(wsrvProxyUrl, 10000).then(b => b || Promise.reject('wsrv failed')),
  ]).catch(() => null)

  const blob = await racePromise
  if (blob) return blob

  // 前 2 个并行都失败，依次尝试剩余代理（allorigins, corsproxy）
  for (let i = 2; i < PROXY_BUILDERS.length; i++) {
    const proxyUrl = PROXY_BUILDERS[i](url)
    const blob = await fetchViaProxyOnce(proxyUrl, 10000)
    if (blob) return blob
  }

  // 所有代理都失败，最后再重试一次本地代理（可能只是临时网络抖动）
  const retryBlob = await fetchViaProxyOnce(localProxyUrl, 15000)
  if (retryBlob) return retryBlob

  throw new Error('所有图片代理均失败，可能是网络限制或 Figma S3 链接已过期')
}

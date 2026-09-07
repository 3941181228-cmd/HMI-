import { useState, useEffect } from 'react'
import { isFigmaS3Url } from '../services/figmaImageProxy'

/**
 * 构建多个代理URL，按优先级排序
 * 优先使用本地服务器代理（最可靠，不受第三方限流和URL长度限制影响）
 */
function buildProxyUrls(url: string, preview = false): string[] {
  if (!isFigmaS3Url(url)) return [url]

  const withoutProtocol = url.replace(/^https?:\/\//, '')
  const encoded = encodeURIComponent(withoutProtocol)
  const fullEncoded = encodeURIComponent(url)

  const proxies = [
    // 1. 本地服务器代理（最可靠：通过Node.js直接下载S3图片，不受CORS/限流/URL长度限制）
    `/api/figma/proxy-image?url=${fullEncoded}`,
    // 2. wsrv.nl — 图片CDN代理，支持压缩优化（备选：本地代理失败时使用）
    preview
      ? `https://wsrv.nl/?url=ssl:${encoded}&w=800&output=webp&q=70`
      : `https://wsrv.nl/?url=ssl:${encoded}`,
    // 3. allorigins.win — 通用CORS代理
    `https://api.allorigins.win/raw?url=${fullEncoded}`,
    // 4. corsproxy.io — CORS代理
    `https://corsproxy.io/?url=${fullEncoded}`,
  ]

  return proxies
}

interface FigmaImageProps {
  url: string
  alt: string
  className?: string
  preview?: boolean
  loading?: 'lazy' | 'eager'
  onError?: () => void
  onLoad?: () => void
}

/**
 * Figma图片组件
 * 自动尝试多个代理，直到成功加载图片
 */
export function FigmaImage({
  url,
  alt,
  className,
  preview = false,
  loading = 'lazy',
  onError,
  onLoad,
}: FigmaImageProps) {
  const proxyUrls = buildProxyUrls(url, preview)
  const [proxyIndex, setProxyIndex] = useState(0)
  const [allFailed, setAllFailed] = useState(false)

  // URL变化时重置状态
  useEffect(() => {
    setProxyIndex(0)
    setAllFailed(false)
  }, [url])

  // 诊断日志：URL 变化时打印代理列表
  useEffect(() => {
    console.log(`[FigmaImage] 加载图片: ${alt}`, {
      原始URL: url?.slice(0, 80) + (url && url.length > 80 ? '...' : ''),
      是S3链接: isFigmaS3Url(url),
      代理数量: proxyUrls.length,
      预览模式: preview,
    })
  }, [url, alt, preview, proxyUrls.length])

  const handleError = () => {
    const failedProxy = proxyUrls[proxyIndex]
    console.warn(`[FigmaImage] 代理失败 [${proxyIndex + 1}/${proxyUrls.length}]: ${alt}`, failedProxy?.slice(0, 100))

    if (proxyIndex < proxyUrls.length - 1) {
      // 尝试下一个代理
      const nextIndex = proxyIndex + 1
      console.log(`[FigmaImage] 切换到下一个代理 [${nextIndex + 1}/${proxyUrls.length}]:`, proxyUrls[nextIndex]?.slice(0, 100))
      setProxyIndex(nextIndex)
    } else {
      // 所有代理都失败
      console.error(`[FigmaImage] 所有代理均失败: ${alt}`, {
        原始URL: url,
        尝试过的代理: proxyUrls,
      })
      setAllFailed(true)
      onError?.()
    }
  }

  const handleLoad = () => {
    console.log(`[FigmaImage] 加载成功: ${alt} (使用代理 ${proxyIndex + 1}/${proxyUrls.length})`)
    onLoad?.()
  }

  if (allFailed) {
    return null // 返回null，让父组件显示错误状态
  }

  return (
    <img
      src={proxyUrls[proxyIndex]}
      alt={alt}
      className={className}
      loading={loading}
      onError={handleError}
      onLoad={handleLoad}
    />
  )
}

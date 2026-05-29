export function getProxyImageUrl(url: string): string {
  if (!url) return ''
  
  if (url.startsWith('data:')) {
    return url
  }
  
  if (url.startsWith('http://localhost') || url.startsWith('/api/')) {
    return url
  }
  
  return `/api/jimeng/proxy_image?url=${encodeURIComponent(url)}`
}

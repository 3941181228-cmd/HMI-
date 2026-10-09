export interface ThemeRule { name: string; light: string; dark: string }
export interface ThemeFrame { id: string; name: string; width: number; height: number }

function color(value: any): string {
  if (typeof value === 'string' && /^#[\da-f]{6}([\da-f]{2})?$/i.test(value.trim())) return value.trim().toUpperCase()
  if (value && typeof value === 'object') {
    const rgb = [value.r, value.g, value.b]
    const alpha = value.a ?? 1
    if (rgb.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 255) && typeof alpha === 'number' && Number.isFinite(alpha) && alpha >= 0 && alpha <= 1) {
      // Match the existing plugin's normalization of RGB channel objects.
      return '#' + [...rgb.map(v => Math.round(v > 1 ? v : v * 255)), Math.round(alpha * 255)].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()
    }
  }
  throw new Error('颜色需为 #RRGGBB、#RRGGBBAA 或有效的 RGB 对象')
}

export function normalizeThemeMapping(input: any): ThemeRule[] {
  const source = Array.isArray(input) ? input : input?.mapping ?? input?.rules
  if (!Array.isArray(source) || !source.length || source.length > 500) throw new Error('请提供 1～500 条 light / dark 映射规则')
  return source.map((rule, index) => ({ name: String(rule?.name || `颜色 ${index + 1}`), light: color(rule?.light), dark: color(rule?.dark) }))
}

export async function listThemeFrames(fileUrl: string, token: string, minWidth: number, maxWidth: number): Promise<{ fileName: string; frames: ThemeFrame[] }> {
  let url: URL
  try { url = new URL(fileUrl.trim()) } catch { throw new Error('请输入完整的 Figma 文件链接') }
  if (url.protocol !== 'https:' || !['figma.com', 'www.figma.com'].includes(url.hostname) || !/^\/(design|file)\/[A-Za-z0-9_-]+/.test(url.pathname)) throw new Error('请输入有效的 Figma design 或 file 链接')
  const response = await fetch('/api/figma/list-frames', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token.trim() ? { 'X-Figma-Token': token.trim() } : {}) },
    body: JSON.stringify({ fileUrl: url.href, minWidth, maxWidth }), signal: AbortSignal.timeout(60000),
  })
  let data: any
  try { data = await response.json() } catch { throw new Error('画板读取接口未返回 JSON，请确认服务器已部署 /api/figma/list-frames') }
  if (!response.ok || data?.ok !== true || !Array.isArray(data.frames)) throw new Error(typeof data?.error === 'string' ? data.error : `画板读取失败（HTTP ${response.status}），请检查接口部署与文件权限`)
  if (data.frames.some((f: any) => typeof f?.id !== 'string' || typeof f?.name !== 'string' || !Number.isFinite(f?.width) || !Number.isFinite(f?.height))) throw new Error('服务器返回的画板数据无效')
  return { fileName: String(data.fileName || ''), frames: data.frames }
}

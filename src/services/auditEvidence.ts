import type { CheckIssue, DesignDataSnapshot } from './figmaAnalyzer'
import type { FrameImage } from './figmaStorage'

export function auditImageUrl(url: string) {
  return '/api/figma/proxy-image?url=' + encodeURIComponent(url)
}

// Never infer a node from its name or from page coordinates alone: pages may overlap.
export function getIssueOverlay(issue: CheckIssue | undefined, frame: FrameImage, snapshot?: DesignDataSnapshot) {
  if (!issue?.nodeId || issue.source === 'ai' || !snapshot || !frame.absoluteBounds || !frame.version || frame.version !== snapshot.fileVersion || !frame.bounds) return null
  const node = snapshot.nodeMap.get(issue.nodeId)
  if (!node || node.visible === false || !snapshot.nodes.some(n => n.id === node.id) || !node.bounds) return null
  let ancestor: typeof node | undefined = node
  while (ancestor && ancestor.id !== frame.id) ancestor = ancestor.parentId ? snapshot.nodeMap.get(ancestor.parentId) : undefined
  if (!ancestor) return null
  const b = node.bounds, f = frame.bounds
  if (![b.x, b.y, b.width, b.height, f.x, f.y, f.width, f.height].every(Number.isFinite) || f.width <= 0 || f.height <= 0) return null
  const left = Math.max(b.x, f.x), top = Math.max(b.y, f.y)
  const right = Math.min(b.x + b.width, f.x + f.width), bottom = Math.min(b.y + b.height, f.y + f.height)
  if (right <= left || bottom <= top) return null
  return { left: (left - f.x) / f.width * 100, top: (top - f.y) / f.height * 100,
    width: (right - left) / f.width * 100, height: (bottom - top) / f.height * 100 }
}

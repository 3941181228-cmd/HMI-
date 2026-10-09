import type { AnalysisResult, CategoryAnalysis, CheckIssue } from './figmaAnalyzer'
import type { FrameImage } from './figmaStorage'
import { auditImageUrl } from './auditEvidence'
import { validateVisualAudit } from '../../shared/audit-contract.mjs'

export interface VisualAuditFinding {
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
  confidence: number
  evidence: string
  recommendation: string
  location: string
}
export interface VisualAuditResult {
  summary: string
  findings: VisualAuditFinding[]
  frameId: string
  frameName: string
  fileVersion: string
  imageHash: string
}
export function parseVisualAudit(value: unknown): Pick<VisualAuditResult, 'summary' | 'findings'> {
  if (!validateVisualAudit(value)) throw new Error('AI 返回缺少有效证据或格式不完整，未生成复核结论')
  const raw = value as VisualAuditResult
  return { summary: raw.summary, findings: raw.findings.map(f => ({
    title: f.title, description: f.description, severity: f.severity, confidence: f.confidence,
    evidence: f.evidence, recommendation: f.recommendation, location: f.location,
  })) }
}
export async function sha256(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片编码失败'))
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}
export async function runFigmaVisualAudit(frame: FrameImage, analysis: AnalysisResult, signal?: AbortSignal): Promise<VisualAuditResult> {
  if (!frame.version || frame.version !== analysis.auditMeta.fileVersion) throw new Error('截图版本未与文件快照绑定，视觉复核未执行')
  const imageResponse = await fetch(auditImageUrl(frame.url), { signal })
  if (!imageResponse.ok) throw new Error('真实截图下载失败，视觉复核未执行')
  const blob = await imageResponse.blob()
  if (!/^image\/(png|jpeg|webp)$/.test(blob.type) || !blob.size) throw new Error('截图内容无效，未调用 AI')
  if (blob.size > 11_000_000) throw new Error('画板图片过大，AI 视觉复核已跳过')
  const imageHash = await sha256(await blob.arrayBuffer())
  const imageBase64 = await blobToDataUrl(blob)
  const context = {
    scope: 'one-frame-only', frameId: frame.id, frameName: frame.name,
    fileVersion: frame.version, imageHash,
    limits: '仅复核当前这一张截图；不代表整文件；不要推断未显示的节点或精确坐标。所有发现待人工确认。',
  }
  const response = await fetch('/api/hmi/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ mode: 'design_audit', image_base64: imageBase64, context }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.ok) throw new Error(data?.error || 'AI 视觉复核失败（HTTP ' + response.status + '）')
  return { ...parseVisualAudit(data.result), frameId: frame.id, frameName: frame.name, fileVersion: frame.version, imageHash }
}
export function mergeVisualAudit(analysis: AnalysisResult, visualAudit: VisualAuditResult, fileKey: string): AnalysisResult {
  if (!analysis.dataSnapshot?.nodes.some(n => n.id === visualAudit.frameId) || visualAudit.fileVersion !== analysis.auditMeta.fileVersion) {
    throw new Error('AI 复核与当前文件版本或检测范围不匹配，已拒绝合并')
  }
  const validated = parseVisualAudit(visualAudit)
  const issues: CheckIssue[] = validated.findings.map((finding, index) => ({
    id: 'ai-visual-' + (index + 1), type: 'warning', category: 'AI 视觉复核',
    title: finding.title, description: finding.description, suggestion: finding.recommendation,
    severity: finding.severity, source: 'ai', status: 'review', confidence: finding.confidence,
    evidence: 'AI 截图观察（未验证）：' + finding.evidence,
    location: visualAudit.frameName + ' / ' + finding.location + '（AI 描述，未精确定位）',
    figmaUrl: 'https://www.figma.com/design/' + fileKey + '/?node-id=' + encodeURIComponent(visualAudit.frameId),
  }))
  const category: CategoryAnalysis = {
    id: 'visualAI', label: 'AI 截图建议 · 待人工确认',
    metrics: [{ label: '仅复核截图', value: visualAudit.frameName, status: 'unknown' },
      { label: '待确认建议', value: issues.length, status: 'unknown' }],
    highlights: [], suggestions: [], issues,
  }
  return {
    ...analysis, issues: [...analysis.issues.filter(i => i.source !== 'ai'), ...issues],
    categories: [...analysis.categories.filter(c => c.id !== 'visualAI'), category],
    auditMeta: { ...analysis.auditMeta, aiReview: {
      status: 'completed', findingCount: issues.length,
      message: '仅复核「' + visualAudit.frameName + '」，不代表其余画板或整体合规。AI 摘要（未验证）：' + validated.summary +
        '；截图 SHA-256：' + visualAudit.imageHash,
    } },
  }
}
export function markVisualAuditUnavailable(analysis: AnalysisResult, message: string): AnalysisResult {
  return { ...analysis, auditMeta: { ...analysis.auditMeta, aiReview: { status: 'unavailable', findingCount: 0, message } } }
}

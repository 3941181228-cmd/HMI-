// Fail closed: malformed, incomplete or evidence-free AI output is not a clean audit.
export function validateVisualAudit(value) {
  const text = (v, max = 4000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max
  return !!value && typeof value === 'object' && text(value.summary, 2000) &&
    Array.isArray(value.findings) && value.findings.length <= 12 && value.findings.every(f =>
      f && ['title', 'description', 'evidence', 'location', 'recommendation'].every(k => text(f[k])) &&
      ['high', 'medium', 'low'].includes(f.severity) &&
      typeof f.confidence === 'number' && Number.isFinite(f.confidence) && f.confidence >= 0 && f.confidence <= 1)
}

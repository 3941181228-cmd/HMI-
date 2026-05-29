interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  layoutMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  style?: {
    fontSize?: number;
    fontWeight?: number;
    fontFamily?: string;
    textAlignHorizontal?: string;
    textAlignVertical?: string;
  };
  characters?: string;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  constraints?: { horizontal: string; vertical: string };
  clipsContent?: boolean;
  opacity?: number;
  visible?: boolean;
}

interface FigmaPaint {
  type: string;
  color?: { r: number; g: number; b: number; a: number };
  opacity?: number;
}

export interface CheckIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  suggestion: string;
  position?: { x: number; y: number; width: number; height: number };
  severity: 'high' | 'medium' | 'low';
  nodeId?: string;
  nodeName?: string;
}

export interface ScoreCategory {
  id: string;
  label: string;
  score: number;
  maxScore: number;
}

export interface AnalysisResult {
  issues: CheckIssue[];
  categories: ScoreCategory[];
  overallScore: number;
  level: string;
  frameCount: number;
  textCount: number;
  totalNodes: number;
  frameNodeIds: string[];
  frames: string[];
}

let issueIdCounter = 0
function nextIssueId(): string {
  return `check-${++issueIdCounter}`
}

function rgbaToHex(r: number, g: number, b: number, a: number = 1): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${a < 1 ? toHex(a) : ''}`
}

function getLuminance(r: number, g: number, b: number): number {
  const srgb = [r, g, b].map((c) => {
    const s = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    return s
  })
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
}

function getContrastRatio(fg: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }): number {
  const l1 = getLuminance(fg.r, fg.g, fg.b)
  const l2 = getLuminance(bg.r, bg.g, bg.b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function collectAllNodes(node: FigmaNode, result: FigmaNode[]): void {
  if (!node.visible && node.visible !== undefined) return
  result.push(node)
  if (node.children) {
    for (const child of node.children) {
      collectAllNodes(child, result)
    }
  }
}

function collectTopFrames(document: any): { frames: string[]; nodeIds: string[] } {
  const frames: string[] = []
  const nodeIds: string[] = []
  for (const page of document.children || []) {
    if (page.children) {
      for (const node of page.children) {
        if (node.type === 'FRAME') {
          frames.push(node.name)
          nodeIds.push(node.id)
        }
      }
    }
  }
  return { frames, nodeIds }
}

function analyzeLayout(nodes: FigmaNode[], issues: CheckIssue[]): { passCount: number; failCount: number; warnCount: number } {
  let passCount = 0
  let failCount = 0
  let warnCount = 0
  const frames = nodes.filter(n => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE')

  const framesWithChildren = frames.filter(f => f.children && f.children.length > 0)
  const framesWithAutoLayout = framesWithChildren.filter(f => f.layoutMode && f.layoutMode !== 'NONE')

  if (framesWithChildren.length > 0 && framesWithAutoLayout.length === 0) {
    issues.push({
      id: nextIssueId(),
      type: 'error',
      category: '布局',
      title: '自动布局未启用',
      description: `检测到 ${framesWithChildren.length} 个包含子元素的框架未启用自动布局。`,
      suggestion: '为所有包含子元素的框架启用 Auto Layout',
      severity: 'high',
    })
    failCount++
  } else if (framesWithChildren.length > 0 && framesWithAutoLayout.length < framesWithChildren.length) {
    const missing = framesWithChildren.length - framesWithAutoLayout.length
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '布局',
      title: '部分框架未启用自动布局',
      description: `${missing} 个框架包含子元素但未启用自动布局。`,
      suggestion: '为剩余框架启用 Auto Layout 以保证响应式布局',
      severity: 'medium',
    })
    warnCount++
  } else if (framesWithAutoLayout.length > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'info',
      category: '布局',
      title: '自动布局使用良好',
      description: `检测到 ${framesWithAutoLayout.length} 个框架正确启用了自动布局。`,
      suggestion: '保持现状',
      severity: 'low',
    })
    passCount++
  }

  const largeFrames = frames.filter(f => {
    const box = f.absoluteBoundingBox
    return box && box.width > 800 && f.layoutMode === 'NONE'
  })
  if (largeFrames.length > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '布局',
      title: '大尺寸框架缺少布局约束',
      description: `${largeFrames.length} 个大尺寸框架未设置约束或自动布局。`,
      suggestion: '为大尺寸框架添加约束或启用自动布局',
      severity: 'medium',
    })
    warnCount++
  }

  if (framesWithAutoLayout.length > 0) {
    const inconsistentAlignment = framesWithAutoLayout.filter(f => {
      const hasStretch = f.children?.some(c => c.constraints?.horizontal === 'STRETCH')
      return hasStretch && f.primaryAxisAlignItems !== 'SPACE_BETWEEN'
    })
    if (inconsistentAlignment.length > 0) {
      issues.push({
        id: nextIssueId(),
        type: 'info',
        category: '布局',
        title: '对齐方式可优化',
        description: `${inconsistentAlignment.length} 个框架的弹性子元素未使用等距分布。`,
        suggestion: '考虑使用 Space Between 分布弹性子元素',
        severity: 'low',
      })
    }
  }

  return { passCount, failCount, warnCount }
}

function analyzeTypography(nodes: FigmaNode[], issues: CheckIssue[]): { passCount: number; failCount: number; warnCount: number } {
  let passCount = 0
  let failCount = 0
  let warnCount = 0

  const textNodes = nodes.filter(n => n.type === 'TEXT' && n.style)
  if (textNodes.length === 0) return { passCount, failCount, warnCount }

  const fontSizes = textNodes.map(n => n.style!.fontSize || 0).filter(s => s > 0)
  const fontFamilies = new Set(textNodes.map(n => n.style!.fontFamily).filter(Boolean))
  const fontWeights = textNodes.map(n => n.style!.fontWeight || 0).filter(w => w > 0)
  const hmiRecommendedSizes = [12, 14, 16, 18, 24, 32, 48, 60]
  const nonStandardSizes = fontSizes.filter(s => !hmiRecommendedSizes.some(r => Math.abs(s - r) <= 1))

  if (nonStandardSizes.length > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '字体',
      title: '字号层级不规范',
      description: `检测到 ${nonStandardSizes.length} 个非标准字号（${nonStandardSizes.map(s => s + 'px').slice(0, 5).join(', ')}${nonStandardSizes.length > 5 ? '...' : ''}），HMI 推荐字号：${hmiRecommendedSizes.join('/')}px。`,
      suggestion: '统一字号层级为 12/14/16/18/24/32px',
      severity: 'medium',
    })
    warnCount++
  } else {
    issues.push({
      id: nextIssueId(),
      type: 'info',
      category: '字体',
      title: '字号层级规范',
      description: `检测到 ${fontSizes.length} 个文本元素，字号均符合规范。`,
      suggestion: '保持现状',
      severity: 'low',
    })
    passCount++
  }

  if (fontFamilies.size > 3) {
    const familiesList = Array.from(fontFamilies).slice(0, 4).join(', ')
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '字体',
      title: '字体种类过多',
      description: `检测到 ${fontFamilies.size} 种不同字体（${familiesList}${fontFamilies.size > 4 ? '...' : ''}），建议控制在 2-3 种以内。`,
      suggestion: '统一字体使用，HMI 推荐使用思源黑体 / Inter',
      severity: 'medium',
    })
    warnCount++
  }

  const minWeight = Math.min(...fontWeights)
  const maxWeight = Math.max(...fontWeights)
  if (maxWeight - minWeight > 400 && textNodes.length > 5) {
    issues.push({
      id: nextIssueId(),
      type: 'info',
      category: '字体',
      title: '字重跨度较大',
      description: `字重从 ${minWeight} 到 ${maxWeight}，跨度较大。`,
      suggestion: '确认字重使用是否合理，避免不必要的多种字重',
      severity: 'low',
    })
  }

  const smallTextInCar = textNodes.filter(n => {
    const s = n.style!.fontSize || 16
    return s < 14 && n.absoluteBoundingBox && n.absoluteBoundingBox.width > 100
  })
  if (smallTextInCar.length > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '字体',
      title: '关键信息字号偏小',
      description: `检测到 ${smallTextInCar.length} 个大面积文本区域字号小于 14px，影响驾驶时可读性。`,
      suggestion: '增大关键信息字号，驾驶场景建议正文≥14px',
      severity: 'high',
    })
    warnCount++
  }

  return { passCount, failCount, warnCount }
}

function analyzeColor(nodes: FigmaNode[], issues: CheckIssue[]): { passCount: number; failCount: number; warnCount: number } {
  let passCount = 0
  let failCount = 0
  let warnCount = 0

  const textNodes = nodes.filter(n => n.type === 'TEXT' && n.fills && n.fills.length > 0)
  if (textNodes.length === 0) return { passCount, failCount, warnCount }

  const defaultBg = { r: 0.95, g: 0.95, b: 0.96 }
  let contrastIssues = 0

  for (const node of textNodes) {
    const fill = node.fills!.find(f => f.type === 'SOLID' && f.color)
    if (!fill || !fill.color) continue

    const ratio = getContrastRatio(fill.color, defaultBg)
    if (ratio < 3.0) {
      contrastIssues++
      if (contrastIssues <= 3) {
        const hex = rgbaToHex(fill.color.r, fill.color.g, fill.color.b)
        issues.push({
          id: nextIssueId(),
          type: 'error',
          category: '色彩',
          title: `"${node.name}" 文字对比度不足`,
          description: `文字颜色 ${hex} 与背景对比度为 ${ratio.toFixed(1)}:1，低于 WCAG AA 标准 4.5:1。`,
          suggestion: '加深文字颜色或调整背景色以提高对比度',
          severity: 'high',
          nodeName: node.name,
          position: node.absoluteBoundingBox ? {
            x: node.absoluteBoundingBox.x,
            y: node.absoluteBoundingBox.y,
            width: node.absoluteBoundingBox.width,
            height: node.absoluteBoundingBox.height,
          } : undefined,
        })
      }
    }
  }

  if (contrastIssues > 3) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '色彩',
      title: '多处文字对比度不足',
      description: `共检测到 ${contrastIssues} 处对比度低于标准的文本`,
      suggestion: '批量检查所有文字颜色对比度',
      severity: 'medium',
    })
    warnCount++
  }

  if (contrastIssues > 0) {
    failCount++
  } else if (textNodes.length > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'info',
      category: '色彩',
      title: '色彩对比度良好',
      description: `检测了 ${textNodes.length} 个文本元素，对比度均符合标准。`,
      suggestion: '保持现状',
      severity: 'low',
    })
    passCount++
  }

  const solidFrames = nodes.filter(n => (n.type === 'FRAME' || n.type === 'RECTANGLE') && n.fills && n.fills.length > 0)
  const frameColors: string[] = []
  for (const f of solidFrames) {
    const fill = f.fills!.find(fi => fi.type === 'SOLID' && fi.color)
    if (fill?.color) {
      frameColors.push(rgbaToHex(fill.color.r, fill.color.g, fill.color.b))
    }
  }
  const uniqueColors = new Set(frameColors)
  if (uniqueColors.size > 20) {
    issues.push({
      id: nextIssueId(),
      type: 'info',
      category: '色彩',
      title: '颜色数量较多',
      description: `检测到 ${uniqueColors.size} 种不同颜色，建议使用 Design Token 统一管理。`,
      suggestion: '使用 Color Token 减少颜色数量，提高设计一致性',
      severity: 'low',
    })
  }

  return { passCount, failCount, warnCount }
}

function analyzeSpacing(nodes: FigmaNode[], issues: CheckIssue[]): { passCount: number; failCount: number; warnCount: number } {
  let passCount = 0
  let failCount = 0
  let warnCount = 0

  const frames = nodes.filter(n => n.type === 'FRAME' && n.layoutMode && n.layoutMode !== 'NONE')
  if (frames.length === 0) return { passCount, failCount, warnCount }

  const paddings: number[] = []
  const spacings: number[] = []
  for (const f of frames) {
    if (f.paddingLeft) paddings.push(f.paddingLeft)
    if (f.paddingRight) paddings.push(f.paddingRight)
    if (f.paddingTop) paddings.push(f.paddingTop)
    if (f.paddingBottom) paddings.push(f.paddingBottom)
    if (f.itemSpacing !== undefined && f.itemSpacing > 0) spacings.push(f.itemSpacing)
  }

  const baseUnit = 8
  const nonStandardPaddings = paddings.filter(p => p % baseUnit !== 0)
  const nonStandardSpacings = spacings.filter(s => s % baseUnit !== 0)

  if (nonStandardPaddings.length > 0 || nonStandardSpacings.length > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '间距',
      title: '间距系统不统一',
      description: `检测到 ${nonStandardPaddings.length + nonStandardSpacings.length} 处非 8px 倍数的间距值。`,
      suggestion: `统一使用 ${baseUnit}px 基准间距系统`,
      severity: 'medium',
    })
    warnCount++
  } else if (paddings.length > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'info',
      category: '间距',
      title: '间距系统规范',
      description: `检测到 ${paddings.length + spacings.length} 处间距值均符合 ${baseUnit}px 倍数规范。`,
      suggestion: '保持现状',
      severity: 'low',
    })
    passCount++
  }

  const smallTouchTargets = nodes.filter(n => {
    if (n.type !== 'FRAME' && n.type !== 'COMPONENT' && n.type !== 'INSTANCE' && n.type !== 'RECTANGLE') return false
    const box = n.absoluteBoundingBox
    if (!box) return false
    const isButton = /button|btn|cta|action|tap/i.test(n.name)
    return isButton && (box.width < 44 || box.height < 44)
  })
  if (smallTouchTargets.length > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '间距',
      title: '触控区域过小',
      description: `检测到 ${smallTouchTargets.length} 个按钮/交互元素尺寸小于 44x44px 最小标准：${smallTouchTargets.map(n => n.name).join('、')}`,
      suggestion: '增大触控区域至 44x44px 以上，驾驶场景建议 56x56px',
      severity: 'high',
      nodeName: smallTouchTargets[0]?.name,
      position: smallTouchTargets[0]?.absoluteBoundingBox,
    })
    warnCount++
  }

  const allPaddings = [...paddings, ...spacings]
  if (allPaddings.length > 0) {
    const unique = new Set(allPaddings)
    if (unique.size > 8) {
      issues.push({
        id: nextIssueId(),
        type: 'info',
        category: '间距',
        title: '间距值种类较多',
        description: `共使用了 ${unique.size} 种不同间距值，建议统一使用有限的间距 Token。`,
        suggestion: '定义间距 Token：4/8/12/16/24/32/48px',
        severity: 'low',
      })
    }
  }

  return { passCount, failCount, warnCount }
}

export function analyzeFigmaDocument(document: any): AnalysisResult {
  issueIdCounter = 0
  const issues: CheckIssue[] = []

  const { frames, nodeIds } = collectTopFrames(document)

  const allNodes: FigmaNode[] = []
  for (const page of document.children || []) {
    for (const child of page.children || []) {
      collectAllNodes(child, allNodes)
    }
  }

  const textCount = allNodes.filter(n => n.type === 'TEXT').length
  const frameCount = frames.length

  const layoutResult = analyzeLayout(allNodes, issues)
  const typographyResult = analyzeTypography(allNodes, issues)
  const colorResult = analyzeColor(allNodes, issues)
  const spacingResult = analyzeSpacing(allNodes, issues)

  const calcScore = (pass: number, warn: number, fail: number, total: number): number => {
    if (total === 0) return 90
    const baseScore = 100 - (fail * 20) - (warn * 8)
    const bonus = pass * 2
    return Math.max(0, Math.min(100, baseScore + bonus))
  }

  const issueCountPerCategory = {
    layout: layoutResult.passCount + layoutResult.failCount + layoutResult.warnCount,
    typography: typographyResult.passCount + typographyResult.failCount + typographyResult.warnCount,
    color: colorResult.passCount + colorResult.failCount + colorResult.warnCount,
    spacing: spacingResult.passCount + spacingResult.failCount + spacingResult.warnCount,
  }

  const categories: ScoreCategory[] = [
    { id: 'layout', label: '布局', score: calcScore(layoutResult.passCount, layoutResult.warnCount, layoutResult.failCount, issueCountPerCategory.layout), maxScore: 100 },
    { id: 'typography', label: '排版', score: calcScore(typographyResult.passCount, typographyResult.warnCount, typographyResult.failCount, issueCountPerCategory.typography), maxScore: 100 },
    { id: 'color', label: '色彩', score: calcScore(colorResult.passCount, colorResult.warnCount, colorResult.failCount, issueCountPerCategory.color), maxScore: 100 },
    { id: 'spacing', label: '间距', score: calcScore(spacingResult.passCount, spacingResult.warnCount, spacingResult.failCount, issueCountPerCategory.spacing), maxScore: 100 },
  ]

  const overallScore = Math.round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length)

  const level = overallScore >= 90 ? '优秀' :
    overallScore >= 80 ? '专业级' :
    overallScore >= 70 ? '良好' : '需改进'

  return {
    issues,
    categories,
    overallScore,
    level,
    frameCount,
    textCount,
    totalNodes: allNodes.length,
    frameNodeIds: nodeIds,
    frames,
  }
}

export function getIssuesByCategory(issues: CheckIssue[], category: string): CheckIssue[] {
  const catMap: Record<string, string> = {
    layout: '布局',
    typography: '字体',
    color: '色彩',
    spacing: '间距',
  }
  return issues.filter(i => i.category === catMap[category])
}
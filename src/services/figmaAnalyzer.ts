// Figma 设计分析器 - 基于真实 Figma API 数据进行一致性校验
// 确保提取的数据与 Figma 原始数据完全一致，无偏差无遗漏
import type { CheckRules } from './checkRules'

// ===== Figma REST API 完整类型定义 =====

interface FigmaPaint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE' | 'EMOJI'
  color?: { r: number; g: number; b: number; a: number }
  opacity?: number
  visible?: boolean
  blendMode?: string
  gradientHandlePositions?: Array<{ x: number; y: number }>
  gradientStops?: Array<{ position: number; color: { r: number; g: number; b: number; a: number } }>
  imageRef?: string
  scaleMode?: string
  imageTransform?: number[][]
  rotation?: number
}

interface FigmaEffect {
  type: 'INNER_SHADOW' | 'DROP_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR'
  visible?: boolean
  radius?: number
  color?: { r: number; g: number; b: number; a: number }
  offset?: { x: number; y: number }
  blendMode?: string
  spread?: number
}

interface FigmaConstraint {
  type: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE'
  value?: number
}

interface FigmaConstraints {
  horizontal: FigmaConstraint['type']
  vertical: FigmaConstraint['type']
}

interface FigmaLayoutGrid {
  pattern: 'ROWS' | 'COLUMNS' | 'GRID'
  sectionSize?: number
  visible?: boolean
  color?: { r: number; g: number; b: number; a: number }
  alignment?: 'MIN' | 'MAX' | 'CENTER'
  gutterSize?: number
  offset?: number
  count?: number
  rowAlign?: string
  colAlign?: string
}

interface FigmaExportSetting {
  format: 'JPG' | 'PNG' | 'SVG' | 'PDF' | 'WEBP'
  constraint?: { type: 'SCALE' | 'WIDTH' | 'HEIGHT'; value: number }
  suffix?: string
}

interface FigmaStyle {
  fontFamily?: string
  fontPostScriptName?: string
  fontWeight?: number
  fontSize?: number
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM'
  letterSpacing?: number
  lineHeightPx?: number
  lineHeightPercent?: number
  lineHeightPercentFontSize?: number
  lineHeight?: { value: number; unit: 'PIXELS' | 'PERCENT' | 'PERCENT_FONT_SIZE' | 'AUTO' } | number
  paragraphSpacing?: number
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH'
  fillStyleId?: string
  strokeStyleId?: string
  textAlignLast?: string
  textAutoResize?: 'NONE' | 'HEIGHT' | 'WIDTH_AND_HEIGHT'
}

interface FigmaNode {
  id: string
  name: string
  type: string
  children?: FigmaNode[]
  parent?: FigmaNode
  parentId?: string
  
  // 位置与尺寸
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number }
  absoluteRenderBounds?: { x: number; y: number; width: number; height: number } | null
  boundingBox?: { x: number; y: number; width: number; height: number }
  
  // Auto Layout 参数
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
  layoutWrap?: 'NO_WRAP' | 'WRAP'
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN' | 'SPACE_AROUND' | 'SPACE_EVENLY'
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'
  paddingLeft?: number
  paddingRight?: number
  paddingTop?: number
  paddingBottom?: number
  itemSpacing?: number
  counterAxisSpacing?: number
  layoutAlign?: 'INHERIT' | 'STRETCH' | 'MIN'
  layoutGrow?: number
  layoutSizingHorizontal?: 'FIXED' | 'FILL' | 'HUG'
  layoutSizingVertical?: 'FIXED' | 'FILL' | 'HUG'
  layoutPositioning?: 'AUTO' | 'ABSOLUTE'
  
  // 外观属性
  cornerRadius?: number
  rectangleCornerRadii?: number[]
  style?: FigmaStyle
  characters?: string
  fills?: FigmaPaint[]
  strokes?: FigmaPaint[]
  strokeWeight?: number
  strokeAlign?: 'CENTER' | 'INSIDE' | 'OUTSIDE'
  strokeCap?: 'NONE' | 'ROUND' | 'SQUARE' | 'ARROW_LINES'
  strokeJoin?: 'MITER' | 'BEVEL' | 'ROUND'
  strokeMiterAngle?: number
  individualStrokeWeights?: boolean
  blendMode?: string
  opacity?: number
  visible?: boolean
  clipsContent?: boolean
  
  // 约束与变换
  constraints?: FigmaConstraints
  constrainProportions?: boolean
  rotation?: number
  transitionNodeID?: string
  preserveRatio?: boolean
  
  // 组件与实例
  componentId?: string
  componentSetId?: string
  instanceId?: string
  mainComponent?: FigmaNode
  isMasterComponent?: boolean
  properties?: Record<string, string | boolean | number>
  overrides?: Array<{ id: string; property: string; value: string }>
  
  // 交互与动画
  reactions?: Array<{
    action: { type: string; destinationId?: string; transition?: { type: string; easing?: string; duration?: number } }
    trigger: { type: string }
  }>
  
  // 网格与布局
  layoutGrids?: FigmaLayoutGrid[]
  gridStyleId?: string
  guideIds?: string[]
  
  // 导出设置
  exportSettings?: FigmaExportSetting[]
  
  // 效果
  effects?: FigmaEffect[]
  
  // 形状属性（特定类型节点）
  arcData?: { startingAngle: number; endingAngle: number; innerRadius: number; clockwise: boolean }
  pathData?: string
  strokeDashes?: number[]
  dashPattern?: number[]
  
  // 图片属性
  imageRef?: string
  scaleMode?: string
  
  // 文本属性
  autoRename?: boolean
  lineTypes?: string[]
  lineIndentations?: number[]
  lineHeights?: Array<{ value: number; unit: string }>
  paragraphTypes?: string[]
}

// ===== 提取的数据快照类型 =====

export interface ExtractedFill {
  type: FigmaPaint['type']
  color?: { r: number; g: number; b: number; a: number }
  hex?: string
  opacity: number
  visible: boolean
  blendMode?: string
  gradient?: {
    type: 'LINEAR' | 'RADIAL' | 'ANGULAR' | 'DIAMOND'
    stops: Array<{ position: number; color: string }>
    handlePositions?: Array<{ x: number; y: number }>
  }
  imageRef?: string
}

export interface ExtractedEffect {
  type: FigmaEffect['type']
  visible: boolean
  radius?: number
  color?: { r: number; g: number; b: number; a: number }
  hex?: string
  offset?: { x: number; y: number }
  blendMode?: string
  spread?: number
}

export interface ExtractedStyle {
  fontFamily?: string
  fontWeight?: number
  fontSize?: number
  textAlignHorizontal?: FigmaStyle['textAlignHorizontal']
  textAlignVertical?: FigmaStyle['textAlignVertical']
  letterSpacing?: number
  lineHeight?: { value: number; unit: string }
  lineHeightPx?: number
  lineHeightPercent?: number
  textDecoration?: FigmaStyle['textDecoration']
  paragraphSpacing?: number
}

export interface ExtractedNode {
  id: string
  name: string
  type: string
  parentId?: string

  // 位置尺寸
  bounds: { x: number; y: number; width: number; height: number } | null
  renderBounds: { x: number; y: number; width: number; height: number } | null

  // Auto Layout
  layoutMode?: FigmaNode['layoutMode']
  layoutWrap?: FigmaNode['layoutWrap']
  layoutAlign?: FigmaNode['layoutAlign']
  layoutGrow?: number
  layoutSizingHorizontal?: FigmaNode['layoutSizingHorizontal']
  layoutSizingVertical?: FigmaNode['layoutSizingVertical']
  layoutPositioning?: FigmaNode['layoutPositioning']
  padding: { top: number; right: number; bottom: number; left: number }
  itemSpacing?: number
  counterAxisSpacing?: number
  primaryAxisAlignItems?: FigmaNode['primaryAxisAlignItems']
  counterAxisAlignItems?: FigmaNode['counterAxisAlignItems']

  // 外观
  fills: ExtractedFill[]
  strokes: ExtractedFill[]
  strokeWeight?: number
  strokeAlign?: FigmaNode['strokeAlign']
  strokeCap?: FigmaNode['strokeCap']
  strokeJoin?: FigmaNode['strokeJoin']
  strokeMiterAngle?: number
  individualStrokeWeights?: boolean
  cornerRadius?: number
  rectangleCornerRadii?: number[]
  style?: ExtractedStyle
  characters?: string
  opacity?: number
  visible?: boolean
  blendMode?: string
  clipsContent?: boolean

  // 约束
  constraints?: FigmaConstraints
  constrainProportions?: boolean
  rotation?: number

  // 组件
  componentId?: string
  componentSetId?: string
  instanceId?: string
  isInstance?: boolean
  isComponent?: boolean
  properties?: Record<string, string | boolean | number>
  overrides?: Array<{ id: string; property: string; value: string }>

  // 效果
  effects: ExtractedEffect[]

  // 子节点数量
  childCount: number

  // 形状属性
  arcData?: FigmaNode['arcData']
  pathData?: string
  dashPattern?: number[]

  // 图片属性
  imageRef?: string
  scaleMode?: string

  // 交互
  reactions?: FigmaNode['reactions']
  transitionNodeID?: string

  // 布局网格
  layoutGrids?: FigmaLayoutGrid[]

  // 导出设置
  exportSettings?: FigmaExportSetting[]

  // 文本属性
  autoRename?: boolean
  lineTypes?: string[]
  lineIndentations?: number[]
}

export interface DesignDataSnapshot {
  fileName: string
  fileKey: string
  extractedAt: string
  totalNodes: number
  nodes: ExtractedNode[]
  nodeMap: Map<string, ExtractedNode>
  parentMap: Map<string, string>
  pageCount: number
  componentCount: number
  instanceCount: number
  frameCount: number
  textCount: number
  
  // 数据完整性报告
  integrityReport: {
    totalProperties: number
    extractedProperties: number
    missingProperties: number
    skippedNodes: Array<{ id: string; name: string; type: string; reason: string }>
    extractionErrors: Array<{ nodeId: string; nodeName: string; error: string }>
  }
}

// ===== 分析结果类型 =====

export interface CheckIssue {
  id: string
  type: 'error' | 'warning' | 'info'
  category: string
  title: string
  description: string
  suggestion: string
  position?: { x: number; y: number; width: number; height: number }
  severity: 'high' | 'medium' | 'low'
  nodeId?: string
  nodeName?: string
  actualValue?: string
  expectedValue?: string
}

export interface AnalysisMetric {
  label: string
  value: number | string
  unit?: string
  status: 'good' | 'warning' | 'error'
  actual?: string
  expected?: string
}

export interface DesignHighlight {
  id: string
  category: string
  title: string
  description: string
  evidence?: string
}

export interface ImprovementSuggestion {
  id: string
  category: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  affectedNodes?: number
  actionable: string
}

export interface CategoryAnalysis {
  id: string
  label: string
  metrics: AnalysisMetric[]
  highlights: DesignHighlight[]
  suggestions: ImprovementSuggestion[]
  issues: CheckIssue[]
}

export interface AnalysisResult {
  issues: CheckIssue[]
  categories: CategoryAnalysis[]
  frameCount: number
  textCount: number
  totalNodes: number
  frameNodeIds: string[]
  frames: string[]
  highlights: DesignHighlight[]
  suggestions: ImprovementSuggestion[]
  documentInfo: {
    name?: string
    pageCount: number
    componentCount: number
    instanceCount: number
  }
  dataSnapshot?: DesignDataSnapshot
  integrityReport?: DesignDataSnapshot['integrityReport']
}

// ===== 工具函数 =====

let issueIdCounter = 0
function nextIssueId(): string {
  return `check-${++issueIdCounter}`
}

function rgbaToHex(r: number, g: number, b: number, a: number = 1): string {
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const toHex = (n: number) => Math.round(clamp(n) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${a < 1 ? toHex(a) : ''}`
}

function getLuminance(r: number, g: number, b: number): number {
  const srgb = [r, g, b].map((c) => {
    const clamped = Math.max(0, Math.min(1, c))
    return clamped <= 0.03928 ? clamped / 12.92 : Math.pow((clamped + 0.055) / 1.055, 2.4)
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

// ===== 数据提取层 =====

function extractFill(paint: FigmaPaint): ExtractedFill {
  const result: ExtractedFill = {
    type: paint.type,
    opacity: paint.opacity ?? 1,
    visible: paint.visible !== false,
    blendMode: paint.blendMode,
  }
  
  if (paint.color) {
    result.color = { ...paint.color }
    result.hex = rgbaToHex(paint.color.r, paint.color.g, paint.color.b, paint.color.a ?? 1)
  }
  
  if (paint.type.startsWith('GRADIENT_')) {
    const gradientType = paint.type.replace('GRADIENT_', '') as 'LINEAR' | 'RADIAL' | 'ANGULAR' | 'DIAMOND'
    result.gradient = {
      type: gradientType,
      stops: paint.gradientStops?.map(s => ({
        position: s.position,
        color: rgbaToHex(s.color.r, s.color.g, s.color.b, s.color.a ?? 1),
      })) || [],
      handlePositions: paint.gradientHandlePositions,
    }
  }
  
  if (paint.type === 'IMAGE') {
    result.imageRef = paint.imageRef
  }
  
  return result
}

function extractEffect(effect: FigmaEffect): ExtractedEffect {
  const result: ExtractedEffect = {
    type: effect.type,
    visible: effect.visible !== false,
    radius: effect.radius,
    offset: effect.offset,
    blendMode: effect.blendMode,
    spread: effect.spread,
  }
  
  if (effect.color) {
    result.color = { ...effect.color }
    result.hex = rgbaToHex(effect.color.r, effect.color.g, effect.color.b, effect.color.a ?? 1)
  }
  
  return result
}

function extractStyle(style: FigmaStyle): ExtractedStyle {
  const result: ExtractedStyle = {
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSize: style.fontSize,
    textAlignHorizontal: style.textAlignHorizontal,
    textAlignVertical: style.textAlignVertical,
    letterSpacing: style.letterSpacing,
    textDecoration: style.textDecoration,
    paragraphSpacing: style.paragraphSpacing,
  }
  
  if (style.lineHeightPx !== undefined) {
    result.lineHeightPx = style.lineHeightPx
  }
  if (style.lineHeightPercent !== undefined) {
    result.lineHeightPercent = style.lineHeightPercent
  }
  
  if (typeof style.lineHeight === 'object' && style.lineHeight) {
    result.lineHeight = {
      value: style.lineHeight.value,
      unit: style.lineHeight.unit,
    }
  } else if (typeof style.lineHeight === 'number') {
    result.lineHeight = {
      value: style.lineHeight,
      unit: 'PIXELS',
    }
  }
  
  return result
}

function extractNode(node: FigmaNode, parentId?: string): ExtractedNode {
  const extracted: ExtractedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    parentId,
    bounds: node.absoluteBoundingBox || node.boundingBox || null,
    renderBounds: node.absoluteRenderBounds || null,
    fills: (node.fills || []).map(extractFill),
    strokes: (node.strokes || []).map(extractFill),
    strokeWeight: node.strokeWeight,
    strokeAlign: node.strokeAlign,
    strokeCap: node.strokeCap,
    strokeJoin: node.strokeJoin,
    strokeMiterAngle: node.strokeMiterAngle,
    individualStrokeWeights: node.individualStrokeWeights,
    cornerRadius: node.cornerRadius,
    rectangleCornerRadii: node.rectangleCornerRadii,
    characters: node.characters,
    opacity: node.opacity,
    visible: node.visible,
    blendMode: node.blendMode,
    clipsContent: node.clipsContent,
    constraints: node.constraints,
    constrainProportions: node.constrainProportions,
    rotation: node.rotation,
    componentId: node.componentId,
    componentSetId: node.componentSetId,
    instanceId: node.instanceId,
    isInstance: node.type === 'INSTANCE',
    isComponent: node.type === 'COMPONENT' || node.type === 'COMPONENT_SET',
    properties: node.properties,
    overrides: node.overrides,
    effects: (node.effects || []).map(extractEffect),
    childCount: (node.children && node.children.length) || 0,

    // Auto Layout
    layoutMode: node.layoutMode,
    layoutWrap: node.layoutWrap,
    layoutAlign: node.layoutAlign,
    layoutGrow: node.layoutGrow,
    layoutSizingHorizontal: node.layoutSizingHorizontal,
    layoutSizingVertical: node.layoutSizingVertical,
    layoutPositioning: node.layoutPositioning,
    padding: {
      top: node.paddingTop ?? 0,
      right: node.paddingRight ?? 0,
      bottom: node.paddingBottom ?? 0,
      left: node.paddingLeft ?? 0,
    },
    itemSpacing: node.itemSpacing,
    counterAxisSpacing: node.counterAxisSpacing,
    primaryAxisAlignItems: node.primaryAxisAlignItems,
    counterAxisAlignItems: node.counterAxisAlignItems,

    // 形状属性
    arcData: node.arcData,
    pathData: node.pathData,
    dashPattern: node.dashPattern || node.strokeDashes,

    // 图片属性
    imageRef: node.imageRef,
    scaleMode: node.scaleMode,

    // 交互
    reactions: node.reactions,
    transitionNodeID: node.transitionNodeID,

    // 布局网格
    layoutGrids: node.layoutGrids,

    // 导出设置
    exportSettings: node.exportSettings,

    // 文本属性
    autoRename: node.autoRename,
    lineTypes: node.lineTypes,
    lineIndentations: node.lineIndentations,
  }

  if (node.style) {
    extracted.style = extractStyle(node.style)
  }

  return extracted
}

export function extractAllDesignData(apiResponse: any, fileKey?: string): DesignDataSnapshot {
  const document: FigmaNode = apiResponse?.document || apiResponse
  const fileName = apiResponse?.name || document?.name || '未命名文件'
  
  const nodes: ExtractedNode[] = []
  const nodeMap = new Map<string, ExtractedNode>()
  const parentMap = new Map<string, string>()
  const skippedNodes: Array<{ id: string; name: string; type: string; reason: string }> = []
  const extractionErrors: Array<{ nodeId: string; nodeName: string; error: string }> = []
  
  let totalProperties = 0
  let extractedProperties = 0
  
  function traverse(node: FigmaNode, parentId?: string) {
    try {
      // 统计属性数量
      totalProperties += Object.keys(node).length
      
      const extracted = extractNode(node, parentId)
      nodes.push(extracted)
      nodeMap.set(node.id, extracted)
      
      if (parentId) {
        parentMap.set(node.id, parentId)
      }
      
      extractedProperties += Object.keys(extracted).filter(k => extracted[k as keyof ExtractedNode] !== undefined && extracted[k as keyof ExtractedNode] !== null).length
      
      // 递归处理子节点
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, node.id)
        }
      }
    } catch (error) {
      extractionErrors.push({
        nodeId: node.id,
        nodeName: node.name,
        error: error instanceof Error ? error.message : String(error),
      })
      skippedNodes.push({
        id: node.id,
        name: node.name,
        type: node.type,
        reason: `提取错误: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }
  
  if (document && document.children) {
    for (const page of document.children) {
      traverse(page)
    }
  }
  
  const pageCount = (document.children || []).length
  const componentCount = nodes.filter(n => n.isComponent).length
  const instanceCount = nodes.filter(n => n.isInstance).length
  const frameCount = nodes.filter(n => n.type === 'FRAME').length
  const textCount = nodes.filter(n => n.type === 'TEXT').length
  
  return {
    fileName,
    fileKey: fileKey || '',
    extractedAt: new Date().toISOString(),
    totalNodes: nodes.length,
    nodes,
    nodeMap,
    parentMap,
    pageCount,
    componentCount,
    instanceCount,
    frameCount,
    textCount,
    integrityReport: {
      totalProperties,
      extractedProperties,
      missingProperties: totalProperties - extractedProperties,
      skippedNodes,
      extractionErrors,
    },
  }
}

// ===== 真实背景色获取 =====

function findRealParentBackground(
  nodeId: string,
  nodeMap: Map<string, ExtractedNode>,
  parentMap: Map<string, string>,
  textNodeId?: string
): { r: number; g: number; b: number } | null {
  // 获取文字颜色，用于判断背景是否与文字同色（需要跳过）
  let textRgb: { r: number; g: number; b: number } | null = null
  if (textNodeId) {
    const textNode = nodeMap.get(textNodeId)
    if (textNode) {
      for (const fill of textNode.fills) {
        if (fill.type === 'SOLID' && fill.visible !== false && fill.color && fill.opacity > 0.1) {
          textRgb = { r: fill.color.r, g: fill.color.g, b: fill.color.b }
          break
        }
      }
    }
  }

  // 收集所有父节点链上有可见填充的容器
  const candidates: Array<{ rgb: { r: number; g: number; b: number }; area: number; depth: number }> = []
  let currentId = nodeId
  let depth = 0
  const maxDepth = 15

  while (depth < maxDepth) {
    const parentId = parentMap.get(currentId)
    if (!parentId) break

    const parent = nodeMap.get(parentId)
    if (!parent) break

    // 查找父节点的可见 SOLID 填充
    for (const fill of parent.fills) {
      if (fill.type === 'SOLID' && fill.visible !== false && fill.color && fill.opacity > 0.1) {
        const rgb = { r: fill.color.r, g: fill.color.g, b: fill.color.b }
        const bounds = parent.bounds
        const area = bounds ? bounds.width * bounds.height : 0
        candidates.push({ rgb, area, depth })
        break // 只取第一个可见的 SOLID 填充
      }
    }

    currentId = parentId
    depth++
  }

  if (candidates.length === 0) {
    // 没找到任何有填充的父节点，使用默认深色背景（HMI常见）
    return { r: 0.06, g: 0.09, b: 0.18 }
  }

  // 过滤掉与文字颜色相同的背景候选（避免白字白背景的误判）
  if (textRgb) {
    const filtered = candidates.filter(c =>
      !(Math.abs(c.rgb.r - textRgb.r) < 0.05 && Math.abs(c.rgb.g - textRgb.g) < 0.05 && Math.abs(c.rgb.b - textRgb.b) < 0.05)
    )
    if (filtered.length > 0) {
      // 优先选择面积最大的（通常是真正的背景容器）
      filtered.sort((a, b) => b.area - a.area)
      return filtered[0].rgb
    }
    // 所有候选都与文字同色，返回默认深色背景（HMI常见）
    return { r: 0.06, g: 0.09, b: 0.18 }
  }

  // 没有文字颜色信息时，选择面积最大的（最外层容器更可能是真实背景）
  candidates.sort((a, b) => b.area - a.area)
  return candidates[0].rgb
}

// ===== 分析函数 =====

function analyzeLayout(snapshot: DesignDataSnapshot, rules?: CheckRules): CategoryAnalysis {
  const layoutRules = rules?.layout || {}
  const autoLayoutMinRate = layoutRules.autoLayoutMinRate ?? 50
  const maxLargeFrameWithoutConstraint = layoutRules.maxLargeFrameWithoutConstraint ?? 800
  const requireAutoLayout = layoutRules.requireAutoLayout ?? false
  const maxAbsoluteInAutoLayout = layoutRules.maxAbsoluteInAutoLayout ?? 0

  const { nodes, nodeMap, parentMap } = snapshot
  const issues: CheckIssue[] = []
  const metrics: AnalysisMetric[] = []
  const highlights: DesignHighlight[] = []
  const suggestions: ImprovementSuggestion[] = []
  
  const containers = nodes.filter(n =>
    (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'COMPONENT_SET')
    && n.childCount > 0
  )
  const withAutoLayout = containers.filter(f => f.layoutMode && f.layoutMode !== 'NONE')
  
  const autoLayoutRate = containers.length > 0
    ? Math.round((withAutoLayout.length / containers.length) * 100)
    : 0
  
  metrics.push(
    { label: '容器总数', value: containers.length, status: 'good' },
    {
      label: '自动布局使用率',
      value: `${autoLayoutRate}%`,
      status: autoLayoutRate === 100 ? 'good' : autoLayoutRate >= autoLayoutMinRate ? 'warning' : 'error',
      actual: `${withAutoLayout.length}/${containers.length}`,
      expected: `${containers.length}/${containers.length}`,
    },
    { label: '自动布局容器', value: withAutoLayout.length, status: 'good' },
  )
  
  // 注意：primaryAxisAlignItems, counterAxisAlignItems, layoutAlign, layoutGrow,
  // layoutSizingHorizontal, layoutSizingVertical 等参数在 Figma API 中是可选的，
  // 不返回时代表使用默认值（如 MIN, INHERIT, 0, FIXED 等），
  // 这是正常的 Figma 行为，不是"参数不完整"，不应报告为 issue。

  // 绝对定位的子节点检测
  const absoluteInAutoLayout: string[] = []
  for (const node of nodes) {
    if (node.layoutPositioning === 'ABSOLUTE' && node.parentId) {
      const parent = nodeMap.get(node.parentId)
      if (parent && parent.layoutMode && parent.layoutMode !== 'NONE') {
        absoluteInAutoLayout.push(node.id)
        if (absoluteInAutoLayout.length > maxAbsoluteInAutoLayout) {
          issues.push({
            id: nextIssueId(),
            type: 'warning',
            category: '布局',
            title: `"${node.name}" 使用绝对定位`,
            description: `在启用 Auto Layout 的父容器 "${parent.name}" 中使用绝对定位，可能导致布局不一致`,
            suggestion: '考虑改为使用 Auto Layout 约束或移出容器',
            severity: 'medium',
            nodeId: node.id,
            nodeName: node.name,
          })
        }
      }
    }
  }
  
  if (containers.length > 0 && withAutoLayout.length === 0) {
    issues.push({
      id: nextIssueId(),
      type: requireAutoLayout ? 'error' : 'error',
      category: '布局',
      title: '自动布局未启用',
      description: `检测到 ${containers.length} 个包含子元素的容器未启用自动布局。`,
      suggestion: '为所有包含子元素的框架启用 Auto Layout（Shift+A）',
      severity: 'high',
    })
    suggestions.push({
      id: `s-${nextIssueId()}`,
      category: '布局',
      title: '统一启用自动布局',
      description: '当前所有包含子元素的容器均未启用 Auto Layout，会影响响应式布局和组件复用。',
      priority: 'high',
      affectedNodes: containers.length,
      actionable: '选中所有包含子元素的框架，按 Shift+A 启用 Auto Layout',
    })
  } else if (containers.length > 0 && withAutoLayout.length < containers.length) {
    const missing = containers.length - withAutoLayout.length
    issues.push({
      id: nextIssueId(),
      type: requireAutoLayout ? 'error' : 'warning',
      category: '布局',
      title: requireAutoLayout ? '容器未启用自动布局' : '部分容器未启用自动布局',
      description: `${missing} 个容器包含子元素但未启用自动布局。`,
      suggestion: '为剩余容器启用 Auto Layout 以保证响应式布局',
      severity: requireAutoLayout ? 'high' : 'medium',
    })
    suggestions.push({
      id: `s-${nextIssueId()}`,
      category: '布局',
      title: '补全自动布局',
      description: `${missing} 个容器仍使用绝对定位，建议启用 Auto Layout 提升设计灵活性。`,
      priority: requireAutoLayout ? 'high' : 'medium',
      affectedNodes: missing,
      actionable: '筛选未启用 Auto Layout 的框架，批量启用自动布局功能',
    })
  } else if (withAutoLayout.length > 0) {
    highlights.push({
      id: `h-${nextIssueId()}`,
      category: '布局',
      title: '自动布局使用规范',
      description: `${withAutoLayout.length} 个容器正确启用了自动布局，布局结构清晰可维护。`,
    })
  }
  
  // 大尺寸无布局约束的容器
  const largeFrames = containers.filter(f => {
    const box = f.bounds
    return box && box.width > maxLargeFrameWithoutConstraint && (!f.layoutMode || f.layoutMode === 'NONE')
  })
  
  metrics.push({
    label: '大尺寸无约束容器',
    value: largeFrames.length,
    status: largeFrames.length === 0 ? 'good' : 'warning',
  })
  
  if (largeFrames.length > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '布局',
      title: '大尺寸容器缺少布局约束',
      description: `${largeFrames.length} 个宽于 ${maxLargeFrameWithoutConstraint}px 的容器未设置自动布局或约束。`,
      suggestion: '为大尺寸容器添加约束或启用自动布局',
      severity: 'medium',
    })
  }
  
  // 最大嵌套深度
  function calcDepth(nodeId: string, d = 0): number {
    const node = nodeMap.get(nodeId)
    if (!node) return d
    if (node.childCount === 0) return d
    
    const children = nodes.filter(n => n.parentId === nodeId)
    if (children.length === 0) return d
    
    return Math.max(...children.map(c => calcDepth(c.id, d + 1)))
  }
  
  const pageIds = nodes.filter(n => n.type === 'CANVAS').map(n => n.id)
  const maxDepth = pageIds.length > 0 ? Math.max(...pageIds.map(id => calcDepth(id))) : 0
  
  metrics.push({
    label: '最大嵌套深度',
    value: maxDepth,
    status: maxDepth <= 5 ? 'good' : maxDepth <= 8 ? 'warning' : 'error',
    expected: '<= 5 层',
    actual: `${maxDepth} 层`,
  })
  
  if (maxDepth > 8) {
    suggestions.push({
      id: `s-${nextIssueId()}`,
      category: '布局',
      title: '简化嵌套层级',
      description: `当前最大布局深度为 ${maxDepth} 层，过深的嵌套会降低性能和可维护性。`,
      priority: 'medium',
      actionable: '合并不必要的嵌套框架，将最大深度控制在 5-6 层以内',
    })
  }
  
  return { id: 'layout', label: '布局结构', metrics, highlights, suggestions, issues }
}

function analyzeTypography(snapshot: DesignDataSnapshot, rules?: CheckRules): CategoryAnalysis {
  const typographyRules = rules?.typography || {}
  const maxFontFamilies = typographyRules.maxFontFamilies ?? 2
  const maxFontSizes = typographyRules.maxFontSizes ?? 6
  const maxFontWeights = typographyRules.maxFontWeights ?? 4
  const minTextSize = typographyRules.minTextSize ?? 12
  const maxLineHeightRatio = typographyRules.maxLineHeightRatio ?? 2

  const { nodes } = snapshot
  const issues: CheckIssue[] = []
  const metrics: AnalysisMetric[] = []
  const highlights: DesignHighlight[] = []
  const suggestions: ImprovementSuggestion[] = []
  
  const textNodes = nodes.filter(n => n.type === 'TEXT')
  
  metrics.push({ label: '文本元素总数', value: textNodes.length, status: 'good' })
  
  if (textNodes.length === 0) {
    return { id: 'typography', label: '排版系统', metrics, highlights, suggestions, issues }
  }
  
  const fontSizes = textNodes.map(n => n.style?.fontSize || 0).filter(s => s > 0)
  const fontFamilies = new Set(textNodes.map(n => n.style?.fontFamily).filter(Boolean))
  const fontWeights = textNodes.map(n => n.style?.fontWeight || 0).filter(w => w > 0)
  const uniqueFontWeights = new Set(fontWeights).size
  const letterSpacings = textNodes.map(n => n.style?.letterSpacing || 0)
  
  const hmiRecommendedSizes = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 60, 72]
  const nonStandardSizes = fontSizes.filter(s => !hmiRecommendedSizes.some(r => Math.abs(s - r) <= 1))
  
  const uniqueSizes = new Set(fontSizes.map(s => Math.round(s))).size
  const minWeight = fontWeights.length > 0 ? Math.min(...fontWeights) : 400
  const maxWeight = fontWeights.length > 0 ? Math.max(...fontWeights) : 400
  
  metrics.push(
    {
      label: '字体种类',
      value: fontFamilies.size,
      status: fontFamilies.size <= maxFontFamilies ? 'good' : fontFamilies.size <= maxFontFamilies + 1 ? 'warning' : 'error',
      expected: `<= ${maxFontFamilies} 种`,
      actual: `${fontFamilies.size} 种`,
    },
    {
      label: '字号种类',
      value: uniqueSizes,
      status: uniqueSizes <= maxFontSizes ? 'good' : uniqueSizes <= maxFontSizes + 4 ? 'warning' : 'error',
      expected: `<= ${maxFontSizes} 种`,
      actual: `${uniqueSizes} 种`,
    },
    {
      label: '字重种类',
      value: uniqueFontWeights,
      status: uniqueFontWeights <= maxFontWeights ? 'good' : 'warning',
      expected: `<= ${maxFontWeights} 种`,
      actual: `${uniqueFontWeights} 种`,
    },
    {
      label: '字重范围',
      value: fontWeights.length > 0 ? `${minWeight}-${maxWeight}` : 'N/A',
      status: maxWeight - minWeight <= 300 ? 'good' : 'warning',
      expected: '<= 300',
      actual: `${maxWeight - minWeight}`,
    },
    {
      label: '非标准字号',
      value: nonStandardSizes.length,
      status: nonStandardSizes.length === 0 ? 'good' : 'warning',
      expected: '0',
      actual: `${nonStandardSizes.length}`,
    },
  )
  
  if (nonStandardSizes.length > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '字体',
      title: '字号层级不规范',
      description: `检测到 ${nonStandardSizes.length} 个非标准字号（${nonStandardSizes.slice(0, 5).map(s => Math.round(s) + 'px').join(', ')}${nonStandardSizes.length > 5 ? '...' : ''}）。`,
      suggestion: '统一字号层级为 8px 网格系统（12/14/16/18/20/24/32/48px）',
      severity: 'medium',
    })
    suggestions.push({
      id: `s-${nextIssueId()}`,
      category: '字体',
      title: '规范字号层级',
      description: `当前使用了 ${uniqueSizes} 种不同字号，建议创建字号样式库统一管理。`,
      priority: 'medium',
      affectedNodes: nonStandardSizes.length,
      actionable: '创建字号样式库（Text Styles），将非标准字号替换为推荐层级',
    })
  } else {
    highlights.push({
      id: `h-${nextIssueId()}`,
      category: '字体',
      title: '字号层级规范',
      description: `${fontSizes.length} 个文本元素的字号符合规范。`,
    })
  }
  
  if (uniqueFontWeights > maxFontWeights) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '字体',
      title: '字重种类过多',
      description: `检测到 ${uniqueFontWeights} 种不同字重，建议控制在 ${maxFontWeights} 种以内。`,
      suggestion: '统一字重使用，建议使用 Regular/Medium/Bold 等有限字重层级',
      severity: 'medium',
    })
  }

  if (fontFamilies.size > maxFontFamilies + 1) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '字体',
      title: '字体种类过多',
      description: `检测到 ${fontFamilies.size} 种不同字体，建议控制在 ${maxFontFamilies}-${maxFontFamilies + 1} 种以内。`,
      suggestion: '统一字体使用，HMI 推荐使用思源黑体 / Inter / Roboto',
      severity: 'medium',
    })
  } else if (fontFamilies.size > 0) {
    highlights.push({
      id: `h-${nextIssueId()}`,
      category: '字体',
      title: '字体种类合理',
      description: `使用了 ${fontFamilies.size} 种字体，符合设计规范。`,
    })
  }
  
  // 小字号文本（驾驶场景可读性）
  const smallText = textNodes.filter(n => {
    const s = n.style?.fontSize || 16
    const box = n.bounds
    return s < minTextSize && box && box.width > 80
  })
  
  metrics.push({
    label: `小于${minTextSize}px长文本`,
    value: smallText.length,
    status: smallText.length === 0 ? 'good' : 'error',
    expected: '0',
    actual: `${smallText.length}`,
  })
  
  if (smallText.length > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '字体',
      title: '关键信息字号偏小',
      description: `检测到 ${smallText.length} 个长文本区域字号小于 ${minTextSize}px，影响可读性。`,
      suggestion: `增大关键信息字号，建议正文≥${minTextSize}px`,
      severity: 'high',
      nodeName: smallText[0]?.name,
      position: smallText[0]?.bounds || undefined,
    })
    suggestions.push({
      id: `s-${nextIssueId()}`,
      category: '字体',
      title: '增大关键信息字号',
      description: `${smallText.length} 个文本元素字号小于 ${minTextSize}px，可读性不足。`,
      priority: 'high',
      affectedNodes: smallText.length,
      actionable: `将所有小于 ${minTextSize}px 的长文本字号增大至 ${minTextSize}px 以上`,
    })
  }
  
  // 检查文本样式完整性
  for (const text of textNodes) {
    if (!text.style) {
      issues.push({
        id: nextIssueId(),
        type: 'warning',
        category: '字体',
        title: `"${text.name}" 缺少文本样式`,
        description: '文本节点未设置样式信息',
        suggestion: '为文本节点设置字体、字号等样式',
        severity: 'medium',
        nodeId: text.id,
        nodeName: text.name,
      })
    } else {
      const missingProps: string[] = []
      if (!text.style.fontFamily) missingProps.push('字体')
      if (!text.style.fontSize) missingProps.push('字号')
      if (!text.style.fontWeight) missingProps.push('字重')
      
      if (missingProps.length > 0) {
        issues.push({
          id: nextIssueId(),
          type: 'info',
          category: '字体',
          title: `"${text.name}" 样式不完整`,
          description: `缺少 ${missingProps.join(', ')} 属性`,
          suggestion: '补充完整的文本样式',
          severity: 'low',
          nodeId: text.id,
          nodeName: text.name,
        })
      }
    }
  }
  
  return { id: 'typography', label: '排版系统', metrics, highlights, suggestions, issues }
}

function analyzeColor(snapshot: DesignDataSnapshot, rules?: CheckRules): CategoryAnalysis {
  const colorRules = rules?.color || {}
  const minContrastNormal = colorRules.minContrastNormal ?? 4.5
  const minContrastLarge = colorRules.minContrastLarge ?? 3.0
  const maxColors = colorRules.maxColors ?? 20
  const minTextOpacity = colorRules.minTextOpacity ?? 0.4
  const warnLowOpacityText = colorRules.warnLowOpacityText ?? true

  const { nodes, nodeMap, parentMap } = snapshot
  const issues: CheckIssue[] = []
  const metrics: AnalysisMetric[] = []
  const highlights: DesignHighlight[] = []
  const suggestions: ImprovementSuggestion[] = []
  
  const textNodes = nodes.filter(n => n.type === 'TEXT')
  metrics.push({ label: '文本元素总数', value: textNodes.length, status: 'good' })
  
  if (textNodes.length === 0) {
    return { id: 'color', label: '色彩方案', metrics, highlights, suggestions, issues }
  }
  
  let contrastIssues = 0
  let totalContrastRatio = 0
  let validContrastCount = 0
  let lowOpacityTextCount = 0
  
  for (const node of textNodes) {
    let textColor: { r: number; g: number; b: number } | null = null
    let textOpacity = 1
    for (const fill of node.fills) {
      if (fill.type === 'SOLID' && fill.visible && fill.color) {
        textColor = { r: fill.color.r, g: fill.color.g, b: fill.color.b }
        textOpacity = fill.opacity ?? 1
        break
      }
    }

    if (warnLowOpacityText && textColor && textOpacity < minTextOpacity && textOpacity > 0) {
      lowOpacityTextCount++
      if (lowOpacityTextCount <= 5) {
        issues.push({
          id: nextIssueId(),
          type: 'warning',
          category: '色彩',
          title: `"${node.name || '文本'}" 透明度过低`,
          description: `文字透明度为 ${Math.round(textOpacity * 100)}%，低于建议的 ${Math.round(minTextOpacity * 100)}%，可能影响可读性。`,
          suggestion: '提高文字不透明度以保证可读性',
          severity: 'medium',
          nodeName: node.name,
          position: node.bounds || undefined,
          actualValue: `${Math.round(textOpacity * 100)}%`,
          expectedValue: `>= ${Math.round(minTextOpacity * 100)}%`,
        })
      }
    }

    if (!textColor || textOpacity < 0.1) continue
    
    const bgColor = findRealParentBackground(node.id, nodeMap, parentMap, node.id) || { r: 0.06, g: 0.09, b: 0.18 }
    
    const ratio = getContrastRatio(textColor, bgColor)
    totalContrastRatio += ratio
    validContrastCount++
    
    if (ratio < minContrastNormal) {
      contrastIssues++
      if (contrastIssues <= 10) {
        const textHex = rgbaToHex(textColor.r, textColor.g, textColor.b)
        const bgHex = rgbaToHex(bgColor.r, bgColor.g, bgColor.b)
        issues.push({
          id: nextIssueId(),
          type: ratio < minContrastLarge ? 'error' : 'warning',
          category: '色彩',
          title: `"${node.name || '文本'}" 对比度不足`,
          description: `文字颜色 ${textHex} 与背景 ${bgHex} 对比度为 ${ratio.toFixed(1)}:1，低于 WCAG AA 标准 ${minContrastNormal}:1。`,
          suggestion: '加深文字颜色或调整背景色以提高对比度',
          severity: ratio < minContrastLarge ? 'high' : 'medium',
          nodeName: node.name,
          position: node.bounds || undefined,
          actualValue: `${ratio.toFixed(1)}:1`,
          expectedValue: `>= ${minContrastNormal}:1`,
        })
      }
    }
  }
  
  const avgContrast = validContrastCount > 0 ? (totalContrastRatio / validContrastCount).toFixed(2) : 'N/A'
  
  metrics.push(
    {
      label: '平均对比度',
      value: avgContrast,
      status: validContrastCount > 0 && parseFloat(avgContrast) >= minContrastNormal ? 'good' : parseFloat(avgContrast) >= minContrastLarge ? 'warning' : 'error',
      expected: `>= ${minContrastNormal}:1`,
      actual: `${avgContrast}:1`,
    },
    {
      label: '对比度问题',
      value: contrastIssues,
      status: contrastIssues === 0 ? 'good' : contrastIssues <= 5 ? 'warning' : 'error',
      expected: '0',
      actual: `${contrastIssues}`,
    },
  )
  
  if (contrastIssues > 5) {
    suggestions.push({
      id: `s-${nextIssueId()}`,
      category: '色彩',
      title: '批量修复对比度问题',
      description: `${contrastIssues} 处文本对比度低于 WCAG AA 标准（${minContrastNormal}:1），建议批量检查并修复。`,
      priority: 'high',
      affectedNodes: contrastIssues,
      actionable: '使用 Figma 的对比度检查插件（如 Stark、Colorable）批量检测并修复低对比度文字',
    })
  } else if (contrastIssues > 0) {
    suggestions.push({
      id: `s-${nextIssueId()}`,
      category: '色彩',
      title: '提高文字对比度',
      description: '部分文字颜色与背景对比度不足，影响可读性。',
      priority: 'high',
      affectedNodes: contrastIssues,
      actionable: `将低对比度文字颜色加深，确保对比度达到 ${minContrastNormal}:1 以上`,
    })
  } else if (validContrastCount > 0) {
    highlights.push({
      id: `h-${nextIssueId()}`,
      category: '色彩',
      title: '色彩对比度良好',
      description: `${validContrastCount} 个文本元素的对比度均符合 WCAG AA 标准。`,
    })
  }
  
  // 颜色种类统计（包括所有填充类型）
  const allColors: string[] = []
  for (const node of nodes) {
    for (const fill of node.fills) {
      if (fill.color && fill.visible) {
        const hex = rgbaToHex(fill.color.r, fill.color.g, fill.color.b)
        allColors.push(hex.substring(0, 7))
      }
    }
  }
  const uniqueColors = new Set(allColors).size
  const goodColorThreshold = Math.floor(maxColors * 0.4)
  const warnColorThreshold = Math.floor(maxColors * 0.75)
  
  metrics.push({
    label: '主要颜色种类',
    value: uniqueColors,
    status: uniqueColors <= goodColorThreshold ? 'good' : uniqueColors <= warnColorThreshold ? 'warning' : 'error',
    expected: `<= ${maxColors} 种`,
    actual: `${uniqueColors} 种`,
  })
  
  // 渐变使用统计
  const gradientCount = nodes.reduce((acc, n) => 
    acc + n.fills.filter(f => f.type.startsWith('GRADIENT_')).length, 0
  )
  
  metrics.push({
    label: '渐变填充数量',
    value: gradientCount,
    status: gradientCount <= 5 ? 'good' : 'warning',
  })
  
  if (uniqueColors > maxColors) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '色彩',
      title: '颜色种类过多',
      description: `当前使用了 ${uniqueColors} 种不同颜色，超过建议的 ${maxColors} 种上限。`,
      suggestion: '使用颜色样式（Color Styles）统一管理颜色，合并相似颜色',
      severity: 'medium',
    })
    suggestions.push({
      id: `s-${nextIssueId()}`,
      category: '色彩',
      title: '使用 Color Styles 管理颜色',
      description: `当前使用了 ${uniqueColors} 种不同颜色，建议使用颜色样式（Color Styles）统一管理。`,
      priority: 'medium',
      actionable: '创建颜色样式库，将相似颜色合并为统一的 Design Token',
    })
  } else if (uniqueColors > 0) {
    highlights.push({
      id: `h-${nextIssueId()}`,
      category: '色彩',
      title: '颜色管理合理',
      description: `使用了 ${uniqueColors} 种主要颜色，数量在合理范围内。`,
    })
  }
  
  return { id: 'color', label: '色彩方案', metrics, highlights, suggestions, issues }
}

function analyzeSpacing(snapshot: DesignDataSnapshot, rules?: CheckRules): CategoryAnalysis {
  const spacingRules = rules?.spacing || {}
  const spacingGrid = spacingRules.spacingGrid ?? 8
  const spacingTolerance = spacingRules.spacingTolerance ?? 2
  const minTouchTarget = spacingRules.minTouchTarget ?? 44
  const minNonTouchTarget = spacingRules.minNonTouchTarget ?? 24

  const { nodes } = snapshot
  const issues: CheckIssue[] = []
  const metrics: AnalysisMetric[] = []
  const highlights: DesignHighlight[] = []
  const suggestions: ImprovementSuggestion[] = []
  
  const frames = nodes.filter(n =>
    (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE')
    && n.layoutMode && n.layoutMode !== 'NONE'
  )
  
  metrics.push({
    label: '启用自动布局容器',
    value: frames.length,
    status: frames.length > 0 ? 'good' : 'warning',
  })
  
  if (frames.length === 0) {
    return { id: 'spacing', label: '间距系统', metrics, highlights, suggestions, issues }
  }
  
  function isOnGrid(value: number): boolean {
    const remainder = value % spacingGrid
    return remainder <= spacingTolerance || remainder >= spacingGrid - spacingTolerance
  }

  const paddings: number[] = []
  const spacings: number[] = []
  for (const f of frames) {
    if (typeof f.padding.top === 'number' && f.padding.top > 0) paddings.push(f.padding.top)
    if (typeof f.padding.right === 'number' && f.padding.right > 0) paddings.push(f.padding.right)
    if (typeof f.padding.bottom === 'number' && f.padding.bottom > 0) paddings.push(f.padding.bottom)
    if (typeof f.padding.left === 'number' && f.padding.left > 0) paddings.push(f.padding.left)
    if (typeof f.itemSpacing === 'number' && f.itemSpacing > 0) spacings.push(f.itemSpacing)
    if (typeof f.counterAxisSpacing === 'number' && f.counterAxisSpacing > 0) spacings.push(f.counterAxisSpacing)
  }
  
  const nonStandardPaddings = paddings.filter(p => !isOnGrid(p) && p !== 0)
  const nonStandardSpacings = spacings.filter(s => !isOnGrid(s) && s !== 0)
  const totalSpacingCount = paddings.length + spacings.length
  const nonStandardCount = nonStandardPaddings.length + nonStandardSpacings.length
  
  const standardRate = totalSpacingCount > 0
    ? Math.round(((totalSpacingCount - nonStandardCount) / totalSpacingCount) * 100)
    : 100
  
  metrics.push(
    {
      label: '标准间距使用率',
      value: `${standardRate}%`,
      status: standardRate >= 90 ? 'good' : standardRate >= 70 ? 'warning' : 'error',
      expected: '>= 90%',
      actual: `${standardRate}%`,
    },
    { label: 'padding 数量', value: paddings.length, status: 'good' },
    { label: 'itemSpacing 数量', value: spacings.length, status: 'good' },
    { label: '非标准间距', value: nonStandardCount, status: nonStandardCount === 0 ? 'good' : 'warning', expected: '0', actual: `${nonStandardCount}` },
  )
  
  if (nonStandardCount > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '间距',
      title: '间距系统不统一',
      description: `检测到 ${nonStandardCount} 处非 ${spacingGrid}px 倍数的间距值（padding: ${nonStandardPaddings.length}, spacing: ${nonStandardSpacings.length}）。`,
      suggestion: `统一使用 ${spacingGrid}px 基准间距系统`,
      severity: 'medium',
    })
    suggestions.push({
      id: `s-${nextIssueId()}`,
      category: '间距',
      title: '统一间距系统',
      description: `${nonStandardCount} 处间距值不符合 ${spacingGrid}px 基准系统，建议统一调整。`,
      priority: 'medium',
      affectedNodes: nonStandardCount,
      actionable: `将所有间距值调整为 ${spacingGrid}px 的倍数（允许±${spacingTolerance}px误差）`,
    })
  } else if (paddings.length > 0) {
    highlights.push({
      id: `h-${nextIssueId()}`,
      category: '间距',
      title: '间距系统规范',
      description: `${totalSpacingCount} 处间距值均符合 ${spacingGrid}px 倍数规范。`,
    })
  }
  
  // 触控目标检测
  const smallTouchTargets = nodes.filter(n => {
    const isInteractive = /button|btn|cta|action|tap|touch|icon[_-]?button|nav[_-]?item/i.test(n.name || '')
      || n.type === 'COMPONENT' || n.type === 'INSTANCE'
    if (!isInteractive) return false
    const box = n.bounds
    if (!box) return false
    return (box.width < minTouchTarget || box.height < minTouchTarget) && box.width > minNonTouchTarget / 2 && box.height > minNonTouchTarget / 2
  })
  
  metrics.push({
    label: '过小触控区域',
    value: smallTouchTargets.length,
    status: smallTouchTargets.length === 0 ? 'good' : 'error',
    expected: '0',
    actual: `${smallTouchTargets.length}`,
  })
  
  if (smallTouchTargets.length > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '间距',
      title: '触控区域过小',
      description: `检测到 ${smallTouchTargets.length} 个交互元素尺寸小于 ${minTouchTarget}x${minTouchTarget}px 最小标准。`,
      suggestion: `增大触控区域至 ${minTouchTarget}x${minTouchTarget}px 以上`,
      severity: 'high',
      nodeName: smallTouchTargets[0]?.name,
      position: smallTouchTargets[0]?.bounds || undefined,
    })
    suggestions.push({
      id: `s-${nextIssueId()}`,
      category: '间距',
      title: '增大触控区域',
      description: `${smallTouchTargets.length} 个交互元素尺寸小于 ${minTouchTarget}x${minTouchTarget}px，难以精准点击。`,
      priority: 'high',
      affectedNodes: smallTouchTargets.length,
      actionable: `将所有按钮/交互元素尺寸增大至 ${minTouchTarget}x${minTouchTarget}px 以上`,
    })
  }
  
  // 检查padding一致性
  for (const frame of frames) {
    const { top, right, bottom, left } = frame.padding
    if (top !== bottom || left !== right) {
      issues.push({
        id: nextIssueId(),
        type: 'info',
        category: '间距',
        title: `"${frame.name}" padding 不对称`,
        description: `padding: ${top}px ${right}px ${bottom}px ${left}px`,
        suggestion: '考虑使用对称的 padding 值',
        severity: 'low',
        nodeId: frame.id,
        nodeName: frame.name,
      })
    }
  }
  
  return { id: 'spacing', label: '间距系统', metrics, highlights, suggestions, issues }
}

function analyzeEffects(snapshot: DesignDataSnapshot, rules?: CheckRules): CategoryAnalysis {
  const effectsRules = rules?.effects || {}
  const maxShadows = effectsRules.maxShadows ?? 10
  const maxBlurRadius = effectsRules.maxBlurRadius ?? 50
  const warnLargeAreaBlur = effectsRules.warnLargeAreaBlur ?? true
  const largeBlurAreaThreshold = effectsRules.largeBlurAreaThreshold ?? 50000

  const { nodes } = snapshot
  const issues: CheckIssue[] = []
  const metrics: AnalysisMetric[] = []
  const highlights: DesignHighlight[] = []
  const suggestions: ImprovementSuggestion[] = []
  
  const nodesWithEffects = nodes.filter(n => n.effects && n.effects.length > 0)
  const shadowCount = nodes.reduce((acc, n) => 
    acc + n.effects.filter(e => e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW').length, 0
  )
  const blurCount = nodes.reduce((acc, n) => 
    acc + n.effects.filter(e => e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR').length, 0
  )
  
  metrics.push(
    { label: '带效果节点数', value: nodesWithEffects.length, status: 'good' },
    { label: '阴影效果数', value: shadowCount, status: shadowCount <= maxShadows ? 'good' : 'warning' },
    { label: '模糊效果数', value: blurCount, status: blurCount <= 5 ? 'good' : 'warning' },
  )
  
  // 检查过度使用效果
  if (shadowCount > maxShadows * 1.5) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '视觉效果',
      title: '阴影效果过多',
      description: `检测到 ${shadowCount} 个阴影效果，超过建议的 ${maxShadows} 个，过多阴影会影响性能和视觉一致性。`,
      suggestion: '减少阴影使用，统一阴影参数',
      severity: 'medium',
    })
  }
  
  // 检查模糊半径过大
  const largeRadiusBlurNodes = nodes.filter(n => {
    return n.effects.some(e => 
      (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR') && e.radius && e.radius > maxBlurRadius
    )
  })

  if (largeRadiusBlurNodes.length > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '视觉效果',
      title: '模糊半径过大',
      description: `${largeRadiusBlurNodes.length} 个节点使用了超过 ${maxBlurRadius}px 的模糊半径，可能影响渲染性能。`,
      suggestion: `降低模糊半径至 ${maxBlurRadius}px 以内`,
      severity: 'medium',
    })
  }

  // 检查大面积模糊效果性能影响
  const largeBlurNodes = warnLargeAreaBlur ? nodes.filter(n => {
    const box = n.bounds
    const hasBlur = n.effects.some(e => (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR') && e.radius && e.radius > 0)
    const area = box ? box.width * box.height : 0
    return hasBlur && area > largeBlurAreaThreshold
  }) : []
  
  if (largeBlurNodes.length > 0) {
    issues.push({
      id: nextIssueId(),
      type: 'warning',
      category: '视觉效果',
      title: '大面积模糊效果',
      description: `${largeBlurNodes.length} 个大面积节点（>${Math.round(largeBlurAreaThreshold / 10000)}万px²）使用了模糊效果，可能影响渲染性能。`,
      suggestion: '减少大面积模糊的使用或降低模糊半径',
      severity: 'medium',
    })
  }
  
  // 检查效果一致性（相同类型节点应有相同效果）
  const componentEffectsMap = new Map<string, { shadows: number; blurs: number }>()
  for (const node of nodes) {
    if (node.isInstance && node.componentId) {
      const key = node.componentId
      const current = componentEffectsMap.get(key) || { shadows: 0, blurs: 0 }
      current.shadows += node.effects.filter(e => e.type === 'DROP_SHADOW').length
      current.blurs += node.effects.filter(e => e.type === 'BACKGROUND_BLUR').length
      componentEffectsMap.set(key, current)
    }
  }
  
  // 检查实例效果不一致
  for (const [compId, counts] of componentEffectsMap) {
    if (counts.shadows > 0 && counts.shadows < nodes.filter(n => n.componentId === compId).length) {
      issues.push({
        id: nextIssueId(),
        type: 'info',
        category: '视觉效果',
        title: '组件实例效果不一致',
        description: `部分组件实例缺少阴影效果`,
        suggestion: '确保同一组件的所有实例使用一致的效果',
        severity: 'low',
      })
    }
  }
  
  return { id: 'effects', label: '视觉效果', metrics, highlights, suggestions, issues }
}

// ===== 主分析函数 =====

export function analyzeFigmaDocument(apiResponse: any, fileKey?: string, rules?: CheckRules): AnalysisResult {
  issueIdCounter = 0
  
  const effectiveRules: CheckRules = rules || {
    name: '默认规则',
    layout: { requireAutoLayout: false, autoLayoutMinRate: 50, maxAbsoluteInAutoLayout: 0, maxLargeFrameWithoutConstraint: 800 },
    typography: { maxFontFamilies: 2, maxFontSizes: 6, maxFontWeights: 4, minTextSize: 12, maxLineHeightRatio: 2 },
    color: { minContrastNormal: 4.5, minContrastLarge: 3.0, maxColors: 20, warnLowOpacityText: true, minTextOpacity: 0.4 },
    spacing: { spacingGrid: 8, spacingTolerance: 2, minTouchTarget: 44, minNonTouchTarget: 24 },
    effects: { maxShadows: 10, maxBlurRadius: 50, warnLargeAreaBlur: true, largeBlurAreaThreshold: 50000 },
  }
  
  // 提取完整设计数据快照
  const snapshot = extractAllDesignData(apiResponse, fileKey)
  
  // Figma API 返回格式: { name, document: DOCUMENT_NODE, components, ... }
  const document: FigmaNode = apiResponse?.document || apiResponse
  const fileName = apiResponse?.name || document?.name || '未命名文件'
  
  if (!document || !document.children) {
    return {
      issues: [],
      categories: [],
      frameCount: 0,
      textCount: 0,
      totalNodes: 0,
      frameNodeIds: [],
      frames: [],
      highlights: [],
      suggestions: [],
      documentInfo: { name: fileName, pageCount: 0, componentCount: 0, instanceCount: 0 },
      dataSnapshot: snapshot,
      integrityReport: snapshot.integrityReport,
    }
  }
  
  const { nodes, nodeMap, parentMap } = snapshot
  
  // 收集顶层画板
  const topFrames = nodes.filter(n => 
    n.parentId && (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'COMPONENT_SET')
  )
  const frameNodeIds = topFrames.map(n => n.id)
  const frames = topFrames.map(n => n.name || '未命名画板')
  
  const textCount = nodes.filter(n => n.type === 'TEXT').length
  const frameCount = topFrames.length
  const pageCount = nodes.filter(n => n.type === 'CANVAS').length
  const componentCount = nodes.filter(n => n.isComponent).length
  const instanceCount = nodes.filter(n => n.isInstance).length
  
  // 执行各维度分析
  const layoutResult = analyzeLayout(snapshot, effectiveRules)
  const typographyResult = analyzeTypography(snapshot, effectiveRules)
  const colorResult = analyzeColor(snapshot, effectiveRules)
  const spacingResult = analyzeSpacing(snapshot, effectiveRules)
  const effectsResult = analyzeEffects(snapshot, effectiveRules)
  
  const issues: CheckIssue[] = [
    ...layoutResult.issues,
    ...typographyResult.issues,
    ...colorResult.issues,
    ...spacingResult.issues,
    ...effectsResult.issues,
  ]
  
  const highlights: DesignHighlight[] = [
    ...layoutResult.highlights,
    ...typographyResult.highlights,
    ...colorResult.highlights,
    ...spacingResult.highlights,
    ...effectsResult.highlights,
  ]
  
  const suggestions: ImprovementSuggestion[] = [
    ...layoutResult.suggestions,
    ...typographyResult.suggestions,
    ...colorResult.suggestions,
    ...spacingResult.suggestions,
    ...effectsResult.suggestions,
  ].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.priority] - order[b.priority]
  })
  
  const categories: CategoryAnalysis[] = [
    layoutResult,
    typographyResult,
    colorResult,
    spacingResult,
    effectsResult,
  ]
  
  return {
    issues,
    categories,
    frameCount,
    textCount,
    totalNodes: nodes.length,
    frameNodeIds,
    frames,
    highlights,
    suggestions,
    documentInfo: {
      name: fileName,
      pageCount,
      componentCount,
      instanceCount,
    },
    dataSnapshot: snapshot,
    integrityReport: snapshot.integrityReport,
  }
}

export function getIssuesByCategory(issues: CheckIssue[], category: string): CheckIssue[] {
  const catMap: Record<string, string> = {
    layout: '布局',
    typography: '字体',
    color: '色彩',
    spacing: '间距',
    effects: '视觉效果',
  }
  return issues.filter(i => i.category === catMap[category])
}
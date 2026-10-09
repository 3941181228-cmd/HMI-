// Figma 设计分析器 - 基于真实 Figma API 数据进行一致性校验
// 只报告可从已读取快照验证的事实；语义判断与缺失数据必须单独标记。
import { DEFAULT_RULES, type CheckRules } from './checkRules'

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
  overflowDirection?: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'BOTH'
  styles?: Record<string, string>
  boundVariables?: Record<string, unknown>
  isMask?: boolean
  characterStyleOverrides?: number[]
  
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
    action?: { type: string; destinationId?: string }
    actions?: Array<{ type: string; destinationId?: string }>
    trigger?: { type: string } | null
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
  overflowDirection?: FigmaNode['overflowDirection']
  styleIds: Record<string, string>
  boundVariableCount: number
  isMask?: boolean
  mixedTextStyle: boolean
  nodePath: string

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
  fileVersion?: string
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
    parsedNodes: number
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
  ruleId?: string
  affectedNodeIds?: string[]
  nodePath?: string
  source?: 'rule' | 'ai'
  status?: 'open' | 'review' | 'accepted' | 'uncheckable'
  confidence?: number
  evidence?: string
  location?: string
  figmaUrl?: string
}

export interface AnalysisMetric {
  label: string
  value: number | string
  unit?: string
  status: 'good' | 'warning' | 'error' | 'unknown'
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
  auditMeta: {
    source: 'figma-rest-api'
    strategy: 'rule-first-ai-assisted' | 'verified-rules-only'
    readOnly: true
    scope: 'file' | 'node'
    targetNodeId?: string
    targetNodeName?: string
    targetFound: boolean
    ruleSetName: string
    fileKey: string
    fileVersion?: string
    lastModified?: string
    fetchedAt?: string
    analyzedAt: string
    documentHash?: string
    rulesSnapshot: CheckRules
    hiddenNodeCount: number
    aiReview: {
      status: 'pending' | 'running' | 'completed' | 'unavailable' | 'disabled'
      findingCount: number
      message?: string
    }
  }
}

export interface AnalyzeFigmaOptions {
  targetNodeId?: string
  fetchedAt?: string
  documentHash?: string
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

function countAliases(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  if ('type' in value && value.type === 'VARIABLE_ALIAS' && 'id' in value) return 1
  return Object.values(value).reduce<number>((sum, item) => sum + countAliases(item), 0)
}

function extractNode(node: FigmaNode, parentId?: string): ExtractedNode {
  const extracted: ExtractedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    parentId,
    bounds: node.absoluteBoundingBox || null,
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
    overflowDirection: node.overflowDirection,
    styleIds: { ...(node.styles || {}) },
    boundVariableCount: countAliases(node.boundVariables) + countAliases(node.fills) + countAliases(node.strokes) + countAliases(node.effects),
    isMask: node.isMask,
    mixedTextStyle: !!node.characterStyleOverrides?.some(id => id !== 0),
    nodePath: node.name,
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

export function normalizeNodeId(nodeId?: string): string | undefined {
  if (!nodeId) return undefined
  const id = decodeURIComponent(nodeId).replace(/-/g, ':')
  if (!/^[A-Za-z0-9:;]+$/.test(id)) throw new Error('Figma 节点 ID 格式无效')
  return id
}

export function extractAllDesignData(apiResponse: any, fileKey?: string, targetNodeId?: string): DesignDataSnapshot {
  const document = apiResponse?.document
  if (!document || document.type !== 'DOCUMENT' || !Array.isArray(document.children)) {
    throw new Error('未读取到有效的 Figma 文件，不能生成检测结果')
  }
  const allNodes: ExtractedNode[] = []
  const nodeMap = new Map<string, ExtractedNode>()
  const parentMap = new Map<string, string>()
  function traverse(node: FigmaNode, parent?: ExtractedNode) {
    if (!node || typeof node.id !== 'string' || !node.id || typeof node.type !== 'string' || nodeMap.has(node.id)) {
      throw new Error('Figma 节点数据缺失或 ID 重复，请重新读取文件')
    }
    if (node.children !== undefined && !Array.isArray(node.children)) throw new Error('Figma 子节点数据异常')
    const extracted = extractNode(node, parent?.id)
    extracted.visible = parent?.visible !== false && node.visible !== false && (node.opacity ?? 1) > 0
    extracted.nodePath = parent ? parent.nodePath + ' / ' + node.name : node.name
    nodeMap.set(node.id, extracted)
    if (parent) parentMap.set(node.id, parent.id)
    allNodes.push(extracted)
    for (const child of node.children || []) traverse(child, extracted)
  }
  traverse(document)
  const targetId = normalizeNodeId(targetNodeId)
  if (targetId && !nodeMap.has(targetId)) throw new Error('未找到链接指定的节点 ' + targetId + '，检测已停止；不会回退到其他范围')
  const inScope = (node: ExtractedNode) => {
    if (!targetId) return node.type !== 'DOCUMENT'
    let current: ExtractedNode | undefined = node
    while (current) {
      if (current.id === targetId) return true
      current = current.parentId ? nodeMap.get(current.parentId) : undefined
    }
    return false
  }
  const nodes = allNodes.filter(inScope)
  if (!nodes.some(n => n.type !== 'CANVAS' && n.type !== 'DOCUMENT')) throw new Error('所选范围没有可分析的设计节点')
  const pages = new Set(nodes.map(n => {
    let current: ExtractedNode | undefined = n
    while (current && current.type !== 'CANVAS') current = current.parentId ? nodeMap.get(current.parentId) : undefined
    return current?.id
  }).filter(Boolean))
  return {
    fileName: apiResponse.name || '未命名文件', fileKey: fileKey || '', fileVersion: apiResponse.version, extractedAt: new Date().toISOString(),
    totalNodes: nodes.length, nodes, nodeMap, parentMap, pageCount: pages.size,
    componentCount: nodes.filter(n => n.isComponent).length,
    instanceCount: nodes.filter(n => n.isInstance).length,
    frameCount: nodes.filter(n => n.type === 'FRAME').length,
    textCount: nodes.filter(n => n.type === 'TEXT').length,
    integrityReport: { parsedNodes: nodes.length, skippedNodes: [], extractionErrors: [] },
  }
}

type Bounds = NonNullable<ExtractedNode['bounds']>
function validBounds(box: Bounds | null | undefined): box is Bounds {
  return !!box && [box.x, box.y, box.width, box.height].every(Number.isFinite) && box.width > 0 && box.height > 0
}
function overlaps(a: Bounds, b: Bounds) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}
function contains(a: Bounds, b: Bounds) {
  return b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height
}
function singleOpaqueFill(node: ExtractedNode) {
  const fills = node.fills.filter(f => f.visible && f.opacity > 0)
  if (fills.length !== 1) return null
  const fill = fills[0]
  return fill.type === 'SOLID' && fill.opacity === 1 && fill.color && (fill.color.a ?? 1) === 1 &&
    (!fill.blendMode || fill.blendMode === 'NORMAL') &&
    [fill.color.r, fill.color.g, fill.color.b].every(v => Number.isFinite(v) && v >= 0 && v <= 1) ? fill.color : null
}

// Conservative: no estimated backgrounds, alpha compositing, mixed runs or guessed z-order.
function resolveContrast(node: ExtractedNode, snapshot: DesignDataSnapshot, children: Map<string, ExtractedNode[]>) {
  if (node.mixedTextStyle || !validBounds(node.bounds) || !singleOpaqueFill(node)) return null
  let current: ExtractedNode | undefined = node
  let background: ExtractedNode | undefined
  while (current) {
    if ((current.opacity ?? 1) !== 1 || current.isMask || (current.rotation ?? 0) !== 0 ||
        (current.blendMode && !['NORMAL', 'PASS_THROUGH'].includes(current.blendMode)) ||
        current.effects.some(e => e.visible)) return null
    const parent: ExtractedNode | undefined = current.parentId ? snapshot.nodeMap.get(current.parentId) : undefined
    if (!parent) break
    if (parent.type !== 'CANVAS' && parent.type !== 'DOCUMENT') {
      if (!validBounds(parent.bounds) || !contains(parent.bounds, node.bounds)) return null
      // Sibling shapes or shadows can cover the text or supply a different background.
      if ((children.get(parent.id) || []).some(s => s.id !== current!.id && s.visible !== false &&
        (s.isMask || !validBounds(s.renderBounds || s.bounds) || overlaps((s.renderBounds || s.bounds)!, node.bounds!)))) return null
      if (!background && parent.fills.some(f => f.visible && f.opacity > 0)) {
        if (!['FRAME', 'COMPONENT', 'INSTANCE', 'RECTANGLE'].includes(parent.type) || !singleOpaqueFill(parent) ||
            (parent.cornerRadius ?? 0) > 0 || parent.rectangleCornerRadii?.some(r => r > 0)) return null
        background = parent
      }
    }
    current = parent
  }
  if (!background) return null
  return { foreground: singleOpaqueFill(node)!, background: singleOpaqueFill(background)!, backgroundNode: background }
}

export function analyzeFigmaDocument(apiResponse: any, fileKey?: string, rules?: CheckRules, options: AnalyzeFigmaOptions = {}): AnalysisResult {
  if (typeof apiResponse?.version !== 'string' || !apiResponse.version.trim()) {
    throw new Error('Figma 未返回文件版本，无法确认检测快照；未生成分析数据，请重新读取')
  }
  issueIdCounter = 0
  const effectiveRules: CheckRules = {
    ...DEFAULT_RULES, ...rules,
    ...Object.fromEntries(['layout', 'typography', 'color', 'spacing', 'effects', 'designSystem', 'interaction']
      .map(key => [key, { ...(DEFAULT_RULES as any)[key], ...(rules as any)?.[key] }])),
  }
  const snapshot = extractAllDesignData(apiResponse, fileKey, options.targetNodeId)
  const { nodes, nodeMap } = snapshot
  const visible = nodes.filter(n => n.visible !== false)
  const scopeIds = new Set(nodes.map(n => n.id))
  const children = new Map<string, ExtractedNode[]>()
  for (const n of nodeMap.values()) if (n.parentId) {
    if (!children.has(n.parentId)) children.set(n.parentId, [])
    children.get(n.parentId)!.push(n)
  }
  const categoryNames: Record<string, string> = {
    layout: '布局', typography: '字体', color: '色彩', spacing: '间距',
    effects: '视觉效果', designSystem: '设计系统', interaction: '交互可达性',
  }
  const categories = Object.entries(categoryNames).map(([id, label]): CategoryAnalysis => ({
    id, label, metrics: [], highlights: [], suggestions: [], issues: [],
  }))
  const category = (id: string) => categories.find(c => c.id === id)!
  const metric = (id: string, label: string, value: string | number, status: AnalysisMetric['status'] = 'good', expected?: string) =>
    category(id).metrics.push({ label, value, status, expected })
  function issue(id: string, ruleId: string, title: string, affected: ExtractedNode[], actual: string,
    expected: string, suggestion: string, status: CheckIssue['status'] = 'open', evidence?: string) {
    if (!affected.length || affected.some(n => !scopeIds.has(n.id))) return
    const node = affected[0]
    category(id).issues.push({
      id: nextIssueId(), ruleId, category: categoryNames[id], title, source: 'rule', status,
      type: status === 'uncheckable' ? 'info' : status === 'review' ? 'warning' : 'error',
      severity: status === 'open' ? 'medium' : 'low',
      description: actual, actualValue: actual, expectedValue: expected, suggestion,
      evidence: evidence || (actual + (expected ? '；规则：' + expected : '')),
      nodeId: node.id, nodeName: node.name, nodePath: node.nodePath,
      affectedNodeIds: affected.map(n => n.id),
      position: validBounds(node.bounds) ? node.bounds : undefined,
      figmaUrl: fileKey ? 'https://www.figma.com/design/' + fileKey + '/?node-id=' + encodeURIComponent(node.id) : undefined,
    })
  }
  const l = effectiveRules.layout!
  const containers = visible.filter(n => ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'].includes(n.type) && n.childCount > 0)
  const manual = containers.filter(n => !n.layoutMode || n.layoutMode === 'NONE')
  const auto = containers.filter(n => n.layoutMode && n.layoutMode !== 'NONE')
  const rate = containers.length ? Math.round(auto.length / containers.length * 100) : null
  metric('layout', '容器总数', containers.length)
  metric('layout', '自动布局使用率', rate === null ? '不适用' : rate + '%', rate === null ? 'unknown' : rate >= l.autoLayoutMinRate! ? 'good' : 'warning', '≥ ' + l.autoLayoutMinRate + '%')
  if (manual.length && (l.requireAutoLayout || (rate !== null && rate < l.autoLayoutMinRate!))) {
    issue('layout', 'layout.auto', '自动布局覆盖率低于所选规则', manual, auto.length + '/' + containers.length + ' 个容器启用 Auto Layout',
      l.requireAutoLayout ? '全部容器启用' : '使用率 ≥ ' + l.autoLayoutMinRate + '%',
      '核对固定布局或装饰容器是否应豁免；未使用 Auto Layout 本身不等于布局错误', l.requireAutoLayout ? 'open' : 'review')
  }
  const absolute = visible.filter(n => n.layoutPositioning === 'ABSOLUTE' && n.parentId && auto.some(p => p.id === n.parentId))
  if (absolute.length > l.maxAbsoluteInAutoLayout!) issue('layout', 'layout.absolute', '自动布局内的绝对定位待确认', absolute,
    absolute.length + ' 个子节点 layoutPositioning=ABSOLUTE', '≤ ' + l.maxAbsoluteInAutoLayout,
    '确认是否为有意叠放的图标或装饰', 'review')
  const large = manual.filter(n => validBounds(n.bounds) && n.bounds.width > l.maxLargeFrameWithoutConstraint!)
  if (large.length) issue('layout', 'layout.large', '大尺寸固定布局待确认', large,
    large.length + ' 个宽度 > ' + l.maxLargeFrameWithoutConstraint + 'px 的容器未启用 Auto Layout', '项目布局建议',
    '结合实际分辨率和约束设置评估；不据此判定缺少约束', 'review')
  const depth = (n: ExtractedNode): number => n.parentId && scopeIds.has(n.parentId) ? 1 + depth(nodeMap.get(n.parentId)!) : 0
  metric('layout', '最大嵌套深度', nodes.reduce((max, n) => Math.max(max, depth(n)), 0))

  const t = effectiveRules.typography!
  const texts = visible.filter(n => n.type === 'TEXT')
  metric('typography', '可见文本节点', texts.length)
  const usableTexts = texts.filter(n => !n.mixedTextStyle && Number.isFinite(n.style?.fontSize))
  const missingStyles = texts.filter(n => !usableTexts.includes(n))
  if (missingStyles.length) issue('typography', 'text.unavailable', '部分文本样式无法完整检测', missingStyles,
    missingStyles.length + ' 个节点缺少字号或包含混合文本样式', '完整单一样式数据',
    '在 Figma 中按文本范围检查；这些节点未按单一字号判定', 'uncheckable')
  for (const [label, field, limit] of [
    ['字号种类', 'fontSize', t.maxFontSizes], ['字体种类', 'fontFamily', t.maxFontFamilies], ['字重种类', 'fontWeight', t.maxFontWeights],
  ] as const) {
    const known = usableTexts.filter(n => n.style?.[field] !== undefined)
    const values = new Set(known.map(n => n.style![field]))
    metric('typography', label, known.length ? values.size : '未提供', known.length ? values.size > limit! ? 'warning' : 'good' : 'unknown', '≤ ' + limit)
    if (values.size > limit!) issue('typography', 'text.' + field, label + '超过所选规则', known,
      [...values].join('、'), '种类 ≤ ' + limit, '核对并统一文本样式')
  }
  for (const n of usableTexts) {
    const size = n.style!.fontSize!
    if (size < t.minTextSize!) issue('typography', 'text.minSize', '“' + n.name + '” 字号低于所选规则', [n],
      'fontSize=' + size + 'px', '≥ ' + t.minTextSize + 'px', '按项目规范调整字号')
    if (size > 0 && n.style?.lineHeightPx && n.style.lineHeightPx / size > t.maxLineHeightRatio!) {
      issue('typography', 'text.lineHeight', '“' + n.name + '” 行高比例待确认', [n],
        'lineHeightPx=' + n.style.lineHeightPx + '；fontSize=' + size, '行高/字号 ≤ ' + t.maxLineHeightRatio,
        '核对多行内容是否有意使用较大行高', 'review')
    }
  }

  const c = effectiveRules.color!
  let checkedContrast = 0
  let skippedContrast = 0
  let failedContrast = 0
  for (const n of texts) {
    const sample = resolveContrast(n, snapshot, children)
    const size = n.style?.fontSize
    const weight = n.style?.fontWeight
    if (!sample || !Number.isFinite(size) || (size! < 24 && size! >= 18.67 && !Number.isFinite(weight))) {
      skippedContrast++
      issue('color', 'contrast.unavailable', '“' + n.name + '” 对比度未能检测', [n],
        '缺少可验证的纯色前景/背景、单一样式或存在遮挡、透明、效果、范围外背景', '可验证的单一不透明色对',
        '在原稿中确认实际背景并测量；不使用默认背景或 AI 猜测数值', 'uncheckable')
      continue
    }
    checkedContrast++
    const threshold = size! >= 24 || (size! >= 18.67 && weight! >= 700) ? c.minContrastLarge! : c.minContrastNormal!
    const ratio = getContrastRatio(sample.foreground, sample.background)
    if (ratio < threshold) {
      failedContrast++
      const fg = rgbaToHex(sample.foreground.r, sample.foreground.g, sample.foreground.b)
      const bg = rgbaToHex(sample.background.r, sample.background.g, sample.background.b)
      issue('color', 'contrast.minimum', '“' + n.name + '” 对比度低于所选规则', [n],
        ratio.toFixed(2) + ':1', '≥ ' + threshold + ':1', '调整前景色或背景色后重新读取检测', 'open',
        '前景 ' + fg + '；最近可验证背景 ' + bg + '（节点 ' + sample.backgroundNode.id + '）；字号=' + size + 'px；字重=' + (weight ?? '未提供') + '；未四舍五入比值=' + ratio)
    }
  }
  metric('color', '已实测对比度文本', checkedContrast)
  metric('color', '对比度低于规则', failedContrast, checkedContrast ? failedContrast ? 'error' : 'good' : 'unknown')
  metric('color', '未能检测对比度', skippedContrast, skippedContrast ? 'unknown' : 'good')
  const colors = new Set(visible.flatMap(n => n.fills.filter(f => f.visible && f.color).map(f => f.hex)))
  metric('color', '可见节点填充色种类', colors.size, colors.size > c.maxColors! ? 'warning' : 'good', '≤ ' + c.maxColors)
  if (colors.size > c.maxColors!) issue('color', 'color.count', '填充色种类超过所选规则', visible.filter(n => n.fills.some(f => f.visible && f.color)),
    colors.size + ' 种填充色', '≤ ' + c.maxColors, '核对是否需要合并为样式或变量')
  if (c.warnLowOpacityText) for (const n of texts) {
    const fills = n.fills.filter(f => f.visible && f.type === 'SOLID' && f.color)
    if (fills.length !== 1 || n.mixedTextStyle) continue
    const opacity = (n.opacity ?? 1) * fills[0].opacity * (fills[0].color?.a ?? 1)
    if (opacity > 0 && opacity < c.minTextOpacity!) issue('color', 'color.opacity', '“' + n.name + '” 文字透明度偏低', [n],
      '本层有效不透明度=' + opacity, '≥ ' + c.minTextOpacity, '确认是否为禁用状态；不据此推断对比度', 'review')
  }

  const s = effectiveRules.spacing!
  const grid = s.spacingGrid!
  if (!(grid > 0)) throw new Error('间距基准必须大于 0，无法执行该规则')
  const onGrid = (value: number) => Math.abs(value - Math.round(value / grid) * grid) <= s.spacingTolerance!
  for (const n of auto) {
    const values = { ...n.padding, itemSpacing: n.itemSpacing, counterAxisSpacing: n.counterAxisSpacing }
    const offGrid = Object.entries(values).filter(([, value]) => typeof value === 'number' && !onGrid(value))
    if (offGrid.length) issue('spacing', 'spacing.grid', '“' + n.name + '” 间距不符合所选网格', [n],
      offGrid.map(([key, value]) => key + '=' + value + 'px').join('；'), grid + 'px 倍数，容差 ±' + s.spacingTolerance + 'px',
      '按所选间距规则调整或修订项目规则')
  }
  // A component is not necessarily an interactive target. Naming is only a clue, never proof.
  const candidates = visible.filter(n => /button|btn|cta|switch|slider|按钮|开关|滑块|点击/i.test(n.name) ||
    n.reactions?.some(r => ['ON_CLICK', 'ON_PRESS', 'ON_DRAG'].includes(r.trigger?.type || '')))
  const smallTargets = candidates.filter(n => validBounds(n.bounds) && (n.bounds.width < s.minTouchTarget! || n.bounds.height < s.minTouchTarget!))
  metric('spacing', '候选交互节点', candidates.length)
  metric('spacing', '尺寸待核对的候选节点', smallTargets.length, smallTargets.length ? 'warning' : 'good')
  for (const n of smallTargets) issue('spacing', 'touch.candidate', '“' + n.name + '” 触控尺寸待确认', [n],
    '可视边界=' + n.bounds!.width + '×' + n.bounds!.height + 'px', '项目候选目标阈值 ≥ ' + s.minTouchTarget + '×' + s.minTouchTarget + 'px',
    '核对真实热区与控件类型；视觉尺寸不等于实际触控热区', 'review',
    '候选依据：名称或原型触发器；absoluteBoundingBox=' + JSON.stringify(n.bounds))

  const e = effectiveRules.effects!
  const shadows = visible.filter(n => n.effects.some(f => f.visible && /SHADOW/.test(f.type)))
  const shadowCount = visible.reduce((sum, n) => sum + n.effects.filter(f => f.visible && /SHADOW/.test(f.type)).length, 0)
  metric('effects', '可见阴影效果数', shadowCount, shadowCount > e.maxShadows! ? 'warning' : 'good')
  if (shadowCount > e.maxShadows!) issue('effects', 'effects.shadows', '阴影数量超过所选规则', shadows,
    shadowCount + ' 个可见阴影', '≤ ' + e.maxShadows, '核对视觉层级和目标设备渲染成本', 'review')
  for (const n of visible) for (const effect of n.effects.filter(f => f.visible && /BLUR/.test(f.type))) {
    const area = validBounds(n.bounds) ? n.bounds.width * n.bounds.height : undefined
    if ((effect.radius ?? 0) > e.maxBlurRadius! || (e.warnLargeAreaBlur && area !== undefined && area > e.largeBlurAreaThreshold!)) {
      issue('effects', 'effects.blur', '“' + n.name + '” 模糊效果待确认', [n],
        effect.type + '；radius=' + (effect.radius ?? '未提供') + '；图层面积=' + (area ?? '未提供'),
        '半径 ≤ ' + e.maxBlurRadius + 'px；面积 ≤ ' + e.largeBlurAreaThreshold + 'px²',
        '在真实设备测量性能，不能仅凭设计文件认定性能故障', 'review')
    }
  }

  const d = effectiveRules.designSystem!
  const eligible = visible.filter(n => n.type === 'TEXT' || n.fills.length || n.strokes.length || n.effects.length)
  const styled = eligible.filter(n => Object.values(n.styleIds).some(Boolean))
  const bound = eligible.filter(n => n.boundVariableCount > 0)
  for (const [label, list, minimum, ruleId] of [
    ['Style 引用覆盖率', styled, d.minStyleCoverage, 'system.styles'],
    ['可见变量绑定覆盖率', bound, d.minVariableCoverage, 'system.variables'],
  ] as const) {
    const coverage = eligible.length ? Math.round(list.length / eligible.length * 100) : null
    metric('designSystem', label, coverage === null ? '不适用' : coverage + '%', coverage === null ? 'unknown' : coverage < minimum! ? 'warning' : 'good', '≥ ' + minimum + '%')
    if (coverage !== null && coverage < minimum!) issue('designSystem', ruleId, label + '低于项目建议',
      eligible.filter(n => !list.includes(n)), list.length + '/' + eligible.length + ' 个可样式化节点有引用',
      '覆盖率 ≥ ' + minimum + '%', '核对团队规范；原始 API 未返回引用不等于视觉不合格', 'review')
  }
  const generic = visible.filter(n => /^(Frame|Group|Rectangle|Vector|Ellipse|Text|框架|组|矩形|文本)(\s*\d+)?$/i.test(n.name))
  metric('designSystem', '通用名称节点', generic.length, generic.length > d.maxGenericNames! ? 'warning' : 'good')
  if (generic.length > d.maxGenericNames!) issue('designSystem', 'system.naming', '通用图层命名待整理', generic,
    generic.length + ' 个节点使用通用名称', '≤ ' + d.maxGenericNames, '按语义重命名以便交付与定位', 'review')
  const hiddenLarge = nodes.filter(n => n.visible === false && validBounds(n.bounds) && n.bounds.width * n.bounds.height > d.hiddenLargeNodeArea!)
  if (hiddenLarge.length) issue('designSystem', 'system.hidden', '隐藏大图层待确认', hiddenLarge,
    hiddenLarge.length + ' 个不可见图层面积超过 ' + d.hiddenLargeNodeArea + 'px²', '项目整理建议',
    '可能是备用状态或资源；不要未经确认删除', 'review')
  if (d.disallowEmbeddedMainComponents) {
    const embedded = visible.filter(n => n.type === 'COMPONENT' && n.parentId && !['CANVAS', 'COMPONENT_SET'].includes(nodeMap.get(n.parentId)?.type || ''))
    if (embedded.length) issue('designSystem', 'system.masters', '画面内主组件待确认', embedded,
      embedded.length + ' 个主组件嵌入普通容器', '优先复用实例（项目建议）', '区分组件库画板与产品画面，再决定是否替换', 'review')
  }

  const i = effectiveRules.interaction!
  const reactionNodes = visible.filter(n => n.reactions?.length || n.transitionNodeID)
  const reactionCount = reactionNodes.reduce((sum, n) => sum + (n.reactions?.length || (n.transitionNodeID ? 1 : 0)), 0)
  metric('interaction', '快照中的原型交互数', reactionCount, reactionCount < i.minReactionCount! ? 'unknown' : 'good')
  if (reactionCount < i.minReactionCount!) issue('interaction', 'interaction.coverage', '原型交互数据不足', visible.slice(0, 1),
    '读取到 ' + reactionCount + ' 条交互', '所选规则建议 ≥ ' + i.minReactionCount,
    '静态文件不能证明业务流程缺失；需运行原型确认', 'uncheckable')
  for (const n of reactionNodes) {
    const actions = n.reactions?.flatMap(r => r.actions || (r.action ? [r.action] : [])) || []
    const destinations = [...actions.map(a => a.destinationId), n.transitionNodeID].filter((id): id is string => !!id)
    const outside = destinations.filter(id => !scopeIds.has(id))
    if (outside.length) issue('interaction', 'interaction.destination', '跳转目标不在本次检测范围', [n],
      'destinationId=' + outside.join('、'), '需读取目标节点', '打开原型核对目标；不将范围外节点判为失效链接', 'uncheckable')
  }
  if (i.warnClippedOverflowWithoutScroll) for (const n of visible) {
    if (!n.clipsContent || (n.overflowDirection && n.overflowDirection !== 'NONE') || !validBounds(n.bounds)) continue
    const overflow = (children.get(n.id) || []).filter(child => scopeIds.has(child.id) && child.visible !== false && validBounds(child.bounds) && !contains(n.bounds!, child.bounds))
    if (overflow.length) issue('interaction', 'interaction.clipping', '“' + n.name + '” 裁剪溢出待确认', [n, ...overflow],
      overflow.length + ' 个直接子节点超出边界；clipsContent=true；overflowDirection=' + (n.overflowDirection || 'NONE'),
      '确认裁剪是否符合预期', '可能是装饰或刻意裁剪；在原型中验证内容是否需要滚动访问', 'review',
      '容器 ' + n.id + ' bounds=' + JSON.stringify(n.bounds) + '；超出节点=' + overflow.map(child => child.id).join('、'))
  }

  const topFrames = visible.filter(n => validBounds(n.bounds) && (n.id === normalizeNodeId(options.targetNodeId) ||
    (['FRAME', 'COMPONENT', 'COMPONENT_SET'].includes(n.type) && (!n.parentId || !scopeIds.has(n.parentId) || nodeMap.get(n.parentId)?.type === 'CANVAS'))))
  const issues = categories.flatMap(c => c.issues)
  return {
    issues, categories, frameCount: topFrames.length, textCount: texts.length, totalNodes: nodes.length,
    frameNodeIds: topFrames.map(n => n.id), frames: topFrames.map(n => n.name),
    highlights: [], suggestions: [],
    documentInfo: { name: snapshot.fileName, pageCount: snapshot.pageCount, componentCount: snapshot.componentCount, instanceCount: snapshot.instanceCount },
    dataSnapshot: snapshot, integrityReport: snapshot.integrityReport,
    auditMeta: {
      source: 'figma-rest-api', strategy: 'rule-first-ai-assisted', readOnly: true,
      scope: options.targetNodeId ? 'node' : 'file', targetNodeId: normalizeNodeId(options.targetNodeId),
      targetNodeName: options.targetNodeId ? nodeMap.get(normalizeNodeId(options.targetNodeId)!)?.name : undefined,
      targetFound: true, ruleSetName: effectiveRules.name, rulesSnapshot: effectiveRules,
      fileKey: fileKey || '', fileVersion: typeof apiResponse.version === 'string' ? apiResponse.version : undefined,
      lastModified: typeof apiResponse.lastModified === 'string' ? apiResponse.lastModified : undefined,
      fetchedAt: options.fetchedAt, analyzedAt: new Date().toISOString(), documentHash: options.documentHash,
      hiddenNodeCount: nodes.length - visible.length,
      aiReview: { status: 'pending', findingCount: 0, message: '规则结果不依赖 AI；截图复核只提供待确认建议' },
    },
  }
}

export function getIssuesByCategory(issues: CheckIssue[], category: string): CheckIssue[] {
  const labels: Record<string, string> = { layout: '布局', typography: '字体', color: '色彩', spacing: '间距', effects: '视觉效果', designSystem: '设计系统', interaction: '交互可达性' }
  return issues.filter(i => i.category === labels[category])
}

// 检测规则类型定义

// 布局规则
export interface LayoutRules {
  requireAutoLayout?: boolean         // 是否要求所有容器使用Auto Layout
  autoLayoutMinRate?: number          // Auto Layout最低使用率（百分比，默认50）
  maxAbsoluteInAutoLayout?: number    // Auto Layout容器中允许的绝对定位子节点数（默认0）
  maxLargeFrameWithoutConstraint?: number // 大尺寸容器无约束警告阈值宽度（默认800px）
}

// 排版规则
export interface TypographyRules {
  maxFontFamilies?: number            // 最大字体种类数（默认2）
  maxFontSizes?: number               // 最大字号层级数（默认6）
  maxFontWeights?: number             // 最大字重种类数（默认4）
  minTextSize?: number                // 最小字号px（默认12）
  maxLineHeightRatio?: number         // 最大行高倍数（默认2）
}

// 色彩规则
export interface ColorRules {
  minContrastNormal?: number          // 普通文本最低对比度（默认4.5，WCAG AA）
  minContrastLarge?: number           // 大文本最低对比度（默认3.0，WCAG AA）
  maxColors?: number                  // 最大颜色种类数（默认20）
  warnLowOpacityText?: boolean        // 警告低透明度文本（默认true）
  minTextOpacity?: number             // 文本最低透明度（默认0.4）
}

// 间距规则
export interface SpacingRules {
  spacingGrid?: number                // 间距基准px（默认8，即8px网格系统）
  spacingTolerance?: number           // 间距容差px（默认2，允许±2px偏差）
  minTouchTarget?: number             // 最小触控目标尺寸px（默认44）
  minNonTouchTarget?: number          // 最小非触控元素尺寸px（默认24）
}

// 视觉效果规则
export interface EffectsRules {
  maxShadows?: number                 // 最大阴影数量（默认10）
  maxBlurRadius?: number              // 最大模糊半径px（默认50）
  warnLargeAreaBlur?: boolean         // 警告大面积模糊（默认true）
  largeBlurAreaThreshold?: number     // 大面积模糊警告阈值面积px²（默认50000）
}

// 完整检测规则配置
export interface CheckRules {
  name: string                        // 规则名称
  version?: string                    // 规则版本
  description?: string                // 规则描述
  layout?: LayoutRules
  typography?: TypographyRules
  color?: ColorRules
  spacing?: SpacingRules
  effects?: EffectsRules
}

// 默认规则（系统内置）
export const DEFAULT_RULES: CheckRules = {
  name: 'HMI 设计规范（默认）',
  version: '1.0',
  description: 'HMI智能座舱设计默认规范检查规则',
  layout: {
    requireAutoLayout: false,
    autoLayoutMinRate: 50,
    maxAbsoluteInAutoLayout: 0,
    maxLargeFrameWithoutConstraint: 800,
  },
  typography: {
    maxFontFamilies: 2,
    maxFontSizes: 6,
    maxFontWeights: 4,
    minTextSize: 12,
    maxLineHeightRatio: 2,
  },
  color: {
    minContrastNormal: 4.5,
    minContrastLarge: 3.0,
    maxColors: 20,
    warnLowOpacityText: true,
    minTextOpacity: 0.4,
  },
  spacing: {
    spacingGrid: 8,
    spacingTolerance: 2,
    minTouchTarget: 44,
    minNonTouchTarget: 24,
  },
  effects: {
    maxShadows: 10,
    maxBlurRadius: 50,
    warnLargeAreaBlur: true,
    largeBlurAreaThreshold: 50000,
  },
}

// 规则存储键
const STORAGE_KEY = 'hmi-studio-check-rules'
const ACTIVE_RULE_KEY = 'hmi-studio-active-rule'

// 获取所有已保存的规则
export function getSavedRules(): CheckRules[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      const rules = JSON.parse(data)
      return Array.isArray(rules) ? rules : []
    }
  } catch (e) {
    console.warn('Failed to load check rules:', e)
  }
  return []
}

// 保存规则列表
export function saveRules(rules: CheckRules[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
  } catch (e) {
    console.warn('Failed to save check rules:', e)
  }
}

// 保存单个规则（添加或更新）
export function saveRule(rule: CheckRules) {
  const rules = getSavedRules()
  const idx = rules.findIndex(r => r.name === rule.name)
  if (idx >= 0) {
    rules[idx] = rule
  } else {
    rules.push(rule)
  }
  saveRules(rules)
}

// 删除规则
export function deleteRule(name: string) {
  const rules = getSavedRules().filter(r => r.name !== name)
  saveRules(rules)
  // 如果删除的是当前激活的规则，重置为默认
  const active = getActiveRuleName()
  if (active === name) {
    setActiveRule('')
  }
}

// 获取当前激活的规则名称
export function getActiveRuleName(): string {
  try {
    return localStorage.getItem(ACTIVE_RULE_KEY) || ''
  } catch {
    return ''
  }
}

// 设置激活的规则
export function setActiveRule(name: string) {
  try {
    localStorage.setItem(ACTIVE_RULE_KEY, name)
  } catch (e) {
    console.warn('Failed to set active rule:', e)
  }
}

// 获取当前生效的规则（合并默认规则和自定义规则）
export function getActiveRules(): CheckRules {
  const activeName = getActiveRuleName()
  if (!activeName) {
    return DEFAULT_RULES
  }
  const rules = getSavedRules()
  const custom = rules.find(r => r.name === activeName)
  if (!custom) {
    return DEFAULT_RULES
  }
  // 深度合并默认规则和自定义规则
  return deepMergeRules(DEFAULT_RULES, custom)
}

// 从JSON文件导入规则
export function importRulesFromJSON(jsonStr: string): CheckRules {
  const data = JSON.parse(jsonStr)
  if (!data || typeof data !== 'object') {
    throw new Error('无效的规则文件格式')
  }
  if (!data.name) {
    data.name = `自定义规则 ${new Date().toLocaleString('zh-CN')}`
  }
  // 验证基本结构
  if (data.layout && typeof data.layout !== 'object') throw new Error('layout 规则格式错误')
  if (data.typography && typeof data.typography !== 'object') throw new Error('typography 规则格式错误')
  if (data.color && typeof data.color !== 'object') throw new Error('color 规则格式错误')
  if (data.spacing && typeof data.spacing !== 'object') throw new Error('spacing 规则格式错误')
  if (data.effects && typeof data.effects !== 'object') throw new Error('effects 规则格式错误')
  return data as CheckRules
}

// 导出规则为JSON
export function exportRulesToJSON(rule: CheckRules): string {
  return JSON.stringify(rule, null, 2)
}

// 深度合并规则（自定义规则覆盖默认规则，未指定的字段使用默认值）
function deepMergeRules(base: CheckRules, override: Partial<CheckRules>): CheckRules {
  return {
    name: override.name || base.name,
    version: override.version || base.version,
    description: override.description || base.description,
    layout: { ...base.layout, ...(override.layout || {}) },
    typography: { ...base.typography, ...(override.typography || {}) },
    color: { ...base.color, ...(override.color || {}) },
    spacing: { ...base.spacing, ...(override.spacing || {}) },
    effects: { ...base.effects, ...(override.effects || {}) },
  }
}

// 生成规则模板JSON（供用户下载参考）
export function generateRuleTemplate(): string {
  return JSON.stringify({
    name: '我的设计规范',
    version: '1.0',
    description: '自定义设计规范检查规则',
    layout: {
      requireAutoLayout: false,
      autoLayoutMinRate: 80,
      maxAbsoluteInAutoLayout: 0,
      maxLargeFrameWithoutConstraint: 800,
    },
    typography: {
      maxFontFamilies: 3,
      maxFontSizes: 8,
      maxFontWeights: 5,
      minTextSize: 14,
      maxLineHeightRatio: 1.8,
    },
    color: {
      minContrastNormal: 4.5,
      minContrastLarge: 3.0,
      maxColors: 30,
      warnLowOpacityText: true,
      minTextOpacity: 0.5,
    },
    spacing: {
      spacingGrid: 4,
      spacingTolerance: 1,
      minTouchTarget: 48,
      minNonTouchTarget: 24,
    },
    effects: {
      maxShadows: 5,
      maxBlurRadius: 40,
      warnLargeAreaBlur: true,
      largeBlurAreaThreshold: 40000,
    },
  }, null, 2)
}

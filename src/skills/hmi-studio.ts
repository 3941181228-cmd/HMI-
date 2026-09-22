/**
 * HMI Studio Skill 定义
 * 专门用于生成车载 HMI 页面的 Skill 包。
 * 理解车载场景、屏幕尺寸、设计风格、功能模块与交互逻辑，
 * 输出高保真 HMI 页面效果图的专业生图提示词。
 *
 * Skill 版本: 1.0.0
 * 类型: image-generation / automotive-ui
 */

// ============================================================
// 场景定义 — HMI 页面使用场景（12 种）
// ============================================================

export interface HMIScenario {
  /** 场景标识 */
  id: string
  /** 场景名称（展示用） */
  name: string
  /** 场景描述（写入提示词） */
  description: string
  /** 该场景默认包含的核心组件 */
  defaultComponents: string[]
}

export const HMI_SCENARIOS: HMIScenario[] = [
  {
    id: 'home',
    name: '首页',
    description: '智能座舱首页 / 主桌面',
    defaultComponents: ['导航地图', '车辆状态', '底部Dock', '时间天气'],
  },
  {
    id: 'navigation',
    name: '导航',
    description: '驾驶中的实时导航页面',
    defaultComponents: ['地图主视图', '路线卡片', '剩余里程', '到达时间', '路口引导'],
  },
  {
    id: 'dashboard',
    name: '仪表盘',
    description: '驾驶仪表盘（车速/转速/续航）',
    defaultComponents: ['车速显示', '电池电量', '续航里程', '驾驶模式', '能量流'],
  },
  {
    id: 'assistant',
    name: '智能助手',
    description: 'AI 语音助手交互页面',
    defaultComponents: ['AI助手头像', '对话卡片', '推荐事项', '快捷建议'],
  },
  {
    id: 'vehicle-control',
    name: '车辆控制',
    description: '空调/座椅/灯光等车辆控制中心',
    defaultComponents: ['空调控制', '座椅控制', '灯光控制', '驾驶模式'],
  },
  {
    id: 'energy',
    name: '能源管理',
    description: '充电与能量管理页面',
    defaultComponents: ['电池电量', '充电进度', '能量流', '续航里程'],
  },
  {
    id: 'media',
    name: '娱乐系统',
    description: '音乐/视频媒体娱乐页面',
    defaultComponents: ['专辑封面', '播放器', '波形动效', '音量控制'],
  },
  {
    id: 'settings',
    name: '设置中心',
    description: '系统设置与个性化配置页面',
    defaultComponents: ['设置列表', '账户入口', '系统状态'],
  },
  {
    id: 'hud',
    name: 'HUD',
    description: '抬头显示（风挡投影）界面',
    defaultComponents: ['车速显示', '导航引导', '限速提示'],
  },
  {
    id: 'parking',
    name: '停车场景',
    description: '自动泊车/360 影像页面',
    defaultComponents: ['360环视影像', '泊车进度', '障碍物提示'],
  },
  {
    id: 'charging',
    name: '充电场景',
    description: '充电站地图与充电状态页面',
    defaultComponents: ['充电站地图', '充电进度', '费用信息', '预计完成时间'],
  },
  {
    id: 'driving',
    name: '驾驶中场景',
    description: '驾驶模式下的多信息联动页面',
    defaultComponents: ['导航地图', '车速显示', '媒体卡片', '驾驶模式'],
  },
]

// ============================================================
// 风格预设 — 7 种视觉风格（含英文关键词，供生图模型理解）
// ============================================================

export interface HMIStylePreset {
  /** 风格名称 */
  name: string
  /** 英文视觉关键词（写入提示词，生图模型对英文更敏感） */
  keywords: string[]
  /** 中文风格描述 */
  description: string
}

export const HMI_STYLE_PRESETS: Record<string, HMIStylePreset> = {
  '通用科技风': {
    name: '通用科技风',
    keywords: ['clean', 'dark interface', 'blue accent', 'high-tech', 'realistic HMI'],
    description: '干净深色界面，蓝色高亮，科技感',
  },
  '极简未来风': {
    name: '极简未来风',
    keywords: ['minimalist', 'large whitespace', 'clean hierarchy', 'futuristic', 'premium'],
    description: '大量留白，层级清晰，未来感',
  },
  'HarmonyOS风格': {
    name: 'HarmonyOS风格',
    keywords: ['harmonyos automotive inspired', 'glassmorphism', 'layered cards', 'smart cockpit', 'soft glow'],
    description: '玻璃拟态，层叠卡片，柔和光晕',
  },
  'Tesla风格': {
    name: 'Tesla风格',
    keywords: ['tesla inspired', 'ultra minimal', 'clean cards', 'map centered', 'clear information hierarchy'],
    description: '极简克制，地图主导，信息层级清晰',
  },
  'MBUX豪华风': {
    name: 'MBUX豪华风',
    keywords: ['luxury cockpit', 'ambient light', 'deep black', 'premium metal feel', 'immersive display'],
    description: '豪华座舱，氛围灯，深黑金属质感',
  },
  'BMW科技风': {
    name: 'BMW科技风',
    keywords: ['technical precision', 'geometric layout', 'information density', 'performance feeling'],
    description: '几何分区，精密感，性能取向',
  },
  '深色高级感': {
    name: '深色高级感',
    keywords: ['dark premium', 'restrained lighting', 'refined details', 'futuristic luxury'],
    description: '深色高级，克制用光，细节精致',
  },
}

// ============================================================
// 组件库 — 车载 HMI 常用组件（按类别）
// ============================================================

export const HMI_COMPONENT_LIBRARY: Record<string, string[]> = {
  '导航类': ['地图主视图', '路线卡片', '剩余里程', '到达时间', '路口引导', '实时路况'],
  '车辆类': ['车辆模型', '电池电量', '续航里程', '驾驶模式', '能量流', '轮胎状态', '空调状态'],
  '媒体类': ['专辑封面', '播放器', '波形动效', '音量控制', '语音入口'],
  '助手类': ['AI助手头像', '对话卡片', '推荐事项', '快捷建议'],
  '系统类': ['顶部状态栏', '底部Dock', '时间天气', '账户入口', '设置入口'],
}

// ============================================================
// 快捷提示词 — HMI 页面级预设（点击填入输入框并联动场景）
// ============================================================

export interface HMIQuickPrompt {
  /** 按钮展示文本 */
  label: string
  /** 填入输入框的完整用户需求 */
  request: string
  /** 联动切换的场景 ID */
  scenario: string
}

export const HMI_QUICK_PROMPTS: HMIQuickPrompt[] = [
  {
    label: '智能座舱首页',
    request: '生成一个新能源汽车智能座舱首页 HMI 页面。必须是中控车机首页，而不是手机界面。页面包含导航地图预览、车辆状态信息、电池电量、剩余续航、音乐卡片、天气时间、AI 助手入口和底部快捷 Dock。整体采用深色未来科技风格，画面干净克制，信息层级清晰，布局符合驾驶中快速查看需求，具备真实量产感和高保真车机 UI 质感。',
    scenario: 'home',
  },
  {
    label: '实时导航页',
    request: '生成一个驾驶中的导航 HMI 页面。必须是车机导航界面，地图为核心主体，包含实时路线、高亮导航路径、下一路口转向提示、预计到达时间、剩余距离、实时路况和底部快捷功能栏。整体界面需要清晰、安全、易读，强调驾驶场景下的信息优先级，采用深色高级感和高精度地图视觉，不要做成普通地图 App。',
    scenario: 'navigation',
  },
  {
    label: '数字仪表盘',
    request: '生成一个数字仪表盘 HMI 页面。页面应展示当前车速、电量或油量、续航、挡位、驾驶模式、ADAS 状态、导航简要提示和报警信息。整体布局偏驾驶信息优先，风格精确、科技、克制，具备真实量产车仪表设计语言，不能像手机数据面板，需突出安全感、实时反馈和高可读性。',
    scenario: 'dashboard',
  },
  {
    label: '车辆控制中心',
    request: '生成一个车辆控制中心 HMI 页面。页面包含空调控制、座椅加热/通风、氛围灯、车门车窗、后备箱、天窗和驾驶模式切换。布局需要清晰分区，操作区域明确，适合车机触控交互。整体采用深色高级感风格，具有真实智能座舱控制页质感，强调玻璃面板、柔和光效和高端科技感。',
    scenario: 'vehicle-control',
  },
  {
    label: '能源管理页',
    request: '生成一个新能源汽车能源管理 HMI 页面。页面需包含电池状态、当前电量、剩余续航、能耗趋势、能量流动、充电建议、历史能耗数据和驾驶效率分析。整体设计必须专业、清晰、有科技感，采用适合新能源车的未来风格，具备真实车机图表和可视化逻辑，而不是普通数据看板。',
    scenario: 'energy',
  },
  {
    label: '充电场景页',
    request: '生成一个新能源车充电场景 HMI 页面。页面需展示当前充电状态、充电功率、剩余充电时间、电池百分比、预计满电时间、附近充电站信息和舒适化等待功能入口。整体风格安静、未来、高级，强调新能源品牌感与清晰的信息表达，符合真实车内等待充电时的交互场景。',
    scenario: 'charging',
  },
  {
    label: '媒体娱乐页',
    request: '生成一个车载娱乐媒体 HMI 页面。页面包含音乐播放器、专辑封面、播放控制、歌词或波形动效、推荐内容、音量调节和语音入口。整体设计需具备沉浸感与品质感，但不能过于花哨，必须保留车机使用逻辑。采用深色 OLED 屏幕风格，细腻光效和适度动态氛围，呈现高保真智能座舱娱乐体验。',
    scenario: 'media',
  },
  {
    label: 'AI 助手页',
    request: '生成一个智能座舱 AI 助手 HMI 页面。页面包含 AI 助手主卡片、语音输入状态、推荐操作、场景建议、最近任务和快捷执行按钮。界面要体现未来智能座舱感，强调拟人化但克制的 AI 交互体验，整体布局清晰、层级明确，具备真实车机 AI 助手页面气质，而不是普通聊天窗口。',
    scenario: 'assistant',
  },
  {
    label: '设置中心',
    request: '生成一个智能座舱设置中心 HMI 页面。页面包含账户信息、显示设置、声音设置、驾驶辅助设置、网络连接、隐私权限和系统更新等模块。整体设计应清晰有序、逻辑明确、层级分明，采用高级简洁的车机设置页风格，避免手机设置页既视感。',
    scenario: 'settings',
  },
  {
    label: '泊车辅助页',
    request: '生成一个泊车辅助 HMI 页面。页面包含 360° 全景影像、车辆俯视图、障碍物提醒、泊车轨迹线、自动泊车状态和周边环境感知信息。整体布局需强调安全、清晰、直观，具备真实量产泊车交互体验，体现高端智能辅助驾驶界面风格。',
    scenario: 'parking',
  },
  {
    label: '副驾娱乐屏',
    request: '生成一个副驾娱乐屏 HMI 页面。页面包含影音娱乐、音乐推荐、座椅控制、氛围功能和个性化内容卡片。整体设计更具沉浸感和观赏性，但仍保持与主驾系统统一的智能座舱视觉语言，体现多屏联动和高端座舱体验。',
    scenario: 'media',
  },
]

// ============================================================
// 视觉规则 — 全局视觉基线（来自 skill 的 visual_rules）
// ============================================================

export const HMI_VISUAL_RULES = {
  background: '#050505',
  textPrimary: '#FFFFFF',
  textSecondary: '#B8B8B8',
  accentDefault: '#017BFF',
  styleKeywords: [
    'OLED display',
    'premium automotive UI',
    'glass material',
    'soft lighting',
    'depth layers',
    'futuristic but realistic',
  ],
}

// ============================================================
// 提示词构建 — 按 skill 的 generate_image 模板生成专业提示词
// ============================================================

export interface BuildHMIPromptOptions {
  /** 用户自然语言需求（可空，空时使用场景默认描述） */
  request?: string
  /** 场景 ID（HMI_SCENARIOS 之一） */
  scenario: string
  /** 风格名称（HMI_STYLE_PRESETS 之一） */
  style: string
  /** 勾选的核心组件列表 */
  components: string[]
  /** 输出像素尺寸，如 "2560x1440" */
  screenSize?: string
  /** 是否为参考图模式（图生图时附加参考说明） */
  referenceMode?: boolean
}

/**
 * 构建专业 HMI 生图提示词
 * 遵循 skill 定义的推理链路：
 * 用户需求 → 使用场景 → 信息优先级 → 功能组件 → 页面布局 → 视觉风格 → 提示词
 */
export function buildHMIPrompt(options: BuildHMIPromptOptions): string {
  const { request, scenario, style, components, screenSize, referenceMode } = options

  const scenarioDef = HMI_SCENARIOS.find(s => s.id === scenario) ?? HMI_SCENARIOS[0]
  const styleDef = HMI_STYLE_PRESETS[style] ?? HMI_STYLE_PRESETS['通用科技风']

  // 合并组件：用户勾选优先，无勾选时使用场景默认组件
  const finalComponents = components.length > 0
    ? components
    : scenarioDef.defaultComponents

  const lines: string[] = []

  lines.push('生成一个专业的汽车 HMI 车机页面效果图。')
  lines.push('')
  lines.push(`页面类型：${scenarioDef.name}（${scenarioDef.description}）`)
  if (request?.trim()) {
    lines.push(`用户需求：${request.trim()}`)
  }
  if (screenSize) {
    lines.push(`屏幕尺寸：${screenSize}`)
  }
  lines.push(`视觉风格：${styleDef.name}（${styleDef.description}）`)
  lines.push('品牌气质：新能源科技感 · 主题模式：dark')
  lines.push('')
  lines.push('页面需包含以下核心组件：')
  finalComponents.forEach(c => lines.push(`- ${c}`))
  lines.push('')
  lines.push('设计要求：')
  lines.push('- 必须是车载 HMI 界面，真实量产感，工业设计感')
  lines.push('- 必须有清晰的信息层级，核心驾驶信息优先级最高')
  lines.push('- 必须符合驾驶场景与车机交互逻辑，常用功能位于底部 Dock 或侧边快捷区')
  lines.push('- 保持足够留白与清晰分区，点击热区符合车机操作习惯')
  lines.push('- OLED 屏幕质感、深色界面（#050505 背景）、白色主文字、局部蓝色高亮（#017BFF）、适度景深与玻璃层次')
  lines.push('- 关键数值信息字号明显大于辅助信息，驾驶中信息不可被娱乐信息干扰')
  lines.push('- 页面结构不能像手机 App 或普通网页，不能是卡片堆砌')
  lines.push('')
  lines.push(`风格关键词：${styleDef.keywords.join(', ')}`)
  lines.push(`视觉关键词：${HMI_VISUAL_RULES.styleKeywords.join(', ')}`)
  if (referenceMode) {
    lines.push('')
    lines.push('参考图说明：参考所提供图片的布局结构、色彩系统与设计语言，生成符合上述要求的新 HMI 页面。')
  }
  lines.push('')
  lines.push('输出为高保真 HMI 设计效果图。')

  return lines.join('\n')
}

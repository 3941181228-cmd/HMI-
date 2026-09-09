import VectorTracePanel from './VectorTracePanel'
import { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import JSZip from 'jszip'
import { useAuth } from '@/contexts/AuthContext'
import {
  Sparkles,
  Palette,
  Image as ImageIcon,
  Download,
  Wand2,
  Layers,
  Upload,
  X,
  ImagePlus,
  Maximize2,
  Settings2,
  AlertCircle,
  FileText,
  Loader2,
  Plus,
  Trash2,
  FileCode,
  FileIcon,
  Layout,
  CheckCircle2,
  Zap,
  Monitor,
  ChevronDown,
  ArrowRightLeft,
  Component,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react'

const HMIPreview = lazy(() => import('./HMIPreview'))
const CreationDashboard = lazy(() => import('./CreationDashboard'))
const CheckPage = lazy(() => import('./CheckPage'))
const ThemeSwapPanel = lazy(() => import('./ThemeSwapPanel'))
const Tripo3DPanel = lazy(() => import('./Tripo3DPanel'))

import { Button } from './ui/button'
import CheckBadge, { checkItemsByCategory } from './CheckBadge'
import { generateWithPoll, checkLoginStatus } from '@/services/jimeng'
import { themes, getThemeById } from '@/data/themeData'
import { getProxyImageUrl } from '@/utils/imageProxy'
import type { HMITheme } from '@/data/themeData'
import { animeWallpapers, animeTags, natureWallpapers, natureTags, abstractWallpapers, abstractTags, cityWallpapers, cityTags, vehicleWallpapers, vehicleTags, animalWallpapers, animalTags, wallpaperCategories } from '@/data/wallpaperData'
import { getStoredFigmaToken, getStoredOpenAIKey } from '@/services/apiStorage'
import { fetchFigmaImageAsBlob, getProxiedFigmaImageUrl } from '@/services/figmaImageProxy'
import {
  checkAndVerifyImage, adjustImageToSize,
  type CheckAndVerifyResult, type PresetSize,
} from '@/services/imageSizeChecker'
import { useSystemSettings } from '@/contexts/SystemSettingsContext'
import { FigmaImage } from './FigmaImage'
import {
  processAIResult,
  downloadSVGComponent,
  downloadAllSVGComponents,
  getCategoryColor,
  copySVGCode,
  type SVGComponent,
  type CanvasInfo,
  type SVGGenerationResult,
} from '@/services/svgComponentGenerator'

type TabId = 'dashboard' | 'preview' | 'generate' | 'edit' | 'theme' | 'check' | 'export' | 'wallpaper' | 'ai-wallpaper' | '3d-model'

interface EditRegion {
  name?: string
  texts?: Array<{ type: string; content: string; description?: string }>
}

interface TextExtractResult {
  regions?: EditRegion[]
  summary?: string
}

interface EditSVGResult extends SVGGenerationResult {}

type EditResultType = TextExtractResult | EditSVGResult

const FRAME_PRESETS: Record<string, string[]> = {
  'SK85国内热区划定': [
    'A-1 首页-主界面',
    'A-2 首页-快捷入口',
    'B-1 收音机界面',
    'B-2 收音机-频道列表',
    'C-1 地图导航',
    'C-2 导航-路线规划',
    'D-1 热区划定',
    'D-2 热区划定-区域选择',
    'E-1 设置页',
    'E-2 设置-系统设置',
  ],
  '充电仪表盘': [
    'A-1 充电仪表盘',
    'A-2 电池状态',
    'B-1 导航界面',
    'B-2 导航-路线规划',
    'C-1 空调控制',
    'C-2 空调-温度调节',
    'D-1 媒体中心',
    'D-2 媒体-音乐播放',
    'E-1 ADAS 视图',
    'E-2 ADAS-驾驶辅助',
    'F-1 设置面板',
    'F-2 设置-系统配置',
  ],
  'HMI 仪表盘': [
    'A-1 仪表盘首页',
    'A-2 仪表盘-快捷入口',
    'B-1 地图视图',
    'B-2 地图-位置搜索',
    'C-1 车辆状态',
    'C-2 车辆-能量流',
    'D-1 设置',
    'D-2 设置-偏好',
    'E-1 媒体中心',
    'E-2 媒体-音乐播放',
  ],
}

const DEFAULT_FRAMES = [
  'A-1 仪表盘首页',
  'A-2 仪表盘-快捷入口',
  'B-1 地图视图',
  'B-2 地图-位置搜索',
  'C-1 车辆状态',
  'C-2 车辆-能量流',
  'D-1 设置',
  'D-2 设置-偏好',
  'E-1 媒体中心',
  'E-2 媒体-音乐播放',
]

interface SizePreset {
  ratio: string
  resolutions: string[]
  icon: string
}

const SIZE_PRESETS: SizePreset[] = [
  { ratio: '1:1', resolutions: ['1024×1024', '2048×2048'], icon: '⬜' },
  { ratio: '4:3', resolutions: ['1440×1080', '1920×1440'], icon: '▭' },
  { ratio: '16:9', resolutions: ['1920×1080', '2560×1440', '3840×2160'], icon: '▬' },
  { ratio: '21:9', resolutions: ['2560×1080', '3440×1440'], icon: '━' },
  { ratio: '3:4', resolutions: ['1080×1440', '1440×1920'], icon: '▯' },
  { ratio: '9:16', resolutions: ['1080×1920', '1440×2560'], icon: '▮' },
]

interface WorkspaceProps {
  activeTab?: TabId
  activeSection?: string
  onTabChange?: (tab: TabId) => void
  onAddHistory?: (prompt: string, images: string[], category?: 'hmi' | 'wallpaper' | 'theme' | 'other') => void
  onDeleteRecords?: (ids: string[]) => void
  editSubModeProp?: 'png2svg' | 'text_extract'
  themePresetProp?: string | null
  wallpaperSubProp?: string | null
  onNavigate?: (target: string) => void
  historyRecords?: import('@/hooks/useHistory').HistoryRecord[]
}

export default function Workspace({ activeTab = 'dashboard', activeSection = 'full', onTabChange, onAddHistory, onDeleteRecords, editSubModeProp, themePresetProp, wallpaperSubProp, onNavigate, historyRecords = [] }: WorkspaceProps) {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()
  const { notify } = useSystemSettings()
  const [promptInput, setPromptInput] = useState('')

  const [isGenerating, setIsGenerating] = useState(false)
  const [refImage, setRefImage] = useState<string | null>(null)
  const [refImageName, setRefImageName] = useState('')
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [genError, setGenError] = useState<string | null>(null)
  // AI 生成尺寸校验结果（key 为原始图片 URL）
  const [sizeVerifyResults, setSizeVerifyResults] = useState<Record<string, CheckAndVerifyResult | undefined>>({})
  const [isVerifyingSize, setIsVerifyingSize] = useState(false)
  const [wallpaperPrompt, setWallpaperPrompt] = useState('')
  const [wallpaperGenerating, setWallpaperGenerating] = useState(false)
  const [wallpaperResults, setWallpaperResults] = useState<string[]>([])
  const [wallpaperError, setWallpaperError] = useState<string | null>(null)

  // 即梦 Seedream API 支持的精确尺寸（2K 档位，平衡清晰度与速度）
  // 传给 API 的 size 必须是这些值之一，否则 API 会忽略并回退默认
  const JIMENG_SUPPORTED_SIZES: Record<string, { w: number; h: number; apiSize: string }> = {
    '1:1':  { w: 2048, h: 2048, apiSize: '2048x2048' },
    '16:9': { w: 2560, h: 1440, apiSize: '2560x1440' },
    '9:16': { w: 1440, h: 2560, apiSize: '1440x2560' },
    '4:3':  { w: 2304, h: 1728, apiSize: '2304x1728' },
    '3:4':  { w: 1728, h: 2304, apiSize: '1728x2304' },
    '3:2':  { w: 2496, h: 1664, apiSize: '2496x1664' },
    '2:3':  { w: 1664, h: 2496, apiSize: '1664x2496' },
    '21:9': { w: 3024, h: 1296, apiSize: '3024x1296' },
  }

  // 根据当前尺寸选择器状态构造 PresetSize（用于 API 请求和校验）
  // 关键：传给即梦 API 的必须是官方支持的精确像素值，否则会被忽略
  const buildPresetSizeFromSelection = (): PresetSize => {
    if (genCustomSize) {
      // 自定义尺寸：直接用用户输入的值（注意：非 API 推荐值可能被 API 忽略）
      const orientation = genCustomWidth > genCustomHeight ? 'landscape' : genCustomWidth < genCustomHeight ? 'portrait' : 'square'
      return {
        id: 'custom',
        label: '自定义',
        ratio: `${genCustomWidth}:${genCustomHeight}`,
        apiSize: `${genCustomWidth}x${genCustomHeight}`,
        width: genCustomWidth,
        height: genCustomHeight,
        orientation,
      }
    }
    // 预设比例：映射到即梦 API 支持的精确尺寸（2K 档位）
    // 忽略用户选的具体分辨率（如 1920×1080），统一用 API 推荐值
    const supported = JIMENG_SUPPORTED_SIZES[genRatio]
    if (supported) {
      const orientation = supported.w > supported.h ? 'landscape' : supported.w < supported.h ? 'portrait' : 'square'
      return {
        id: genRatio,
        label: genRatio,
        ratio: genRatio,
        apiSize: supported.apiSize,
        width: supported.w,
        height: supported.h,
        orientation,
      }
    }
    // 兜底：解析 "1920×1080" → "1920x1080"（可能不被 API 支持）
    const [w, h] = genResolution.replace('×', 'x').split('x').map(Number)
    const orientation = w > h ? 'landscape' : w < h ? 'portrait' : 'square'
    return {
      id: genRatio,
      label: genRatio,
      ratio: genRatio,
      apiSize: `${w}x${h}`,
      width: w,
      height: h,
      orientation,
    }
  }
  const [wallpaperRes, setWallpaperRes] = useState('1920×1080')
  const WALLPAPER_RESOLUTIONS = [
    { label: '1920×1080 (Full HD)', w: 1920, h: 1080, ratio: '16:9' },
    { label: '2560×1440 (2K)', w: 2560, h: 1440, ratio: '16:9' },
    { label: '3840×2160 (4K)', w: 3840, h: 2160, ratio: '16:9' },
    { label: '1080×1920 (手机)', w: 1080, h: 1920, ratio: '9:16' },
    { label: '5120×1440 (超宽)', w: 5120, h: 1440, ratio: '32:9' },
  ]
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [engine, setEngine] = useState<'jimeng' | 'openai'>('jimeng')
  const [genRatio, setGenRatio] = useState<string>('16:9')
  const [genResolution, setGenResolution] = useState<string>('1920×1080')
  const [genCustomSize, setGenCustomSize] = useState(false)
  const [genCustomWidth, setGenCustomWidth] = useState(1920)
  const [genCustomHeight, setGenCustomHeight] = useState(1080)
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false)
  const [editWorkflow, setEditWorkflow] = useState<'trace' | 'ai'>('trace')
  const [editSubMode, setEditSubMode] = useState<'png2svg' | 'text_extract'>('png2svg')
  const [editImage, setEditImage] = useState<string | null>(null)
  const [editImageName, setEditImageName] = useState('')
  const [editAnalyzing, setEditAnalyzing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editResult, setEditResult] = useState<EditResultType | null>(null)
  const editFileRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Export state
  const [exportQueue, setExportQueue] = useState<{ id: string; type: string; status: 'waiting' | 'processing' | 'completed' | 'failed'; progress: number; filename: string; size?: string; frameName?: string }[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [exportComplete, setExportComplete] = useState(false)
  const [completedExport, setCompletedExport] = useState<{ type: string; filename: string; size: string; resolution?: string } | null>(null)

  // PNG 导出默认配置（固定：2x 分辨率、PNG 无损、保留透明度）
  const PNG_EXPORT_DEFAULTS = {
    scale: 2 as const,
    quality: 'lossless' as const,
    outputFormat: 'png' as const,
    keepTransparency: true,
  }
  // 整体进度（用于显示当前导出第几张、当前帧名）
  const [exportOverallProgress, setExportOverallProgress] = useState<{ current: number; total: number; currentFrame?: string; phase: 'idle' | 'fetching' | 'encoding' | 'zipping' | 'saving' | 'done' } | null>(null)
  // 导出错误提示
  const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(null)
  
  const FIGMA_API_BASE_URL = '/api/figma'  // 通过 Vite 代理访问 Figma API

  // Figma import state
  const [figmaUrl, setFigmaUrl] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [figmaConnected, setFigmaConnected] = useState(false)
  const [figmaFileInfo, setFigmaFileInfo] = useState<{ name: string; page: string; lastModified: string; fileKey: string } | null>(null)
  const [figmaFrames, setFigmaFrames] = useState<string[]>([])
  const [selectedFrames, setSelectedFrames] = useState<string[]>([])
  const [analyzingStep, setAnalyzingStep] = useState<number>(0)
  const [analyzingStatus, setAnalyzingStatus] = useState<string>('')
  const [framePreviews, setFramePreviews] = useState<Record<string, string>>({})
  const [frameNodeIds, setFrameNodeIds] = useState<Record<string, string>>({})
  // Figma切图资源状态
  const [figmaPreviewMode, setFigmaPreviewMode] = useState<'frames' | 'assets'>('frames')
  const [figmaExportAssets, setFigmaExportAssets] = useState<Array<{ id: string; name: string; url: string; format: string }>>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  // 预览图加载状态跟踪
  const [previewsLoading, setPreviewsLoading] = useState(false)
  const [previewErrors, setPreviewErrors] = useState<Record<string, boolean>>({})
  // 切图加载状态跟踪
  const [assetErrors, setAssetErrors] = useState<Record<string, boolean>>({})
  
  // Parse Figma URL to extract file key and generate frames
  const parseFigmaUrl = (url: string): { fileKey: string | null; fileName: string; frames: string[] } => {
    const match = url.match(/figma\.com\/design\/([a-zA-Z0-9]+)/)
    const fileKey = match ? match[1] : null
    const urlParts = url.split('/')
    const fileName = urlParts.pop()?.replace(/-/g, ' ') || 'HMI Dashboard'
    
    if (FRAME_PRESETS[fileName]) {
      return { fileKey, fileName, frames: FRAME_PRESETS[fileName] }
    }
    
    const frames: string[] = []
    const lowerFileName = fileName.toLowerCase()
    
    if (lowerFileName.includes('热区') || lowerFileName.includes('zone')) {
      frames.push('D-1 热区划定', 'D-2 热区划定-区域选择', 'D-3 热区划定-热力图')
    }
    if (lowerFileName.includes('导航') || lowerFileName.includes('nav')) {
      frames.push('C-1 地图导航', 'C-2 导航-路线规划', 'C-3 导航-实时导航')
    }
    if (lowerFileName.includes('充电') || lowerFileName.includes('charging')) {
      frames.push('A-1 充电仪表盘', 'A-2 电池状态', 'A-3 充电进度')
    }
    if (lowerFileName.includes('地图') || lowerFileName.includes('map')) {
      frames.push('B-1 地图页', 'B-2 Map View', 'B-3 Map-Location')
    }
    if (lowerFileName.includes('首页') || lowerFileName.includes('home')) {
      frames.push('A-1 首页', 'A-2 Dashboard Home', 'A-3 Home Screen')
    }
    if (lowerFileName.includes('设置') || lowerFileName.includes('setting')) {
      frames.push('E-1 设置页', 'E-2 Settings Panel', 'E-3 Settings-Configuration')
    }
    if (lowerFileName.includes('媒体') || lowerFileName.includes('media')) {
      frames.push('D-1 Media Center', 'D-2 音乐播放', 'D-3 视频播放')
    }
    if (lowerFileName.includes('空调') || lowerFileName.includes('climate')) {
      frames.push('C-1 Climate Control', 'C-2 温度调节', 'C-3 空调设置')
    }
    if (lowerFileName.includes('收音机') || lowerFileName.includes('radio')) {
      frames.push('B-1 收音机界面', 'B-2 收音机-频道列表', 'B-3 收音机-收藏')
    }
    if (lowerFileName.includes('usb') || lowerFileName.includes('music')) {
      frames.push('F-9 USB音乐-一级列表（按文件夹显示）', 'F-10 USB音乐-播放状态', 'F-11 USB音乐-文件夹播放状态')
    }
    
    return { fileKey, fileName, frames: frames.length > 0 ? frames : DEFAULT_FRAMES }
  }
  
  const connectFigma = async () => {
    if (!figmaUrl.trim()) return
    
    // 每次调用时重新获取最新的token
    const currentToken = getStoredFigmaToken()
    
    setIsConnecting(true)
    setAnalyzingStep(0)
    setAnalyzingStatus('读取文件...')
    // 重置切图状态
    setFigmaExportAssets([])
    setAssetsLoading(false)
    setAssetErrors({})
    setFigmaPreviewMode('frames')
    
    // Step 1: Parse Figma URL
    const { fileKey, fileName } = parseFigmaUrl(figmaUrl)
    
    if (!fileKey) {
      setIsConnecting(false)
      alert('无效的 Figma URL')
      return
    }
    
    // 移除模拟延迟，直接进入下一步
    setAnalyzingStep(1)
    setAnalyzingStatus('识别画框...')
    
    try {
      // Step 2: Call Figma API to get file data
      const response = await fetch(`${FIGMA_API_BASE_URL}/files/${fileKey}`, {
        headers: {
          'X-Figma-Token': currentToken
        }
      })
      
      if (!response.ok) {
        throw new Error(`Figma API error: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Step 3: Extract Top Level Frames (only outermost frames, no nested frames)
      // 以 nodeId 为唯一标识，同名 Frame 自动加序号 (2)、(3) ...
      const frames: string[] = []
      const nodeIds: Record<string, string> = {}
      const nameCount: Record<string, number> = {}  // 记录每个原始名出现的次数

      // Only find top-level frames (direct children of CANVAS), don't recurse into frames
      for (const page of data.document.children) {
        if (page.type === 'CANVAS' && page.children) {
          for (const node of page.children) {
            if (node.type === 'FRAME') {
              const realName = node.name || '未命名 Frame'
              // 同名 Frame 加序号区分，确保唯一
              nameCount[realName] = (nameCount[realName] || 0) + 1
              const displayName = nameCount[realName] > 1
                ? `${realName} (${nameCount[realName]})`
                : realName
              frames.push(displayName)
              nodeIds[displayName] = node.id  // displayName 唯一，不会覆盖
            }
          }
        }
      }
      
      // 递归查找所有带有PNG导出设置的节点（切图）
      const findExportableNodes = (node: any, parentPath: string = ''): Array<{ id: string; name: string; format: string }> => {
        const results: Array<{ id: string; name: string; format: string }> = []
        const currentPath = parentPath ? `${parentPath}/${node.name || '未命名'}` : (node.name || '未命名')
        
        if (node.exportSettings && Array.isArray(node.exportSettings)) {
          const pngSetting = node.exportSettings.find((s: any) => s.format === 'PNG')
          if (pngSetting) {
            results.push({
              id: node.id,
              name: currentPath,
              format: 'PNG'
            })
          }
          // 也支持SVG格式
          const svgSetting = node.exportSettings.find((s: any) => s.format === 'SVG')
          if (svgSetting) {
            results.push({
              id: node.id,
              name: currentPath,
              format: 'SVG'
            })
          }
        }
        
        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) {
            results.push(...findExportableNodes(child, currentPath))
          }
        }
        
        return results
      }
      
      // 识别所有切图节点
      const exportableNodes: Array<{ id: string; name: string; format: string }> = []
      for (const page of data.document.children) {
        if (page.type === 'CANVAS') {
          exportableNodes.push(...findExportableNodes(page))
        }
      }
      
      // 移除模拟延迟，直接进入下一步
      setAnalyzingStep(2)
      setAnalyzingStatus('构建导出队列...')
      
      // Step 4: Set file info immediately
      setFigmaFileInfo({
        name: data.name || `${fileName}.fig`,
        page: '主页面',
        lastModified: data.lastModified ? new Date(data.lastModified).toLocaleDateString('zh-CN') : new Date().toLocaleDateString('zh-CN'),
        fileKey: fileKey,
      })
      
      // Set detected frames
      setFigmaFrames(frames.length > 0 ? frames : FRAME_PRESETS[fileName] || DEFAULT_FRAMES)
      setFrameNodeIds(frames.length > 0 ? nodeIds : {})
      
      // Select all frames by default (with dedupe)
      setSelectedFrames([...new Set(frames.length > 0 ? frames : (FRAME_PRESETS[fileName] || DEFAULT_FRAMES))])
      
      // 移除模拟延迟
      setAnalyzingStep(3)
      setAnalyzingStatus('准备导出')
      
      // 立即完成连接，预览图在后台异步加载
      setFigmaConnected(true)
      setIsConnecting(false)
      setAnalyzingStep(-1)
      setAnalyzingStatus('')
      
      // 异步加载预览图（不在连接流程中等待）
      if (frames.length > 0) {
        loadFramePreviewsAsync(fileKey, frames, nodeIds)
      }
      
      // 延迟加载切图，避免与预览图同时加载导致网络拥堵
      if (exportableNodes.length > 0 && exportableNodes.length <= 200) {
        setTimeout(() => loadExportAssetsAsync(fileKey, exportableNodes), 2000)
      }
      
    } catch (error) {
      console.error('Figma API error:', error)
      // API失败时不生成静态死图，显示错误状态
      const { frames } = parseFigmaUrl(figmaUrl)
      setFigmaFrames(frames.length > 0 ? frames : DEFAULT_FRAMES)
      setSelectedFrames([...new Set(frames.length > 0 ? frames : DEFAULT_FRAMES)])
      setFigmaFileInfo({
        name: `${fileName}.fig`,
        page: '主页面',
        lastModified: new Date().toLocaleDateString('zh-CN'),
        fileKey: fileKey || 'unknown',
      })
      setFigmaConnected(true)
      setIsConnecting(false)
      setAnalyzingStep(-1)
      setAnalyzingStatus('')
      // 不生成静态预览图，framePreviews保持为空，UI会显示加载/错误状态
    }
  }
  
  // 异步加载预览图（渐进式加载，逐帧更新）
  const loadFramePreviewsAsync = async (fileKey: string, frames: string[], nodeIds: Record<string, string>) => {
    const token = getStoredFigmaToken()

    // 前置诊断：检查 nodeIds 是否完整
    const missingNodeIds = frames.filter(f => !nodeIds[f])
    if (missingNodeIds.length > 0) {
      console.error('预览加载失败：以下 Frame 缺少 nodeId（可能数据未完整加载）:', missingNodeIds)
    }

    console.log('开始加载预览图:', { fileKey, frameCount: frames.length })

    setPreviewsLoading(true)
    setPreviewErrors({})
    const batchSize = 5  // 小批量加载，快速显示前几张

    for (let i = 0; i < frames.length; i += batchSize) {
      const batchFrames = frames.slice(i, i + batchSize)
      // 过滤掉没有 nodeId 的 Frame，避免把 undefined 拼到 URL 中
      const validFrames = batchFrames.filter(f => nodeIds[f])
      if (validFrames.length === 0) {
        console.warn(`批次 ${i}-${i + batchSize} 全部缺少 nodeId，跳过`)
        batchFrames.forEach(f => setPreviewErrors(prev => ({ ...prev, [f]: true })))
        continue
      }
      const nodeIdList = validFrames.map(f => nodeIds[f]).join(',')

      try {
        // scale=1 预览足够清晰，生成速度快3-5倍
        const apiUrl = `${FIGMA_API_BASE_URL}/images/${fileKey}?ids=${nodeIdList}&format=png&scale=1`
        console.log(`预览图请求 [批次 ${i / batchSize + 1}]:`, apiUrl)
        const imageResponse = await fetch(apiUrl, {
          headers: {
            'X-Figma-Token': token
          }
        })

        if (imageResponse.ok) {
          const imageData = await imageResponse.json()
          console.log(`Figma 返回的图片数据 [批次 ${i / batchSize + 1}]:`, imageData)
          // 逐帧更新UI，用户能立即看到已加载的预览
          for (const frameName of batchFrames) {
            const nodeId = nodeIds[frameName]
            if (!nodeId) {
              console.warn(`Frame "${frameName}" 缺少 nodeId，跳过`)
              setPreviewErrors(prev => ({ ...prev, [frameName]: true }))
              continue
            }
            const rawUrl = imageData.images?.[nodeId]
            if (rawUrl && rawUrl !== 'null') {
              console.log(`Frame "${frameName}" 预览图 URL:`, rawUrl.slice(0, 80) + '...')
              // 存储原始S3 URL，由FigmaImage组件处理代理
              setFramePreviews(prev => ({ ...prev, [frameName]: rawUrl }))
            } else {
              console.warn(`Frame "${frameName}" 的图片 URL 为空，Figma 返回:`, imageData)
              setPreviewErrors(prev => ({ ...prev, [frameName]: true }))
            }
          }
        } else {
          const errText = await imageResponse.text().catch(() => '')
          console.error(`Figma API返回错误: HTTP ${imageResponse.status}`, errText)
          batchFrames.forEach(f => setPreviewErrors(prev => ({ ...prev, [f]: true })))
        }
      } catch (error) {
        console.error(`预览图加载异常 [批次 ${i / batchSize + 1}]:`, error)
        batchFrames.forEach(f => setPreviewErrors(prev => ({ ...prev, [f]: true })))
      }
    }
    setPreviewsLoading(false)
    console.log('预览图加载完成')
  }
  
  // 异步加载切图URL
  const loadExportAssetsAsync = async (fileKey: string, exportNodes: Array<{ id: string; name: string; format: string }>) => {
    setAssetsLoading(true)
    const token = getStoredFigmaToken()
    
    const assets: Array<{ id: string; name: string; url: string; format: string }> = []
    const batchSize = 50
    
    // 按格式分组处理
    const pngNodes = exportNodes.filter(n => n.format === 'PNG')
    const svgNodes = exportNodes.filter(n => n.format === 'SVG')
    
    const loadBatch = async (nodes: Array<{ id: string; name: string; format: string }>, format: string, scale: number = 2) => {
      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize)
        const nodeIdList = batch.map(n => n.id).join(',')
        
        try {
          const imageResponse = await fetch(`${FIGMA_API_BASE_URL}/images/${fileKey}?ids=${nodeIdList}&format=${format.toLowerCase()}&scale=${scale}`, {
            headers: {
              'X-Figma-Token': token
            }
          })
          
          if (imageResponse.ok) {
            const imageData = await imageResponse.json()
            for (const node of batch) {
              const imageUrl = imageData.images?.[node.id]
              if (imageUrl && imageUrl !== 'null') {
                assets.push({
                  id: node.id,
                  name: node.name,
                  url: imageUrl,
                  format: node.format
                })
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch ${format} assets:`, error)
        }
      }
    }
    
    await loadBatch(pngNodes, 'PNG', 2)
    await loadBatch(svgNodes, 'SVG', 1)
    
    setFigmaExportAssets(assets)
    setAssetsLoading(false)
    console.log(`Successfully loaded ${assets.length}/${exportNodes.length} export assets`)
  }
  
  // Generate default frames when API is not available
  const generateFramePreview = (frameName: string): string => {
    const canvas = document.createElement('canvas')
    canvas.width = 1920
    canvas.height = 1080
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return ''
    
    // Background gradient based on frame name
    const gradients = [
      ['#1a1a2e', '#16213e'],
      ['#0f3460', '#16213e'],
      ['#533483', '#16213e'],
      ['#e94560', '#16213e'],
      ['#0f4c75', '#16213e'],
    ]
    const gradientIndex = frameName.charCodeAt(0) % gradients.length
    const [color1, color2] = gradients[gradientIndex]
    
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, color1)
    gradient.addColorStop(1, color2)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Draw frame name
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 48px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Split frame name if too long
    const maxCharsPerLine = 20
    const lines: string[] = []
    for (let i = 0; i < frameName.length; i += maxCharsPerLine) {
      lines.push(frameName.slice(i, i + maxCharsPerLine))
    }
    
    const lineHeight = 60
    const startY = canvas.height / 2 - (lines.length - 1) * lineHeight / 2
    
    lines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, startY + index * lineHeight)
    })
    
    // Draw frame info
    ctx.font = '24px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.fillText(`${frameName}.png`, canvas.width / 2, startY + lines.length * lineHeight + 40)
    
    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 4
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40)
    
    return canvas.toDataURL('image/png')
  }
  
  // 刷新预览图
  const refreshFramePreviews = () => {
    if (figmaFileInfo?.fileKey && Object.keys(frameNodeIds).length > 0) {
      setFramePreviews({})
      setPreviewErrors({})
      loadFramePreviewsAsync(figmaFileInfo.fileKey, figmaFrames, frameNodeIds)
    }
  }
  
  // 重试单个frame的预览图
  const retryFramePreview = (frameName: string) => {
    const fileKey = figmaFileInfo?.fileKey
    const nodeId = frameNodeIds[frameName]
    if (!fileKey || !nodeId) return
    
    const token = getStoredFigmaToken()
    
    // 清除该frame的错误状态
    setPreviewErrors(prev => {
      const next = { ...prev }
      delete next[frameName]
      return next
    })
    
    fetch(`${FIGMA_API_BASE_URL}/images/${fileKey}?ids=${nodeId}&format=png&scale=1`, {
      headers: { 'X-Figma-Token': token }
    })
      .then(res => res.json())
      .then(data => {
        const rawUrl = data.images?.[nodeId]
        if (rawUrl && rawUrl !== 'null') {
          setFramePreviews(prev => ({ ...prev, [frameName]: rawUrl }))
        } else {
          setPreviewErrors(prev => ({ ...prev, [frameName]: true }))
        }
      })
      .catch(err => {
        console.warn(`重试预览图失败 [${frameName}]:`, err)
        setPreviewErrors(prev => ({ ...prev, [frameName]: true }))
      })
  }
  
  // 刷新切图
  const refreshExportAssets = () => {
    if (figmaFileInfo?.fileKey && figmaConnected) {
      const token = getStoredFigmaToken()
      
      // 重新扫描切图节点并加载
      setFigmaExportAssets([])
      setAssetErrors({})
      
      // 从Figma重新获取文件数据以识别切图节点
      fetch(`${FIGMA_API_BASE_URL}/files/${figmaFileInfo.fileKey}`, {
        headers: { 'X-Figma-Token': token }
      })
        .then(res => res.json())
        .then(data => {
          const findExportableNodes = (node: any, parentPath: string = ''): Array<{ id: string; name: string; format: string }> => {
            const results: Array<{ id: string; name: string; format: string }> = []
            const currentPath = parentPath ? `${parentPath}/${node.name || '未命名'}` : (node.name || '未命名')
            if (node.exportSettings && Array.isArray(node.exportSettings)) {
              const pngSetting = node.exportSettings.find((s: any) => s.format === 'PNG')
              if (pngSetting) results.push({ id: node.id, name: currentPath, format: 'PNG' })
              const svgSetting = node.exportSettings.find((s: any) => s.format === 'SVG')
              if (svgSetting) results.push({ id: node.id, name: currentPath, format: 'SVG' })
            }
            if (node.children && Array.isArray(node.children)) {
              for (const child of node.children) results.push(...findExportableNodes(child, currentPath))
            }
            return results
          }
          
          const exportableNodes: Array<{ id: string; name: string; format: string }> = []
          for (const page of data.document.children) {
            if (page.type === 'CANVAS') exportableNodes.push(...findExportableNodes(page))
          }
          
          if (exportableNodes.length > 0 && exportableNodes.length <= 200) {
            loadExportAssetsAsync(figmaFileInfo.fileKey, exportableNodes)
          }
        })
        .catch(err => console.warn('刷新切图失败:', err))
    }
  }
  
  // 重试单个切图
  const retryExportAsset = (assetId: string) => {
    const fileKey = figmaFileInfo?.fileKey
    const asset = figmaExportAssets.find(a => a.id === assetId)
    if (!fileKey || !asset) return
    
    const token = getStoredFigmaToken()
    
    // 清除错误状态
    setAssetErrors(prev => {
      const next = { ...prev }
      delete next[assetId]
      return next
    })
    
    const format = asset.format.toLowerCase()
    const scale = format === 'png' ? 2 : 1
    
    fetch(`${FIGMA_API_BASE_URL}/images/${fileKey}?ids=${assetId}&format=${format}&scale=${scale}`, {
      headers: { 'X-Figma-Token': token }
    })
      .then(res => res.json())
      .then(data => {
        const rawUrl = data.images?.[assetId]
        if (rawUrl && rawUrl !== 'null') {
          // 更新该切图的URL
          setFigmaExportAssets(prev => prev.map(a => 
            a.id === assetId ? { ...a, url: rawUrl } : a
          ))
        } else {
          setAssetErrors(prev => ({ ...prev, [assetId]: true }))
        }
      })
      .catch(err => {
        console.warn(`重试切图失败 [${asset.name}]:`, err)
        setAssetErrors(prev => ({ ...prev, [assetId]: true }))
      })
  }
  
  const disconnectFigma = () => {
    setFigmaUrl('')
    setFigmaConnected(false)
    setFigmaFileInfo(null)
    setFigmaFrames([])
    setSelectedFrames([])
    setFramePreviews({})
    setFrameNodeIds({})
  }
  
  const toggleFrameSelection = (frameName: string) => {
    setSelectedFrames(prev =>
      prev.includes(frameName)
        ? prev.filter(f => f !== frameName)
        : [...prev, frameName]
    )
  }
  
  const selectAllFrames = () => {
    setSelectedFrames([...new Set(figmaFrames)])
  }
  
  const deselectAllFrames = () => {
    setSelectedFrames([])
  }
  
  // 根据压缩质量配置计算 canvas 重编码参数
  const getQualityConfig = (quality: 'lossless' | 'high' | 'medium' | 'low') => {
    switch (quality) {
      case 'lossless': return { mime: 'image/png', quality: 1 }
      case 'high': return { mime: 'image/jpeg', quality: 0.92 }
      case 'medium': return { mime: 'image/jpeg', quality: 0.75 }
      case 'low': return { mime: 'image/jpeg', quality: 0.55 }
    }
  }

  // 通过 canvas 重编码图片以应用压缩质量（PNG 无损 / JPG 体积压缩）
  // 同时保留原始 PNG 的透明通道（仅当输出为 PNG 时）
  const reencodeImage = async (sourceBlob: Blob, quality: 'lossless' | 'high' | 'medium' | 'low', keepTransparency: boolean): Promise<Blob> => {
    const cfg = getQualityConfig(quality)
    // 无损 PNG 或体积优化失败时直接返回原数据
    if (quality === 'lossless') return sourceBlob

    // JPG 不保留透明度，需绘制白底
    return new Promise((resolve) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(sourceBlob)
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            URL.revokeObjectURL(objectUrl)
            resolve(sourceBlob)
            return
          }
          // JPG 无透明通道，绘制白底
          if (cfg.mime === 'image/jpeg' || !keepTransparency) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }
          ctx.drawImage(img, 0, 0)
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(objectUrl)
              resolve(blob || sourceBlob)
            },
            cfg.mime,
            cfg.quality
          )
        } catch {
          URL.revokeObjectURL(objectUrl)
          resolve(sourceBlob)
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(sourceBlob)
      }
      img.src = objectUrl
    })
  }

  // PNG 导出函数：使用默认配置（2x、PNG 无损、保留透明度），直接打包 ZIP 下载
  const handlePngExport = async () => {
    if (isExporting) return

    // 1. 校验
    if (selectedFrames.length === 0) {
      setExportErrorMessage('请先在左侧「已识别的 Frame」列表中勾选至少一个 Frame 再导出。')
      return
    }
    if (!figmaConnected) {
      setExportErrorMessage('Figma 尚未连接，请先在「Figma 导入」区域粘贴链接并连接。')
      return
    }
    const fileKey = figmaFileInfo?.fileKey
    if (!fileKey) {
      setExportErrorMessage('Figma 文件信息缺失，请重新连接以获取 fileKey。')
      return
    }
    const missingNodeIds = selectedFrames.filter(name => !frameNodeIds[name])
    if (missingNodeIds.length > 0) {
      setExportErrorMessage(`以下 Frame 缺少节点 ID，可能数据未完整加载：${missingNodeIds.join('、')}。请重新连接 Figma 后再试。`)
      return
    }
    const currentToken = getStoredFigmaToken()

    // 2. 准备配置参数（使用默认配置）
    const { scale, quality, outputFormat, keepTransparency } = PNG_EXPORT_DEFAULTS
    const projectName = (figmaFileInfo?.name?.replace('.fig', '') || 'HMI Export').trim() || 'HMI Export'
    const ext = outputFormat === 'png' ? 'png' : 'jpg'

    // 3. 初始化导出队列
    setExportErrorMessage(null)
    setExportOverallProgress({ current: 0, total: selectedFrames.length, phase: 'fetching' })

    const newItems = selectedFrames.map((frameName, index) => ({
      id: `export-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 11)}`,
      type: 'PNG 导出',
      frameName,
      status: 'waiting' as const,
      progress: 0,
      filename: `${frameName}.${ext}`,
    }))

    setExportQueue(prev => [...prev, ...newItems])
    setIsExporting(true)

    // 收集所有成功导出的文件（用于打包 ZIP）
    // 使用 Set 对文件名做唯一性去重，避免安全化后同名文件互相覆盖
    const collectedFiles: Array<{ filename: string; blob: Blob }> = []
    const usedFilenames = new Set<string>()  // 已使用的文件名（用于检测冲突）
    const failedItems: string[] = []
    // 并发锁：浏览器对同域名并发连接限制为 6，设为 5 留 1 个余量
    const CONCURRENCY = 5
    let completedCount = 0

    // === 优化 1: 批量请求 Figma API ===
    // Figma API 支持一次请求多个 nodeId，大幅减少 API 调用次数
    // 34 个 Frame 从 34 次 API 请求 → 1 次批量请求
    const FIGMA_BATCH_SIZE = 50  // Figma API 单次请求最大节点数
    const imageUrlMap: Record<string, string> = {}  // nodeId → imageUrl

    setExportOverallProgress({
      current: 0,
      total: selectedFrames.length,
      currentFrame: '正在批量获取图片地址...',
      phase: 'fetching'
    })

    for (let i = 0; i < selectedFrames.length; i += FIGMA_BATCH_SIZE) {
      const batchFrames = selectedFrames.slice(i, i + FIGMA_BATCH_SIZE)
      const batchNodeIds = batchFrames.map(name => frameNodeIds[name]).filter(Boolean)
      if (batchNodeIds.length === 0) continue

      const idsParam = batchNodeIds.join(',')
      const apiUrl = `${FIGMA_API_BASE_URL}/images/${fileKey}?ids=${encodeURIComponent(idsParam)}&format=png&scale=${scale}`

      try {
        const apiController = new AbortController()
        const apiTimer = setTimeout(() => apiController.abort(new Error('Figma API 批量请求超时（30s）')), 30000)
        const response = await fetch(apiUrl, {
          headers: { 'X-Figma-Token': currentToken },
          signal: apiController.signal,
        })
        clearTimeout(apiTimer)

        if (!response.ok) {
          const statusText = response.status === 403 ? '（Token 权限不足或已过期）'
            : response.status === 404 ? '（fileKey 错误或节点已删除）'
            : response.status === 429 ? '（请求过于频繁，已被限流）'
            : ''
          throw new Error(`Figma API 返回 HTTP ${response.status}${statusText}`)
        }

        const data = await response.json()
        if (data.err) throw new Error(`Figma 处理失败：${data.err}`)

        // 合并到 imageUrlMap
        for (const [nodeId, url] of Object.entries(data.images || {})) {
          if (url && url !== 'null') {
            imageUrlMap[nodeId] = url as string
          }
        }

        console.log(`[导出] 批量 API 请求 ${Math.floor(i / FIGMA_BATCH_SIZE) + 1}/${Math.ceil(selectedFrames.length / FIGMA_BATCH_SIZE)}: 获取 ${batchNodeIds.length} 个节点，成功 ${Object.keys(data.images || {}).length} 个`)
      } catch (err: any) {
        const reason = err instanceof Error ? err.message : String(err)
        console.error(`[导出] 批量 API 请求失败:`, reason)
        // 批量失败时，把这一批全部标记为失败
        for (const frameName of batchFrames) {
          failedItems.push(`${frameName}（${reason}）`)
        }
      }
    }

    // 更新进度：API 阶段完成
    setExportOverallProgress({
      current: 0,
      total: selectedFrames.length,
      currentFrame: '开始下载图片...',
      phase: 'fetching'
    })

    /**
     * 处理单个 Frame 的下载任务
     * 由于 API 已批量预取，这里只需下载图片 + 重编码
     */
    const processItem = async (item: typeof newItems[number]) => {
      const frameName = item.frameName || ''
      const nodeId = frameNodeIds[frameName]

      // 更新单个任务状态为处理中
      setExportQueue(prev =>
        prev.map(q => q.id === item.id ? { ...q, status: 'processing' as const, progress: 20 } : q)
      )

      let blob: Blob | null = null
      try {
        // 阶段 1: 从批量预取的结果中获取图片 URL
        const imageUrl = imageUrlMap[nodeId]
        if (!imageUrl) {
          throw new Error('该 Frame 未在批量 API 请求中获取到图片 URL（可能节点不支持导出）')
        }

        setExportQueue(prev =>
          prev.map(q => q.id === item.id ? { ...q, progress: 40 } : q)
        )

        // 阶段 2: 通过代理下载图片为 Blob（带超时和重试）
        let rawBlob: Blob
        try {
          rawBlob = await fetchFigmaImageAsBlob(imageUrl)
        } catch (dlErr: any) {
          throw new Error(`图片下载失败：${dlErr?.message || '所有代理均无法访问 S3'}（图片 URL: ${imageUrl.slice(0, 80)}...）`)
        }

        if (!rawBlob || rawBlob.size === 0) {
          throw new Error('下载的图片数据为空（0 字节）')
        }

        // 阶段 3: 按用户配置重编码（无损 PNG 或 JPG 压缩）
        if (quality === 'lossless' || outputFormat === 'png') {
          blob = rawBlob
        } else {
          try {
            blob = await reencodeImage(rawBlob, quality, keepTransparency)
          } catch (encErr: any) {
            console.warn('JPG 重编码失败，回退到原始 PNG 数据:', encErr)
            blob = rawBlob
          }
        }

        setExportQueue(prev =>
          prev.map(q => q.id === item.id ? { ...q, progress: 90 } : q)
        )
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        console.error(`导出 Frame "${frameName}" 失败:`, reason, { nodeId, fileKey })
        failedItems.push(`${frameName}（${reason}）`)
        setExportQueue(prev =>
          prev.map(q => q.id === item.id ? { ...q, status: 'failed' as const, progress: 100 } : q)
        )
        // 更新整体进度
        completedCount++
        setExportOverallProgress({ current: completedCount, total: newItems.length, currentFrame: frameName, phase: 'fetching' })
        return
      }

      if (blob) {
        // 文件名安全化：去除 Windows/macOS 非法字符
        const rawName = item.filename.replace(/[\\/:*?"<>|]/g, '_').trim()
        // 检测文件名冲突：对冲突文件名自动加序号 (2)、(3) ...
        let finalName = rawName
        if (usedFilenames.has(finalName)) {
          const dotIdx = rawName.lastIndexOf('.')
          const baseName = dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName
          const extName = dotIdx > 0 ? rawName.slice(dotIdx) : ''
          let suffix = 2
          while (usedFilenames.has(`${baseName} (${suffix})${extName}`)) {
            suffix++
          }
          finalName = `${baseName} (${suffix})${extName}`
          console.warn(`文件名冲突: "${item.filename}" → "${finalName}"`)
        }
        usedFilenames.add(finalName)
        collectedFiles.push({ filename: finalName, blob })
        // 更新任务为已完成，写入文件大小
        const sizeStr = blob.size > 1024 * 1024
          ? `${(blob.size / 1024 / 1024).toFixed(2)} MB`
          : `${(blob.size / 1024).toFixed(1)} KB`
        setExportQueue(prev =>
          prev.map(q => q.id === item.id ? { ...q, status: 'completed' as const, progress: 100, size: sizeStr } : q)
        )
      }

      // 更新整体进度
      completedCount++
      setExportOverallProgress({ current: completedCount, total: newItems.length, currentFrame: frameName, phase: 'fetching' })
    }

    try {
      // 并发执行：限制同时进行的任务数量为 CONCURRENCY
      // 使用简单的分批策略，避免 Promise 池复杂度
      for (let i = 0; i < newItems.length; i += CONCURRENCY) {
        const batch = newItems.slice(i, i + CONCURRENCY)
        // 并行处理这一批
        await Promise.all(batch.map(item => processItem(item)))
      }

      // 7. 打包成 ZIP 一次性下载到浏览器默认下载目录
      setExportOverallProgress({ current: newItems.length, total: newItems.length, phase: 'saving' })

      const resolutionLabel = `${scale}x`

      // 若存在失败，给出友好提示但不阻止成功弹窗
      if (failedItems.length > 0) {
        setExportErrorMessage(`部分 Frame 导出失败（${failedItems.length}/${newItems.length}）：${failedItems.join('、')}`)
      }

      // 打包成 ZIP 下载（ZIP 内包含以项目名命名的文件夹，解压后即为独立文件夹）
      const zip = new JSZip()
      for (const { filename, blob } of collectedFiles) {
        zip.file(`${projectName}/${filename}`, blob)
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const downloadUrl = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${projectName}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)

      setExportOverallProgress({ current: newItems.length, total: newItems.length, phase: 'done' })

      setCompletedExport({
        type: 'PNG 导出',
        filename: `${projectName}.zip`,
        size: zipBlob.size > 1024 * 1024
          ? `${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`
          : `${(zipBlob.size / 1024).toFixed(1)} KB`,
        resolution: resolutionLabel,
      })
      setExportComplete(true)
      setIsExporting(false)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.error('导出失败:', error)
      setExportErrorMessage(`导出失败：${reason}`)
      setIsExporting(false)
      setExportOverallProgress(null)
    }
  }

  const handleExport = async (exportType: string) => {
    if (isExporting) return
    if (selectedFrames.length === 0) {
      console.warn('没有选择任何 Frame')
      return
    }

    let ext = 'json'
    if (exportType === 'PNG 导出') ext = 'png'
    else if (exportType === '壁纸导出') ext = 'png'
    
    // 获取项目名称（从 Figma 文件信息或使用默认名称）
    const projectName = figmaFileInfo?.name?.replace('.fig', '') || 'HMI Export'
    
    // 创建多个导出任务，每个 Frame 一个
    const newItems = selectedFrames.map((frameName, index) => ({
      id: `export-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 11)}`,
      type: exportType,
      frameName: frameName,
      status: 'waiting' as const,
      progress: 0,
      filename: `${frameName}.${ext}`,
      size: `${(Math.random() * 5 + 1).toFixed(1)} MB`,
    }))
    
    setExportQueue(prev => [...prev, ...newItems])
    setIsExporting(true)
    
    try {
      // 创建 ZIP 文件
      const zip = new JSZip()
      
      // 逐 Frame 导出并添加到 ZIP
      for (const item of newItems) {
        // 更新状态为处理中
        setExportQueue(prev =>
          prev.map(i => i.id === item.id ? { ...i, status: 'processing' as const } : i)
        )
        
        // 导出进度
        for (let progress = 0; progress <= 100; progress += 5) {
          await new Promise(resolve => setTimeout(resolve, 50))
          setExportQueue(prev =>
            prev.map(queueItem => queueItem.id === item.id ? { ...queueItem, progress } : queueItem)
          )
        }
        
        // 获取文件内容
        const fileContent = await getFrameFileContent(item.frameName, item.filename, exportType)
        
        if (fileContent) {
          // 将文件添加到项目文件夹中（使用相对路径）
          zip.file(`${projectName}/${item.filename}`, fileContent, { binary: true })
        } else {
          console.warn(`无法获取文件内容: ${item.filename}`)
        }
        
        // 更新状态为完成
        setExportQueue(prev =>
          prev.map(i => i.id === item.id ? { ...i, status: 'completed' as const } : i)
        )
        
        // 短暂延迟
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      // 生成 ZIP 文件
      console.log('正在生成 ZIP 文件...')
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      console.log(`ZIP 文件生成成功，大小: ${(zipBlob.size / 1024).toFixed(2)} KB`)
      
      // 下载 ZIP 文件
      const downloadUrl = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${projectName}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
      
      setIsExporting(false)
      setCompletedExport({
        type: exportType,
        filename: `${projectName}.zip`,
        size: `${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`,
        resolution: exportType === 'PNG 导出' ? '1920x1080' : undefined,
      })
      setExportComplete(true)
      
    } catch (error) {
      console.error('导出失败:', error)
      setIsExporting(false)
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }
  
  // 批量打包下载所有切图资源为 ZIP 文件
  const [isAssetsZipping, setIsAssetsZipping] = useState(false)
  const [assetsZipProgress, setAssetsZipProgress] = useState({ current: 0, total: 0 })

  const handleDownloadAllAssetsAsZip = async () => {
    if (isAssetsZipping || figmaExportAssets.length === 0) return
    setIsAssetsZipping(true)
    setAssetsZipProgress({ current: 0, total: figmaExportAssets.length })

    const zip = new JSZip()
    const usedNames = new Set<string>()
    const failed: string[] = []
    const CONCURRENCY = 5  // 浏览器同域名并发上限 6，留 1 个余量

    // 并发分批下载
    for (let i = 0; i < figmaExportAssets.length; i += CONCURRENCY) {
      const batch = figmaExportAssets.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map(async (asset) => {
        try {
          const blob = await fetchFigmaImageAsBlob(asset.url)
          if (!blob || blob.size === 0) {
            failed.push(asset.name)
            return
          }
          // 文件名安全化 + 冲突检测
          let filename = `${asset.name.replace(/[\\/:*?"<>|]/g, '_')}.${asset.format.toLowerCase()}`
          if (usedNames.has(filename)) {
            const dot = filename.lastIndexOf('.')
            const base = dot > 0 ? filename.slice(0, dot) : filename
            const ext = dot > 0 ? filename.slice(dot) : ''
            let suffix = 2
            while (usedNames.has(`${base} (${suffix})${ext}`)) suffix++
            filename = `${base} (${suffix})${ext}`
          }
          usedNames.add(filename)
          zip.file(filename, blob)
        } catch (err) {
          console.error(`下载切图 "${asset.name}" 失败:`, err)
          failed.push(asset.name)
        }
        setAssetsZipProgress(prev => ({ ...prev, current: Math.min(prev.current + 1, prev.total) }))
      }))
    }

    // 生成 ZIP 并触发下载
    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = window.URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `切图打包_${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      if (failed.length > 0) {
        console.warn(`部分切图下载失败（${failed.length}/${figmaExportAssets.length}）:`, failed)
        notify({ app: 'exportReady', title: '切图打包部分失败', body: `${failed.length}/${figmaExportAssets.length} 个切图下载失败` })
      } else {
        notify({ app: 'exportReady', title: '切图打包完成', body: `共 ${figmaExportAssets.length} 个切图已保存为 ZIP` })
      }
    } catch (err) {
      console.error('打包 ZIP 失败:', err)
      alert(`打包 ZIP 失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setIsAssetsZipping(false)
      setAssetsZipProgress({ current: 0, total: 0 })
    }
  }
  
  const getFrameFileContent = async (frameName: string, filename: string, exportType: string): Promise<Blob | null> => {
    const ext = filename.split('.').pop() || 'png'
    const fileKey = figmaFileInfo?.fileKey
    
    // 只有在已连接Figma且有有效Token和节点ID时才调用真实API
    if (figmaConnected && fileKey && frameNodeIds[frameName] && (ext === 'png' || ext === 'svg')) {
      try {
        // 每次调用时重新获取最新的token（避免token更新后使用旧值）
        const currentToken = getStoredFigmaToken()
        
        // 使用真实的 Figma API 获取图片
        const format = ext === 'png' ? 'png' : 'svg'
        const nodeId = frameNodeIds[frameName]
        
        const response = await fetch(`${FIGMA_API_BASE_URL}/images/${fileKey}?ids=${nodeId}&format=${format}&scale=2`, {
          headers: {
            'X-Figma-Token': currentToken
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          const imageUrl = data.images?.[nodeId]
          
          if (imageUrl) {
            // 通过后端代理下载图片，避免浏览器直接访问S3被阻止
            return await fetchFigmaImageAsBlob(imageUrl)
          }
        }
      } catch (error) {
        console.warn('Figma API导出失败，使用模拟导出:', error instanceof Error ? error.message : error)
      }
    }
    
    // Fallback: 生成模拟图片
    return generateFallbackContent(ext, filename)
  }
  
  // 生成模拟导出内容
  const generateFallbackContent = async (ext: string, filename: string): Promise<Blob | null> => {
    if (ext === 'png') {
      // Generate a PNG image using Canvas
      const canvas = document.createElement('canvas')
      canvas.width = 1920
      canvas.height = 1080
      const ctx = canvas.getContext('2d')
      
      if (ctx) {
        // Create a sample HMI Dashboard background
        const gradient = ctx.createLinearGradient(0, 0, 0, 1080)
        gradient.addColorStop(0, '#0f172a')
        gradient.addColorStop(1, '#1e293b')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 1920, 1080)
        
        // Add some sample UI elements
        ctx.fillStyle = '#334155'
        ctx.roundRect(100, 100, 400, 200, 12)
        ctx.fill()
        
        ctx.fillStyle = '#475569'
        ctx.roundRect(100, 350, 400, 200, 12)
        ctx.fill()
        
        ctx.fillStyle = '#6366f1'
        ctx.roundRect(600, 100, 600, 450, 12)
        ctx.fill()
        
        ctx.fillStyle = '#334155'
        ctx.roundRect(1300, 100, 520, 200, 12)
        ctx.fill()
        
        ctx.fillStyle = '#475569'
        ctx.roundRect(1300, 350, 520, 200, 12)
        ctx.fill()
        
        // Add frame name text
        ctx.fillStyle = '#f1f5f9'
        ctx.font = '14px sans-serif'
        ctx.fillText(`Frame: ${filename.replace('.png', '')} - Exported from HMI Agent Studio`, 100, 950)
        
        return new Promise<Blob | null>((resolve) => {
          canvas.toBlob((blob) => resolve(blob || null), 'image/png')
        })
      }
    } else if (ext === 'svg') {
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <rect fill="#0f172a" width="1920" height="1080"/>
  <rect x="100" y="100" width="400" height="200" rx="12" fill="#334155"/>
  <rect x="100" y="350" width="400" height="200" rx="12" fill="#475569"/>
  <rect x="600" y="100" width="600" height="450" rx="12" fill="#6366f1"/>
  <rect x="1300" y="100" width="520" height="200" rx="12" fill="#334155"/>
  <rect x="1300" y="350" width="520" height="200" rx="12" fill="#475569"/>
  <text x="100" y="950" fill="#f1f5f9" font-size="14">Frame: ${filename.replace('.svg', '')} - Exported from HMI Agent Studio</text>
</svg>`
      return new Blob([svgContent], { type: 'image/svg+xml' })
    } else {
      const content = `{"frame": "${filename.replace('.json', '')}", "exportedFrom": "HMI Agent Studio"}`
      return new Blob([content], { type: 'application/json' })
    }
    
    return null
  }
  
  const closeExportComplete = () => {
    setExportComplete(false)
    setCompletedExport(null)
    setExportOverallProgress(null)
    setExportErrorMessage(null)
  }
  
  const downloadExportedFile = () => {
    if (!completedExport) return
    
    if (completedExport.type === 'PNG 导出') {
      // Generate a PNG image using Canvas
      const canvas = document.createElement('canvas')
      canvas.width = 1920
      canvas.height = 1080
      const ctx = canvas.getContext('2d')
      
      if (ctx) {
        // Create a sample HMI Dashboard background
        const gradient = ctx.createLinearGradient(0, 0, 0, 1080)
        gradient.addColorStop(0, '#0f172a')
        gradient.addColorStop(1, '#1e293b')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 1920, 1080)
        
        // Add some sample UI elements
        ctx.fillStyle = '#334155'
        ctx.roundRect(100, 100, 400, 200, 12)
        ctx.fill()
        
        ctx.fillStyle = '#475569'
        ctx.roundRect(100, 350, 400, 200, 12)
        ctx.fill()
        
        ctx.fillStyle = '#6366f1'
        ctx.roundRect(600, 100, 600, 450, 12)
        ctx.fill()
        
        ctx.fillStyle = '#334155'
        ctx.roundRect(1300, 100, 520, 200, 12)
        ctx.fill()
        
        ctx.fillStyle = '#475569'
        ctx.roundRect(1300, 350, 520, 200, 12)
        ctx.fill()
        
        // Add text
        ctx.fillStyle = '#f1f5f9'
        ctx.font = '14px sans-serif'
        ctx.fillText('HMI 界面 - 由 HMI Agent Studio 导出', 100, 950)
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = completedExport.filename
            a.click()
            URL.revokeObjectURL(url)
          }
        }, 'image/png')
      }
    } else {
      const content = exportContentMap[completedExport.type] || '{}'
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = completedExport.filename
      a.click()
      URL.revokeObjectURL(url)
    }
  }
  
  const exportContentMap: Record<string, string> = {
    'PNG 导出': 'HMI 界面导出图像',
    '壁纸导出': 'HMI 壁纸导出',
    'JSON 导出': JSON.stringify({ components: [], layout: {}, theme: {} }, null, 2),
    '设计令牌': JSON.stringify({
      colors: { primary: '#6366f1', secondary: '#8b5cf6' },
      typography: { fontSize: { sm: '12px', md: '14px', lg: '16px' } },
      radius: { sm: '4px', md: '8px', lg: '12px' },
      spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px' },
    }, null, 2),
    '开发导出': JSON.stringify({
      cssVariables: {},
      tailwindTheme: {},
      hmiConfig: {},
    }, null, 2),
  }

  // Theme studio states
  const [themeSubMode, setThemeSubMode] = useState<'preset' | 'recolor' | 'figma-swap'>('preset')
  const [recolorImage, setRecolorImage] = useState<string | null>(null)
  const [recolorImageName, setRecolorImageName] = useState('')
  const [recolorText, setRecolorText] = useState('')
  const [recolorTemplate, setRecolorTemplate] = useState<string>(themes[0].id)
  const [recolorGenerating, setRecolorGenerating] = useState(false)
  const [recolorError, setRecolorError] = useState<string | null>(null)
  const [recolorResult, setRecolorResult] = useState<string[]>([])
  const recolorFileRef = useRef<HTMLInputElement>(null)

  // Custom preset states
  const [customPresets, setCustomPresets] = useState<HMITheme[]>(() => {
    try {
      const s = localStorage.getItem('hmi-custom-presets')
      return s ? JSON.parse(s) : []
    } catch { return [] }
  })
  const [selectedPresetId, setSelectedPresetId] = useState<string>(themes[0].id)
  const [showAddPreset, setShowAddPreset] = useState(false)
  const [wallpaperCategory, setWallpaperCategory] = useState<'anime' | 'nature' | 'abstract' | 'city' | 'vehicle' | 'animal' | string>('anime')
  const [wallpaperTag, setWallpaperTag] = useState('全部')
  const [previewWallpaper, setPreviewWallpaper] = useState<string | null>(null)
  const [wallpaperImportVersion, setWallpaperImportVersion] = useState(0)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<string | null>(null)
  const [hiddenWallpaperIds, setHiddenWallpaperIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('wallpaper-hidden-ids')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })
  const [hiddenCategories, setHiddenCategories] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('wallpaper-hidden-categories')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })
  const [newPresetForm, setNewPresetForm] = useState({
    name: '', description: '', primary: '#9b7dff', background: '#080c14', glow: '#b89fff', surface: '#0d1226',
  })

  const importedWallpaperData = useMemo(() => {
    const result: Record<string, { list: any[]; tags: string[]; label: string; dir: string }> = {}
    try {
      const customCatsRaw = JSON.parse(localStorage.getItem('wallpaper-custom-categories') || '[]')
      const customCats = Array.isArray(customCatsRaw) ? customCatsRaw : []
      const allCatIds = [
        ...wallpaperCategories.map(c => c.id),
        ...customCats.map((c: any) => c?.id).filter(Boolean),
      ]
      for (const catId of allCatIds) {
        const key = `wallpaper-engine-imports-${catId}`
        try {
          const rawItems = JSON.parse(localStorage.getItem(key) || '[]')
          const items = Array.isArray(rawItems) ? rawItems : []
          if (items.length > 0) {
            const catInfo = wallpaperCategories.find(c => c.id === catId)
            const customCat = customCats.find((c: any) => c?.id === catId)
            const allTags = items.flatMap((i: any) => (Array.isArray(i?.tags) ? i.tags : []))
            result[catId] = {
              list: items,
              tags: Array.from(new Set<string>(['全部', 'AI生成', ...allTags])),
              label: catInfo?.name || customCat?.name || catId,
              dir: '',
            }
          }
        } catch {
          // skip invalid data for this category
        }
      }
    } catch {}
    return result
  }, [wallpaperImportVersion])

  useEffect(() => {
    if (activeTab === 'wallpaper') {
      setWallpaperImportVersion(v => v + 1)
    } else {
      setPreviewWallpaper(null)
      setDeleteConfirmId(null)
    }
  }, [activeTab])

  const handleDeleteWallpaper = (wallpaper: any, catId: string) => {
    const isImported = wallpaper.id?.startsWith('imported-')
    if (isImported) {
      const storageKey = `wallpaper-engine-imports-${catId}`
      try {
        const rawItems = JSON.parse(localStorage.getItem(storageKey) || '[]')
        const items = Array.isArray(rawItems) ? rawItems : []
        const filtered = items.filter((i: any) => i.id !== wallpaper.id)
        if (filtered.length === 0) {
          localStorage.removeItem(storageKey)
          if (catId.startsWith('custom-')) {
            try {
              const rawCats = JSON.parse(localStorage.getItem('wallpaper-custom-categories') || '[]')
              const cats = Array.isArray(rawCats) ? rawCats : []
              const updatedCats = cats.filter((c: any) => c?.id !== catId)
              localStorage.setItem('wallpaper-custom-categories', JSON.stringify(updatedCats))
            } catch {}
          }
          const builtinCats = wallpaperCategories.map(c => c.id)
          if (!builtinCats.includes(catId)) {
            setWallpaperCategory('anime')
            setWallpaperTag('全部')
          }
        } else {
          localStorage.setItem(storageKey, JSON.stringify(filtered))
        }
      } catch {}
      setWallpaperImportVersion(v => v + 1)
    } else {
      const wallpaperId = wallpaper.id || wallpaper.filename
      const updated = [...hiddenWallpaperIds, wallpaperId]
      setHiddenWallpaperIds(updated)
      localStorage.setItem('wallpaper-hidden-ids', JSON.stringify(updated))
    }
    setDeleteConfirmId(null)
  }

  const handleDeleteCategory = (catId: string) => {
    const isCustom = catId.startsWith('custom-')
    if (isCustom) {
      try {
        localStorage.removeItem(`wallpaper-engine-imports-${catId}`)
        const rawCats = JSON.parse(localStorage.getItem('wallpaper-custom-categories') || '[]')
        const cats = Array.isArray(rawCats) ? rawCats : []
        const updatedCats = cats.filter((c: any) => c?.id !== catId)
        localStorage.setItem('wallpaper-custom-categories', JSON.stringify(updatedCats))
      } catch {}
      setWallpaperImportVersion(v => v + 1)
    } else {
      const updated = [...hiddenCategories, catId]
      setHiddenCategories(updated)
      localStorage.setItem('wallpaper-hidden-categories', JSON.stringify(updated))
      try {
        localStorage.removeItem(`wallpaper-engine-imports-${catId}`)
      } catch {}
      setWallpaperImportVersion(v => v + 1)
    }
    setDeleteCategoryConfirm(null)
  }

  const wallpaperData = useMemo(() => {
    const wpMap: Record<string, { list: any[]; tags: string[]; label: string; dir: string }> = {
      anime: { list: animeWallpapers, tags: animeTags, label: '动漫卡通类', dir: 'anime' },
      nature: { list: natureWallpapers, tags: natureTags, label: '自然风光类', dir: 'nature' },
      abstract: { list: abstractWallpapers, tags: abstractTags, label: '抽象艺术类', dir: 'abstract' },
      city: { list: cityWallpapers, tags: cityTags, label: '城市建筑类', dir: 'city' },
      vehicle: { list: vehicleWallpapers, tags: vehicleTags, label: '交通工具类', dir: 'vehicle' },
      animal: { list: animalWallpapers, tags: animalTags, label: '动物植物类', dir: 'animal' },
    }
    try {
      for (const [catId, data] of Object.entries(importedWallpaperData)) {
        if (wpMap[catId]) {
          wpMap[catId] = {
            ...wpMap[catId],
            list: [...wpMap[catId].list, ...(Array.isArray(data?.list) ? data.list : [])],
            tags: [...new Set([...wpMap[catId].tags, ...(Array.isArray(data?.tags) ? data.tags : [])])],
          }
        } else if (data) {
          wpMap[catId] = data
        }
      }
    } catch {}
    for (const hiddenCat of hiddenCategories) {
      delete wpMap[hiddenCat]
    }
    const cur = wpMap[wallpaperCategory] || { list: [], tags: ['全部'], label: wallpaperCategory, dir: '' }
    const visibleList = cur.list.filter((w: any) => !hiddenWallpaperIds.includes(w.id || w.filename))
    const filtered = wallpaperTag === '全部' ? visibleList : visibleList.filter((w: any) => w.tags?.includes(wallpaperTag))
    return { wpMap, cur, filtered }
  }, [wallpaperCategory, wallpaperTag, importedWallpaperData, hiddenWallpaperIds, hiddenCategories])

  useEffect(() => {
    if (hiddenCategories.includes(wallpaperCategory) || !wallpaperData.wpMap[wallpaperCategory]) {
      const firstAvailable = Object.keys(wallpaperData.wpMap)[0]
      if (firstAvailable) {
        setWallpaperCategory(firstAvailable)
        setWallpaperTag('全部')
      }
    }
  }, [hiddenCategories, wallpaperCategory, wallpaperData.wpMap])

  useEffect(() => {
    if (editSubModeProp) setEditSubMode(editSubModeProp)
  }, [editSubModeProp])

  // Sync themePreset from sidebar navigation prop
  useEffect(() => {
    if (themePresetProp === 'ai-recolor') {
      setThemeSubMode('recolor')
    } else if (themePresetProp === 'preset') {
      setThemeSubMode('preset')
    } else if (themePresetProp === 'figma-swap') {
      setThemeSubMode('figma-swap')
    } else if (themePresetProp) {
      const theme = getThemeById(themePresetProp)
      if (theme) setSelectedPresetId(theme.id)
    }
  }, [themePresetProp])

  // Sync wallpaper category from sidebar navigation prop
  useEffect(() => {
    if (wallpaperSubProp === 'anime' || wallpaperSubProp === 'nature' || wallpaperSubProp === 'abstract' || wallpaperSubProp === 'city' || wallpaperSubProp === 'vehicle' || wallpaperSubProp === 'animal') {
      setWallpaperCategory(wallpaperSubProp)
      setWallpaperTag('全部')
    }
  }, [wallpaperSubProp])

  // OpenAI generate helper
  const generateOpenAI = async (prompt: string, imageBase64?: string) => {
    const endpoint = imageBase64 ? '/api/openai/image2image' : '/api/openai/text2image'
    const key = getStoredOpenAIKey().trim()
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'X-OpenAI-Api-Key': key } : {}),
      },
      body: JSON.stringify({ prompt, image_base64: imageBase64 }),
    })
    return await res.json() as { ok: boolean; images: string[]; error?: string }
  }

  const handleGenerate = async () => {
    if (!promptInput.trim() && !refImage) return

    if (!isLoggedIn) {
      navigate('/login?return=/workspace')
      return
    }

    if (engine === 'jimeng') {
      const loginStatus = await checkLoginStatus()
      if (!loginStatus.ok) {
        const wasConfigured = (() => {
          try {
            const s = localStorage.getItem('api_config_status')
            if (s) {
              const cfg = JSON.parse(s)
              return cfg.provider === 'jimeng' || cfg.provider === 'ark'
            }
          } catch {}
          return false
        })()
        if (wasConfigured) {
          setGenError(`即梦 API: ${loginStatus.credit || 'API 验证失败，可能是网络问题或 Key 已过期，请点击设置按钮重新配置'}`)
        } else {
          setGenError(`即梦 API: ${loginStatus.credit || 'API Key 未配置，请点击设置按钮完成配置'}`)
        }
        setSettingsOpen(true)
        return
      } else {
        localStorage.setItem('api_config_status', JSON.stringify({ provider: 'jimeng', configuredAt: Date.now() }))
      }
    } else {
      const wasConfigured = (() => {
        try {
          const s = localStorage.getItem('api_config_status')
          if (s) {
            const cfg = JSON.parse(s)
            return cfg.provider === 'openai'
          }
        } catch {}
        return false
      })()
      const openAIKey = getStoredOpenAIKey().trim()
      const res = await fetch('/api/openai/status', {
        headers: openAIKey ? { 'X-OpenAI-Api-Key': openAIKey } : undefined,
      })
      const st = await res.json()
      if (!st.ok) {
        if (wasConfigured) {
          setGenError('OpenAI API 验证失败，可能是网络问题或 Key 已过期，请点击设置按钮重新配置')
        } else {
          setGenError('OpenAI API Key 未配置，请点击设置按钮完成配置')
        }
        setSettingsOpen(true)
        return
      }
    }

    setIsGenerating(true)
    setGenError(null)
    setGeneratedImages([])
    setSizeVerifyResults({})

    try {
      let result: { success: boolean; images: string[]; error?: string }

      // 获取当前选择的尺寸（仅即梦引擎支持自定义尺寸）
      const presetSize = engine === 'jimeng' ? buildPresetSizeFromSelection() : undefined

      if (engine === 'openai') {
        const r = await generateOpenAI(
          promptInput || '参考这张图片的风格生成智能座舱HMI界面',
          refImage || undefined,
        )
        result = { success: r.ok, images: r.images, error: r.error }
      } else {
        const r = await generateWithPoll(
          promptInput || '参考这张图片的风格生成智能座舱HMI界面',
          refImage || undefined,
          undefined,
          presetSize?.apiSize,
        )
        result = r
      }

      if (result.success && result.images.length > 0) {
        setGeneratedImages(result.images)
        onAddHistory?.(
          promptInput || '参考图片风格生成智能座舱HMI界面',
          result.images,
          'hmi',
        )

        // 生成成功后异步校验尺寸（不阻塞用户操作，不显著增加耗时）
        if (presetSize) {
          setIsVerifyingSize(true)
          const verifyMap: Record<string, CheckAndVerifyResult | undefined> = {}
          Promise.all(result.images.map(async (url) => {
            try {
              const verifyResult = await checkAndVerifyImage(url, presetSize)
              return { url, verifyResult }
            } catch {
              return { url, verifyResult: null }
            }
          })).then((results) => {
            results.forEach(({ url, verifyResult }) => {
              if (verifyResult) verifyMap[url] = verifyResult
            })
            setSizeVerifyResults({ ...verifyMap })
            // 统计校验结果并通知
            const allMatch = Object.values(verifyMap).every(r => r?.verify.match)
            const adjustedCount = Object.values(verifyMap).filter(r => r?.adjusted).length
            if (adjustedCount > 0) {
              notify({ app: 'aiGenerate', title: '尺寸已自动调整', body: `${adjustedCount} 张图片因尺寸不符已裁剪至 ${presetSize.id}` })
            } else if (allMatch) {
              notify({ app: 'aiGenerate', title: '尺寸校验通过', body: `所有图片尺寸符合 ${presetSize.label}（${presetSize.width}×${presetSize.height}）` })
            }
          }).finally(() => {
            setIsVerifyingSize(false)
          })
        }
      } else {
        setGenError(result.error || '生成失败，请稍后重试')
      }
    } catch (err) {
      setGenError(`生成异常: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleWallpaperGenerate = async () => {
    if (!wallpaperPrompt.trim()) return
    if (!isLoggedIn) {
      navigate('/login?return=/workspace')
      return
    }

    if (engine === 'jimeng') {
      const loginStatus = await checkLoginStatus()
      if (!loginStatus.ok) {
        const wasConfigured = (() => {
          try {
            const s = localStorage.getItem('api_config_status')
            if (s) {
              const cfg = JSON.parse(s)
              return cfg.provider === 'jimeng' || cfg.provider === 'ark'
            }
          } catch {}
          return false
        })()
        if (wasConfigured) {
          setWallpaperError(`即梦 API: ${loginStatus.credit || 'API 验证失败，可能是网络问题或 Key 已过期，请点击设置按钮重新配置'}`)
        } else {
          setWallpaperError(`即梦 API: ${loginStatus.credit || 'API Key 未配置，请点击设置按钮完成配置'}`)
        }
        setSettingsOpen(true)
        return
      } else {
        localStorage.setItem('api_config_status', JSON.stringify({ provider: 'jimeng', configuredAt: Date.now() }))
      }
    } else {
      const wasConfigured = (() => {
        try {
          const s = localStorage.getItem('api_config_status')
          if (s) {
            const cfg = JSON.parse(s)
            return cfg.provider === 'openai'
          }
        } catch {}
        return false
      })()
      const openAIKey = getStoredOpenAIKey().trim()
      const res = await fetch('/api/openai/status', {
        headers: openAIKey ? { 'X-OpenAI-Api-Key': openAIKey } : undefined,
      })
      const st = await res.json()
      if (!st.ok) {
        if (wasConfigured) {
          setWallpaperError('OpenAI API 验证失败，可能是网络问题或 Key 已过期，请点击设置按钮重新配置')
        } else {
          setWallpaperError('OpenAI API Key 未配置，请点击设置按钮完成配置')
        }
        setSettingsOpen(true)
        return
      }
    }

    setWallpaperGenerating(true)
    setWallpaperError(null)
    setWallpaperResults([])

    try {
      let result: { success: boolean; images: string[]; error?: string }

      if (engine === 'openai') {
        const r = await generateOpenAI(
          `${wallpaperPrompt}，高画质桌面壁纸，${wallpaperRes}分辨率`,
          undefined,
        )
        result = { success: r.ok, images: r.images, error: r.error }
      } else {
        const r = await generateWithPoll(
          `${wallpaperPrompt}，高画质桌面壁纸，${wallpaperRes}分辨率`,
          undefined,
        )
        result = r
      }

      if (result.success && result.images.length > 0) {
        setWallpaperResults(result.images)
        onAddHistory?.(
          `壁纸: ${wallpaperPrompt}`,
          result.images,
          'wallpaper',
        )
      } else {
        setWallpaperError(result.error || '生成失败，请稍后重试')
      }
    } catch (err) {
      setWallpaperError(`生成异常: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setWallpaperGenerating(false)
    }
  }

  const handleWallpaperDownload = async (url: string, index: number) => {
    try {
      const r = await fetch(url)
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `wallpaper_${index + 1}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      console.error('Download error:', e)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setRefImage(ev.target?.result as string)
      setRefImageName(file.name)
    }
    reader.readAsDataURL(file)
  }

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setRefImage(ev.target?.result as string)
      setRefImageName(file.name)
    }
    reader.readAsDataURL(file)
  }

  const removeRefImage = () => {
    setRefImage(null)
    setRefImageName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDownload = async (imgUrl: string, index: number) => {
    try {
      const proxyUrl = `/api/jimeng/download?url=${encodeURIComponent(imgUrl)}`
      const resp = await fetch(proxyUrl)
      const blob = await resp.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `hmi-generated-${index + 1}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      // fallback: open in new tab
      window.open(imgUrl, '_blank')
    }
  }

  // ── HMI Edit handlers ──

  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setEditImage(ev.target?.result as string)
      setEditImageName(file.name)
      setEditResult(null)
      setEditError(null)
    }
    reader.readAsDataURL(file)
  }

  const removeEditImage = () => {
    setEditImage(null)
    setEditImageName('')
    setEditResult(null)
    setEditError(null)
    if (editFileRef.current) editFileRef.current.value = ''
  }

  // ── Custom preset helpers ──────────────────────────────────────────────

  /** Convert #rrggbb hex to HSL object */
  function hexToHSL(hex: string): { h: number; s: number; l: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h = 0, s = 0
    const l = (max + min) / 2
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / d + 2) / 6; break
        case b: h = ((r - g) / d + 4) / 6; break
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
  }

  const saveCustomPreset = () => {
    if (!newPresetForm.name.trim()) return
    const primary = hexToHSL(newPresetForm.primary)
    const bg = hexToHSL(newPresetForm.background)
    const glow = hexToHSL(newPresetForm.glow)
    const newTheme: HMITheme = {
      id: `custom-${Date.now()}`,
      name: newPresetForm.name.trim(),
      description: newPresetForm.description.trim() || '自定义主题',
      preview: {
        gradient: 'from-primary/60 to-primary/30',
        bg: 'bg-primary/10 border-primary/20',
        primaryHex: newPresetForm.primary,
      },
      colors: {
        background: bg,
        surface: { h: bg.h, s: bg.s, l: Math.min(bg.l + 3, 100) },
        surfaceSecondary: { h: bg.h, s: bg.s, l: Math.min(bg.l + 6, 100) },
        surfaceTertiary: { h: bg.h, s: bg.s, l: Math.min(bg.l + 10, 100) },
        foreground: { h: primary.h, s: 12, l: 92 },
        mutedForeground: { h: primary.h, s: 6, l: 52 },
        primary,
        primaryForeground: bg,
        glow,
        glowSubtle: { h: glow.h, s: Math.round(glow.s * 0.55), l: Math.round(glow.l * 0.45) },
        secondary: { h: bg.h, s: Math.min(bg.s + 10, 100), l: Math.min(bg.l + 10, 100) },
        secondaryForeground: { h: primary.h, s: 10, l: 88 },
        accent: { h: bg.h, s: bg.s, l: Math.min(bg.l + 8, 100) },
        accentForeground: { h: primary.h, s: 12, l: 92 },
        card: { h: bg.h, s: bg.s, l: Math.min(bg.l + 3.5, 100) },
        cardForeground: { h: primary.h, s: 12, l: 92 },
        popover: { h: bg.h, s: bg.s, l: Math.min(bg.l + 3, 100) },
        popoverForeground: { h: primary.h, s: 12, l: 92 },
        muted: { h: bg.h, s: bg.s, l: Math.min(bg.l + 7, 100) },
        destructive: { h: 0, s: 72, l: 51 },
        destructiveForeground: { h: 0, s: 5, l: 97 },
        border: { h: bg.h, s: Math.max(bg.s - 2, 0), l: Math.min(bg.l + 9, 100) },
        input: { h: bg.h, s: Math.max(bg.s - 2, 0), l: Math.min(bg.l + 9, 100) },
        ring: primary,
      },
    }
    const updated = [...customPresets, newTheme]
    setCustomPresets(updated)
    localStorage.setItem('hmi-custom-presets', JSON.stringify(updated))
    setShowAddPreset(false)
    setNewPresetForm({ name: '', description: '', primary: '#9b7dff', background: '#080c14', glow: '#b89fff', surface: '#0d1226' })
  }

  const deleteCustomPreset = (id: string) => {
    const updated = customPresets.filter(p => p.id !== id)
    setCustomPresets(updated)
    localStorage.setItem('hmi-custom-presets', JSON.stringify(updated))
  }

  const handleAnalyze = async () => {
    if (!editImage) return

    if (!isLoggedIn) {
      navigate('/login?return=/workspace')
      return
    }

    // Check Ark API key
    const loginStatus = await checkLoginStatus()
    if (!loginStatus.ok) {
      const wasConfigured = (() => {
        try {
          const s = localStorage.getItem('api_config_status')
          if (s) {
            const cfg = JSON.parse(s)
            return cfg.provider === 'jimeng' || cfg.provider === 'ark'
          }
        } catch {}
        return false
      })()
      if (wasConfigured) {
        setEditError('API 验证失败，可能是网络问题或 Key 已过期，请先在设置中重新配置')
      } else {
        setEditError('请先在设置中配置火山方舟 API Key')
      }
      setSettingsOpen(true)
      return
    } else {
      localStorage.setItem('api_config_status', JSON.stringify({ provider: 'jimeng', configuredAt: Date.now() }))
    }
    // Check vision endpoint
    try {
      const vs = await fetch('/api/hmi/vision_status')
      const vd = await vs.json()
      if (!vd.ok) {
        setEditError('请先在设置中配置视觉模型推理接入点（Endpoint ID）')
        setSettingsOpen(true)
        return
      }
    } catch {
      setEditError('无法检查视觉模型配置')
      setSettingsOpen(true)
      return
    }

    setEditAnalyzing(true)
    setEditError(null)
    setEditResult(null)

    try {
      const resp = await fetch('/api/hmi/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: editSubMode, image_base64: editImage }),
      })
      const data = await resp.json()
      if (data.ok) {
        if (editSubMode === 'png2svg') {
          // 使用 AI 直接返回的 SVG 代码
          const svgResult = processAIResult(data.result || data)
          setEditResult(svgResult)
        } else {
          setEditResult((data.result as TextExtractResult) || { regions: [], summary: '' })
        }
      } else {
        setEditError(data.error || '分析失败')
      }
    } catch (err) {
      setEditError(`请求异常: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setEditAnalyzing(false)
    }
  }

  // 复制状态追踪
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const handleCopySVG = async (svgComp: SVGComponent) => {
    const success = await copySVGCode(svgComp.normalizedSvg)
    if (success) {
      setCopiedId(svgComp.id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  // 判断是否为 SVG 结果
  const isSVGResult = (result: EditResultType): result is EditSVGResult => {
    return 'svgComponents' in result
  }

  // 判断是否为文本提取结果
  const isTextResult = (result: EditResultType): result is TextExtractResult => {
    return 'regions' in result
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden relative">
      {/* Background atmosphere */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.04) 0%, transparent 60%)',
        }}
      />

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">加载中...</div>}>
              <CreationDashboard
                records={historyRecords}
                onOpenProject={() => onTabChange?.('preview')}
                onStartGenerate={() => onTabChange?.('generate')}
                onDeleteRecords={onDeleteRecords}
                onNavigateToHmi={() => onTabChange?.('generate')}
                onNavigateToWallpaper={() => onTabChange?.('ai-wallpaper')}
              />
              </Suspense>
            </motion.div>
          )}
          {activeTab === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="h-full flex flex-col"
            >
              {/* Quick Actions */}
              <div className="flex items-center gap-3 mb-4">
                <Button
                  variant="glow"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onTabChange?.('generate')}
                >
                  <Sparkles size={12} />
                  AI 生成座舱
                </Button>
                <Button variant="glass" size="sm" className="gap-1.5" onClick={() => onTabChange?.('theme')}>
                  <Palette size={12} />
                  智能换色
                </Button>
                <Button variant="glass" size="sm" className="gap-1.5" onClick={() => onTabChange?.('check')}>
                  <CheckCircle2 size={12} />
                  设计自检
                </Button>
                <Button variant="glass" size="sm" className="gap-1.5" onClick={() => onTabChange?.('export')}>
                  <Download size={12} />
                  导出资源
                </Button>
              </div>

              {/* HMI Dashboard Preview */}
              <div className="flex-1 flex items-center justify-center">
                <div className="w-full max-w-5xl">
                  <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground text-sm">加载中...</div>}>
                  <HMIPreview />
                  </Suspense>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'generate' && (
            <motion.div
              key="generate"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="max-w-3xl mx-auto space-y-6"
            >
              <div className="flex items-start justify-between">
                <div className="text-center space-y-2 flex-1">
                  <h2 className="text-xl font-semibold text-foreground">AI 生成 HMI</h2>
                  <p className="text-sm text-muted-foreground">AI 驱动的智能座舱 HMI 设计生成</p>
                  {/* Quick Check Items */}
                  <div className="flex flex-wrap gap-2 justify-center mt-3">
                    {checkItemsByCategory['generate'].map((item) => (
                      <CheckBadge
                        key={item.id}
                        type={item.type}
                        label={item.label}
                        detail={item.detail}
                        compact
                      />
                    ))}
                  </div>

                  {/* Engine Toggle */}
                  <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.06)]">
                    {(['jimeng', 'openai'] as const).map((e) => (
                      <button
                        key={e}
                        onClick={() => setEngine(e)}
                        className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                          engine === e
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {e === 'jimeng' ? '即梦 Seedream' : 'GPT 图像'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {genError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400 text-xs"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="flex-1">{genError}</span>
                  <button onClick={() => setGenError(null)} className="hover:text-red-300 transition-colors">
                    <X size={12} />
                  </button>
                </motion.div>
              )}

              {/* Reference Image Upload */}
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <ImagePlus size={12} />
                    <span>参考图</span>
                  </div>
                  {refImage && (
                    <button
                      onClick={removeRefImage}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X size={10} />
                      移除
                    </button>
                  )}
                </div>

                {refImage ? (
                  <div className="relative rounded-lg overflow-hidden border border-[hsl(var(--primary)/0.15)] glow-primary-sm">
                    <img
                      src={refImage}
                      alt="Reference"
                      className="w-full max-h-48 object-contain bg-[hsl(var(--surface-secondary)/0.5)]"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 flex items-center justify-between">
                      <span className="text-[10px] text-foreground/80 truncate">{refImageName}</span>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                      >
                        更换图片
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleImageDrop}
                    className="flex flex-col items-center justify-center gap-3 py-8 rounded-lg border border-dashed border-[hsl(var(--foreground)/0.1)] bg-[hsl(var(--surface-secondary)/0.3)] cursor-pointer hover:border-[hsl(var(--primary)/0.25)] hover:bg-[hsl(var(--primary)/0.03)] transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-200">
                      <Upload size={16} className="text-primary/50 group-hover:text-primary/70 transition-colors" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-foreground/70">点击上传或拖拽图片到此处</p>
                      <p className="text-[10px] text-muted-foreground mt-1">支持 PNG、JPG、WEBP 格式，作为风格参考</p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {/* Prompt Input */}
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-primary">
                  <Wand2 size={12} />
                  <span>AI Prompt</span>
                </div>
                <textarea
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="描述你想要的座舱界面，例如：设计一套极简风格的仪表盘界面，深色主题，包含速度、电量、导航、媒体控制..."
                  className="w-full h-28 bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--foreground)/0.06)] rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[hsl(var(--primary)/0.3)] focus:ring-1 focus:ring-[hsl(var(--primary)/0.15)] resize-none transition-all duration-200"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setSizeDropdownOpen(v => !v)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--foreground)/0.06)] text-[10px] text-foreground hover:border-[hsl(var(--primary)/0.2)] transition-all duration-200"
                      >
                        {genCustomSize ? (
                          <>⚙ 自定义 {genCustomWidth}×{genCustomHeight}</>
                        ) : (
                          <>{SIZE_PRESETS.find(p => p.ratio === genRatio)?.icon} {genRatio} · {genResolution}</>
                        )}
                        <ChevronDown size={10} className={`transition-transform duration-200 ${sizeDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {sizeDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setSizeDropdownOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: -4, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -4, scale: 0.97 }}
                              transition={{ duration: 0.15 }}
                              className="absolute top-full left-0 mt-1 z-50 min-w-[220px] rounded-xl bg-[hsl(var(--surface)/0.95)] backdrop-blur-xl border border-[hsl(var(--foreground)/0.08)] shadow-xl shadow-black/20 overflow-hidden"
                            >
                              {SIZE_PRESETS.map((preset) => {
                                const isActive = !genCustomSize && genRatio === preset.ratio
                                return (
                                  <div key={preset.ratio}>
                                    <button
                                      onClick={() => {
                                        setGenRatio(preset.ratio)
                                        setGenResolution(preset.resolutions[0])
                                        setGenCustomSize(false)
                                        setSizeDropdownOpen(false)
                                      }}
                                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-all duration-150 ${
                                        isActive
                                          ? 'bg-primary/10 text-primary'
                                          : 'text-foreground hover:bg-[hsl(var(--foreground)/0.04)]'
                                      }`}
                                    >
                                      <span className="text-xs w-5 text-center">{preset.icon}</span>
                                      <span className="text-[11px] font-medium flex-1">{preset.ratio}</span>
                                      {isActive && <CheckCircle2 size={10} className="text-primary" />}
                                    </button>
                                    {isActive && (
                                      <div className="flex items-center gap-1 px-3 pb-2 pl-10">
                                        {preset.resolutions.map((res) => (
                                          <button
                                            key={res}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setGenResolution(res)
                                            }}
                                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-150 ${
                                              genResolution === res
                                                ? 'bg-primary/15 text-primary border border-primary/25'
                                                : 'bg-[hsl(var(--surface-secondary)/0.4)] text-muted-foreground border border-transparent hover:text-foreground'
                                            }`}
                                          >
                                            {res}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                              <div className="border-t border-[hsl(var(--foreground)/0.06)]">
                                <button
                                  onClick={() => {
                                    setGenCustomSize(true)
                                    setSizeDropdownOpen(false)
                                  }}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-all duration-150 ${
                                    genCustomSize
                                      ? 'bg-primary/10 text-primary'
                                      : 'text-foreground hover:bg-[hsl(var(--foreground)/0.04)]'
                                  }`}
                                >
                                  <span className="text-xs w-5 text-center">⚙</span>
                                  <span className="text-[11px] font-medium flex-1">自定义尺寸</span>
                                  {genCustomSize && <CheckCircle2 size={10} className="text-primary" />}
                                </button>
                                {genCustomSize && (
                                  <div className="flex items-center gap-1.5 px-3 pb-2 pl-10">
                                    <input
                                      type="number"
                                      value={genCustomWidth}
                                      onChange={(e) => setGenCustomWidth(Math.max(256, Math.min(4096, parseInt(e.target.value) || 256)))}
                                      className="w-16 h-6 rounded-md bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--foreground)/0.08)] px-2 text-[10px] text-foreground text-center focus:outline-none focus:border-primary/40"
                                      min={256}
                                      max={4096}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="text-[10px] text-muted-foreground">×</span>
                                    <input
                                      type="number"
                                      value={genCustomHeight}
                                      onChange={(e) => setGenCustomHeight(Math.max(256, Math.min(4096, parseInt(e.target.value) || 256)))}
                                      className="w-16 h-6 rounded-md bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--foreground)/0.08)] px-2 text-[10px] text-foreground text-center focus:outline-none focus:border-primary/40"
                                      min={256}
                                      max={4096}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="text-[9px] text-muted-foreground/50">px</span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-primary/5 border border-primary/10 text-primary text-[10px]">{engine === 'jimeng' ? '即梦引擎' : 'GPT 图像'}</span>
                    {refImage && (
                      <span className="px-1.5 py-0.5 rounded bg-primary/5 border border-primary/10 text-primary text-[10px] flex items-center gap-0.5">
                        <ImageIcon size={8} />
                        参考图
                      </span>
                    )}
                  </div>
                  <Button
                    variant="glow"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={isGenerating || (!promptInput.trim() && !refImage)}
                    className="gap-1.5"
                  >
                    {isGenerating ? (
                      <>
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <Zap size={12} />
                        </motion.span>
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        生成 HMI
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Quick Prompts */}
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">快捷提示词</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    '极简风格仪表盘',
                    '保时捷 HMI 简约座舱',
                    '特斯拉极简中控',
                    '蔚来空间感 UI',
                    '未来科技座舱',
                    '豪华新能源界面',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setPromptInput(prompt)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--foreground)/0.06)] text-muted-foreground hover:text-foreground hover:border-[hsl(var(--primary)/0.2)] transition-all duration-200"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generated Results */}
              {generatedImages.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      生成结果 ({generatedImages.length})
                      {isVerifyingSize && <span className="ml-2 text-primary animate-pulse">· 尺寸校验中…</span>}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] text-muted-foreground hover:text-foreground h-6"
                      onClick={() => setGeneratedImages([])}
                    >
                      清空
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {generatedImages.map((img, i) => {
                      const vr = sizeVerifyResults[img]
                      const isMatch = vr?.verify.match
                      const wasAdjusted = !!vr?.adjusted
                      return (
                        <div
                          key={i}
                          className="rounded-xl overflow-hidden border border-[hsl(var(--foreground)/0.06)] relative group cursor-pointer hover:border-[hsl(var(--primary)/0.2)] transition-all duration-300"
                          style={{ aspectRatio: vr ? `${vr.verify.expected.width} / ${vr.verify.expected.height}` : '16 / 9' }}
                        >
                          <img
                            src={vr?.finalUrl || img}
                            alt={`Generated HMI ${i + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {/* 尺寸校验状态徽章 */}
                          {vr && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium backdrop-blur-md border">
                              {isMatch ? (
                                <span className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 px-2 py-0.5 rounded-md">✓ {vr.verify.actual.width}×{vr.verify.actual.height}</span>
                              ) : wasAdjusted ? (
                                <span className="bg-amber-500/20 text-amber-400 border-amber-500/30 px-2 py-0.5 rounded-md" title={`原始 ${vr.verify.actual.width}×${vr.verify.actual.height} → 已调整为 ${vr.verify.expected.width}×${vr.verify.expected.height}`}>⚙ 已调整</span>
                              ) : (
                                <span className="bg-red-500/20 text-red-400 border-red-500/30 px-2 py-0.5 rounded-md" title={`预期 ${vr.verify.expected.width}×${vr.verify.expected.height} | 实际 ${vr.verify.actual.width}×${vr.verify.actual.height} | 偏差 ${vr.verify.deviationPercent.toFixed(1)}%`}>✗ {vr.verify.actual.width}×{vr.verify.actual.height}</span>
                              )}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-foreground">方案 {i + 1}</span>
                              {vr && !isMatch && !wasAdjusted && (
                                <Button
                                  variant="glow"
                                  size="sm"
                                  className="h-6 text-[10px] gap-1"
                                  onClick={async () => {
                                    const preset = buildPresetSizeFromSelection()
                                    const adj = await adjustImageToSize(img, preset)
                                    setSizeVerifyResults(prev => ({ ...prev, [img]: { ...prev[img]!, finalUrl: adj.dataUrl, adjusted: adj } }))
                                  }}
                                >
                                  <Maximize2 size={10} />
                                  调整尺寸
                                </Button>
                              )}
                              <Button
                                variant="glow"
                                size="sm"
                                className="h-6 text-[10px] gap-1"
                                onClick={() => handleDownload(vr?.finalUrl || img, i)}
                              >
                                <Download size={10} />
                                下载 PNG
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* 尺寸对比详情卡片 */}
                  {Object.keys(sizeVerifyResults).length > 0 && (
                    <div className="rounded-xl border border-[hsl(var(--foreground)/0.06)] bg-[hsl(var(--surface-secondary)/0.3)] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">尺寸校验详情</span>
                        <span className="text-[10px] text-muted-foreground">
                          预期: {(() => { const p = buildPresetSizeFromSelection(); return `${p.label} ${p.width}×${p.height}`; })()}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {Object.entries(sizeVerifyResults).map(([url, vr]) => {
                          if (!vr) return null
                          return (
                            <div key={url} className="flex items-center gap-2 text-[10px]">
                              <span className="text-muted-foreground">·</span>
                              <span className="text-foreground font-medium">预期 {vr.verify.expected.width}×{vr.verify.expected.height}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className={vr.verify.match ? 'text-emerald-400' : 'text-amber-400'}>
                                实际 {vr.verify.actual.width || '?'}×{vr.verify.actual.height || '?'}
                              </span>
                              <span className="text-muted-foreground">
                                {vr.verify.match ? '一致' : `偏差 ${vr.verify.deviationPercent.toFixed(1)}%${vr.adjusted ? ' (已调整)' : ''}`}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* HMI History Records */}
              {historyRecords.filter(r => r.category === 'hmi').length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">HMI 创作记录</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] text-muted-foreground hover:text-foreground h-6"
                      onClick={() => onNavigate?.('dashboard')}
                    >
                      查看全部
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {historyRecords.filter(r => r.category === 'hmi').slice(0, 4).map((record) => (
                      <div
                        key={record.id}
                        className="rounded-xl overflow-hidden border border-[hsl(var(--foreground)/0.06)] aspect-video relative group cursor-pointer hover:border-[hsl(var(--primary)/0.2)] transition-all duration-300"
                      >
                        {record.images[0] && (
                          <img
                            src={getProxyImageUrl(record.images[0])}
                            alt={record.prompt}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-foreground truncate">{record.prompt.slice(0, 25)}</p>
                            <p className="text-[9px] text-white/50">{new Date(record.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

          </motion.div>
          )}

          {activeTab === 'edit' && editSubMode === 'png2svg' && (
            <div className="max-w-6xl mx-auto mb-5 flex gap-3">
              <Button variant={editWorkflow === 'trace' ? 'glow' : 'outline'} onClick={() => setEditWorkflow('trace')}>位图矢量描摹</Button>
              <Button variant={editWorkflow === 'ai' ? 'glow' : 'outline'} onClick={() => setEditWorkflow('ai')}>AI 组件识别</Button>
            </div>
          )}
          {activeTab === 'edit' && editSubMode === 'png2svg' && editWorkflow === 'trace' && <VectorTracePanel />}
          {activeTab === 'edit' && (editSubMode !== 'png2svg' || editWorkflow === 'ai') && (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="max-w-3xl mx-auto space-y-6"
            >
              <div className="flex items-start justify-between">
                <div className="text-center space-y-2 flex-1">
                  <div className="flex items-center justify-center gap-3">
                    <h2 className="text-xl font-semibold text-foreground">
                      {editSubMode === 'png2svg' ? 'PNG 生成 SVG' : '文本提取'}
                    </h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditSubMode(editSubMode === 'png2svg' ? 'text_extract' : 'png2svg')}
                      className="h-7 text-xs"
                    >
                      切换到 {editSubMode === 'png2svg' ? '文本提取' : 'PNG 生成 SVG'}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {editSubMode === 'png2svg'
                      ? '上传 HMI 界面截图，AI 自动识别并生成可编辑的 SVG 组件'
                      : '上传 HMI 界面截图，AI 自动识别并提取所有文本内容'}
                  </p>
                  {/* Quick Check Items */}
                  <div className="flex flex-wrap gap-2 justify-center mt-3">
                    {checkItemsByCategory['edit'].map((item) => (
                      <CheckBadge
                        key={item.id}
                        type={item.type}
                        label={item.label}
                        detail={item.detail}
                        compact
                      />
                    ))}
                  </div>
                </div>
                <Button
                  variant="glass"
                  size="icon-sm"
                  onClick={() => setSettingsOpen(true)}
                  className="shrink-0 ml-3 mt-1"
                  title="API 设置"
                >
                  <Settings2 size={14} />
                </Button>
              </div>

              {/* Error */}
              {editError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400 text-xs">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="flex-1">{editError}</span>
                  <button onClick={() => setEditError(null)} className="hover:text-red-300"><X size={12} /></button>
                </div>
              )}

              {/* Image Upload */}
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <Upload size={12} />
                    <span>{editSubMode === 'png2svg' ? '上传 HMI 界面截图' : '上传需要提取文本的截图'}</span>
                  </div>
                  {editImage && (
                    <button onClick={removeEditImage} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive">
                      <X size={10} />移除
                    </button>
                  )}
                </div>

                {editImage ? (
                  <div className="relative rounded-lg overflow-hidden border border-[hsl(var(--primary)/0.15)]">
                    <img src={editImage} alt="Upload" className="w-full max-h-64 object-contain bg-[hsl(var(--surface-secondary)/0.5)]" />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 flex items-center justify-between">
                      <span className="text-[10px] text-foreground/80 truncate">{editImageName}</span>
                      <button onClick={() => editFileRef.current?.click()} className="text-[10px] text-primary hover:text-primary/80">更换</button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => editFileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith('image/')) { const r = new FileReader(); r.onload = (ev) => { setEditImage(ev.target?.result as string); setEditImageName(f.name) }; r.readAsDataURL(f) } }}
                    className="flex flex-col items-center justify-center gap-3 py-10 rounded-lg border border-dashed border-[hsl(var(--foreground)/0.1)] bg-[hsl(var(--surface-secondary)/0.3)] cursor-pointer hover:border-[hsl(var(--primary)/0.25)] hover:bg-[hsl(var(--primary)/0.03)] transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Upload size={16} className="text-primary/50 group-hover:text-primary/70" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-foreground/70">点击上传或拖拽图片到此处</p>
                      <p className="text-[10px] text-muted-foreground mt-1">支持 PNG、JPG 格式的 HMI 界面截图</p>
                    </div>
                  </div>
                )}
                <input ref={editFileRef} type="file" accept="image/*" onChange={handleEditImageUpload} className="hidden" />
              </div>

              {/* Analyze Button */}
              <Button
                variant="glow"
                size="sm"
                onClick={handleAnalyze}
                disabled={editAnalyzing || !editImage}
                className="w-full gap-1.5"
              >
                {editAnalyzing ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    生成中...
                  </>
                ) : editSubMode === 'png2svg' ? (
                  <>
                    <Layers size={12} />
                    生成 SVG 组件
                  </>
                ) : (
                  <>
                    <FileText size={12} />
                    开始提取文本
                  </>
                )}
              </Button>

              {/* Result */}
              {editResult && (
                <div className="glass rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-primary">
                      <CheckCircle2 size={12} />
                      <span className="font-medium">
                        {editSubMode === 'png2svg' ? 'SVG 组件生成结果' : '文本提取结果'}
                      </span>
                      {isSVGResult(editResult) && (
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[9px] text-primary">
                          {editResult.svgComponents.length} 个组件
                        </span>
                      )}
                    </div>
                    {isSVGResult(editResult) && editResult.svgComponents.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] h-6 gap-1"
                        onClick={() => downloadAllSVGComponents(editResult.svgComponents)}
                      >
                        <Download size={10} />
                        导出全部 SVG
                      </Button>
                    )}
                  </div>

                  {/* PNG → SVG: AI 直接生成的 SVG 组件 */}
                  {isSVGResult(editResult) && editResult.svgComponents.length > 0 && (
                    <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                      {/* 类型统计概览 - 按类型分组显示数量 */}
                      {(() => {
                        const typeGroups = editResult.svgComponents.reduce((acc, comp) => {
                          const key = comp.category
                          if (!acc[key]) acc[key] = { label: comp.categoryLabel, color: getCategoryColor(comp.category), count: 0 }
                          acc[key].count++
                          return acc
                        }, {} as Record<string, { label: string; color: string; count: number }>)
                        return (
                          <div className="flex flex-wrap gap-2 p-3 bg-[hsl(var(--surface-secondary)/0.3)] rounded-lg">
                            {Object.entries(typeGroups).map(([cat, info]) => (
                              <span
                                key={cat}
                                className="px-2 py-1 rounded text-[10px] flex items-center gap-1"
                                style={{
                                  backgroundColor: `${info.color}15`,
                                  color: info.color,
                                  border: `1px solid ${info.color}30`,
                                }}
                              >
                                <Component size={8} />
                                {info.label}
                                <span className="text-[9px] opacity-70">×{info.count}</span>
                              </span>
                            ))}
                            <span className="ml-auto text-[10px] text-muted-foreground self-center">
                              共 {editResult.svgComponents.length} 个切图元素
                            </span>
                          </div>
                        )
                      })()}

                      {/* 独立 SVG 切图卡片 - 紧凑网格布局 */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {editResult.svgComponents.map((svgComp) => (
                        <div
                          key={svgComp.id}
                          className="bg-[hsl(var(--surface-secondary)/0.4)] rounded-lg overflow-hidden border border-[hsl(var(--foreground)/0.06)] flex flex-col"
                        >
                          {/* 组件头部 - 紧凑 */}
                          <div className="flex items-center justify-between px-2 py-1.5 border-b border-[hsl(var(--foreground)/0.04)]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div
                                className="w-4 h-4 rounded flex-shrink-0 items-center justify-center flex"
                                style={{ backgroundColor: `${getCategoryColor(svgComp.category)}25` }}
                              >
                                <Component size={8} style={{ color: getCategoryColor(svgComp.category) }} />
                              </div>
                              <span className="text-[11px] font-medium text-foreground truncate" title={svgComp.name}>{svgComp.name}</span>
                            </div>
                            <span className="text-[9px] text-muted-foreground flex-shrink-0 ml-1">
                              {svgComp.width}×{svgComp.height}
                            </span>
                          </div>

                          {/* SVG 预览 - 棋盘格背景，小元素居中 */}
                          <div
                            className="p-2 flex items-center justify-center flex-1"
                            style={{
                              minHeight: '90px',
                              backgroundImage: 'linear-gradient(45deg, #334155 25%, transparent 25%), linear-gradient(-45deg, #334155 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #334155 75%), linear-gradient(-45deg, transparent 75%, #334155 75%)',
                              backgroundSize: '10px 10px',
                              backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                              backgroundColor: '#1e293b',
                            }}
                          >
                            <svg
                              viewBox={`0 0 ${svgComp.width} ${svgComp.height}`}
                              className="max-w-full max-h-[100px]"
                              style={{
                                maxWidth: '85%',
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                              }}
                              preserveAspectRatio="xMidYMid meet"
                              dangerouslySetInnerHTML={{ __html: svgComp.innerContent }}
                            />
                          </div>

                          {/* 操作按钮 - 紧凑 */}
                          <div className="flex items-center border-t border-[hsl(var(--foreground)/0.04)] divide-x divide-[hsl(var(--foreground)/0.04)]">
                            <button
                              className="flex-1 py-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--foreground)/0.04)] transition-colors flex items-center justify-center gap-1"
                              onClick={() => handleCopySVG(svgComp)}
                            >
                              {copiedId === svgComp.id ? (
                                <><Check size={9} className="text-emerald-400" />已复制</>
                              ) : (
                                <><Copy size={9} />复制</>
                              )}
                            </button>
                            <button
                              className="flex-1 py-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--foreground)/0.04)] transition-colors flex items-center justify-center gap-1"
                              onClick={() => downloadSVGComponent(svgComp)}
                            >
                              <Download size={9} />导出
                            </button>
                          </div>

                          {/* SVG 代码预览 - 折叠 */}
                          <details className="border-t border-[hsl(var(--foreground)/0.04)]">
                            <summary className="px-2 py-1 text-[9px] text-muted-foreground cursor-pointer hover:text-foreground text-center">
                              代码
                            </summary>
                            <pre className="px-2 pb-2 text-[8px] text-muted-foreground overflow-x-auto max-h-24 overflow-y-auto whitespace-pre-wrap break-all font-mono bg-[hsl(var(--surface-secondary)/0.3)]">
                              {svgComp.normalizedSvg}
                            </pre>
                          </details>
                        </div>
                        ))}
                      </div>

                      {/* 导出全部按钮 */}
                      <div className="flex justify-center pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-xs"
                          onClick={() => downloadAllSVGComponents(editResult.svgComponents)}
                        >
                          <Download size={12} />
                          导出全部 {editResult.svgComponents.length} 个 SVG 切图
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* PNG → SVG: 错误状态 - 显示原始图片和提示 */}
                  {isSVGResult(editResult) && (editResult.hasError || editResult.svgComponents.length === 0) && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                        <AlertCircle size={14} />
                        <span>{editResult.errorMessage || editResult.summary || '未能识别图片中的组件'}</span>
                      </div>

                      {editImage && (
                        <div className="bg-[hsl(var(--surface-secondary)/0.3)] rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground mb-2">原始上传图片：</p>
                          <div className="border border-[hsl(var(--foreground)/0.06)] rounded-lg overflow-hidden">
                            <img
                              src={editImage}
                              alt="上传的 HMI 界面"
                              className="w-full h-auto max-h-[250px] object-contain"
                            />
                          </div>
                        </div>
                      )}

                      {/* 原始AI输出调试信息 */}
                      {editResult._raw && (
                        <details className="bg-[hsl(var(--surface-secondary)/0.2)] rounded-lg">
                          <summary className="px-3 py-2 text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                            查看 AI 原始输出（调试用）
                          </summary>
                          <pre className="px-3 pb-3 text-[9px] text-muted-foreground overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all font-mono border-t border-[hsl(var(--foreground)/0.06)] pt-2">
                            {editResult._raw}
                          </pre>
                        </details>
                      )}

                      <p className="text-[10px] text-muted-foreground">
                        提示：请确保上传清晰完整的车载 HMI 界面截图。如果仍有问题，可以尝试重新生成。
                      </p>
                    </div>
                  )}

                  {/* Text Extract: Region groups */}
                  {isTextResult(editResult) && editResult.regions && (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {editResult.regions.map((region: EditRegion, i: number) => (
                        <div key={i} className="bg-[hsl(var(--surface-secondary)/0.4)] rounded-lg p-3">
                          <div className="text-xs font-medium text-foreground mb-2">{region.name}</div>
                          <div className="space-y-1">
                            {region.texts?.map((t: { type: string; content: string; description?: string }, j: number) => (
                              <div key={j} className="flex items-center gap-2 text-[11px]">
                                <span className="px-1 py-0.5 rounded text-[9px] bg-primary/10 text-primary">{t.type}</span>
                                <span className="text-foreground">{t.content}</span>
                                {t.description && <span className="text-muted-foreground text-[10px]">— {t.description}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary */}
                  {editResult.summary && (
                    <p className="text-[11px] text-muted-foreground border-t border-[hsl(var(--foreground)/0.06)] pt-2">
                      {editResult.summary}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'theme' && (
            <motion.div
              key="theme"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="max-w-3xl mx-auto space-y-5"
            >
              {/* ── Header + Sub-nav ── */}
              <div className="flex items-center justify-between">
                <div>
                  {themeSubMode === 'figma-swap' ? null : (
                    <>
                      <h2 className="text-xl font-semibold text-foreground">{themeSubMode === 'recolor' ? 'AI智能换色' : '主题工作室'}</h2>
                      {themeSubMode !== 'recolor' && (
                        <p className="text-sm text-muted-foreground mt-0.5">个性化定制你的 HMI 界面配色风格</p>
                      )}
                    </>
                  )}
                  {/* Quick Check Items */}
                  {checkItemsByCategory['theme'].length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-start mt-3">
                      {checkItemsByCategory['theme'].map((item) => (
                        <CheckBadge
                          key={item.id}
                          type={item.type}
                          label={item.label}
                          detail={item.detail}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </div>
                {themeSubMode !== 'figma-swap' && (
                <div className="flex items-center p-0.5 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.06)]">
                  {(['preset', 'recolor'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setThemeSubMode(mode)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                        themeSubMode === mode
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {mode === 'preset' ? (
                        <><Palette size={11} /> 主题预设</>
                      ) : (
                        <><Wand2 size={11} /> AI 换色</>
                      )}
                    </button>
                  ))}
                </div>
                )}
              </div>

              {/* ══════════ 主题预设 ══════════ */}
              {themeSubMode === 'preset' && (
                <>
                  {/* Theme cards grid header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">共 {themes.length + customPresets.length} 个预设</span>
                    <button
                      onClick={() => setShowAddPreset(v => !v)}
                      className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/70 transition-colors"
                    >
                      <Plus size={11} />
                      添加预设
                    </button>
                  </div>

                  {/* Add preset inline form */}
                  <AnimatePresence>
                    {showAddPreset && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="glass rounded-xl p-4 space-y-3">
                          <span className="text-xs font-medium text-foreground">新建预设</span>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={newPresetForm.name}
                              onChange={e => setNewPresetForm(f => ({ ...f, name: e.target.value }))}
                              placeholder="预设名称（必填）"
                              className="h-8 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.08)] px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                            />
                            <input
                              value={newPresetForm.description}
                              onChange={e => setNewPresetForm(f => ({ ...f, description: e.target.value }))}
                              placeholder="描述（可选）"
                              className="h-8 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.08)] px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                            />
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {([
                              { key: 'primary', label: '主色调' },
                              { key: 'background', label: '背景色' },
                              { key: 'glow', label: '辉光色' },
                              { key: 'surface', label: '表面色' },
                            ] as { key: keyof typeof newPresetForm; label: string }[]).map(({ key, label }) => (
                              <div key={key} className="space-y-1 text-center">
                                <div className="relative w-full h-8 rounded-lg overflow-hidden border border-[hsl(var(--foreground)/0.08)]">
                                  <input
                                    type="color"
                                    value={newPresetForm[key]}
                                    onChange={e => setNewPresetForm(f => ({ ...f, [key]: e.target.value }))}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                  <div className="w-full h-full" style={{ background: newPresetForm[key] }} />
                                </div>
                                <span className="text-[9px] text-muted-foreground">{label}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => setShowAddPreset(false)}
                              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >取消</button>
                            <Button
                              variant="glow"
                              size="sm"
                              onClick={saveCustomPreset}
                              disabled={!newPresetForm.name.trim()}
                            >保存预设</Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Theme cards grid: built-in + custom */}
                  <div className="grid grid-cols-3 gap-3">
                    {[...themes, ...customPresets].map((theme) => {
                      const isCustom = theme.id.startsWith('custom-')
                      const isSelected = selectedPresetId === theme.id
                      return (
                        <div key={theme.id} className="relative group/presetcard">
                          <button
                            onClick={() => setSelectedPresetId(theme.id)}
                            className={`w-full relative rounded-xl overflow-hidden border text-left transition-all duration-300 glass ${isSelected ? 'border-primary/50 ring-1 ring-primary/30' : 'hover:border-[hsl(var(--foreground)/0.12)]'}`}
                          >
                            {/* Gradient preview area */}
                            <div
                              className={isCustom ? 'h-28 relative overflow-hidden' : `h-28 bg-gradient-to-br ${theme.preview.gradient} relative overflow-hidden`}
                              style={isCustom ? {
                                background: `linear-gradient(135deg, ${theme.preview.primaryHex}, ${theme.preview.primaryHex}66)`,
                              } : undefined}
                            >
                              {/* Mini HMI hint elements */}
                              <div className="absolute inset-0 p-3 flex flex-col justify-end gap-1.5">
                                <div className="flex items-end gap-1.5">
                                  <div className="h-1 flex-1 rounded-full bg-white/25" />
                                  <div className="h-2 w-1/3 rounded-full bg-white/35" />
                                  <div className="h-1.5 flex-1 rounded-full bg-white/20" />
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                                    <div className="w-4 h-4 rounded-full bg-white/35" />
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <div className="h-1 w-3/4 rounded bg-white/25" />
                                    <div className="h-1 w-1/2 rounded bg-white/15" />
                                  </div>
                                  <div className="w-12 h-6 rounded-md bg-white/10 border border-white/15 shrink-0" />
                                </div>
                              </div>
                              {/* Active badge */}
                            </div>

                            {/* Card info */}
                            <div className="p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ background: theme.preview.primaryHex }}
                                />
                                <span className="text-xs font-semibold text-foreground">{theme.name}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                                {theme.description}
                              </p>
                              {/* Color swatches */}
                              <div className="flex items-center gap-1 pt-0.5">
                                {[
                                  theme.colors.background,
                                  theme.colors.surface,
                                  theme.colors.primary,
                                  theme.colors.glow,
                                  theme.colors.foreground,
                                ].map((c, i) => (
                                  <div
                                    key={i}
                                    className="w-5 h-5 rounded border border-white/10 shrink-0"
                                    style={{ background: `hsl(${c.h} ${c.s}% ${c.l}%)` }}
                                  />
                                ))}
                              </div>
                            </div>
                          </button>

                          {/* Delete button for custom presets */}
                          {isCustom && (
                            <button
                              onClick={() => deleteCustomPreset(theme.id)}
                              className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm text-white/70 hover:text-red-400 hover:bg-black/70 transition-colors items-center justify-center hidden group-hover/presetcard:flex"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Selected preset color token table */}
                  {(() => {
                    const selectedTheme = [...themes, ...customPresets].find(t => t.id === selectedPresetId)
                    if (!selectedTheme) return null
                    return (
                      <motion.div
                        key={selectedPresetId}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="glass rounded-xl p-5 space-y-4"
                      >
                        <div className="flex items-center gap-2">
                          <Layers size={13} className="text-primary" />
                          <span className="text-sm font-medium text-foreground">色彩规范</span>
                          <span className="text-xs text-muted-foreground">— {selectedTheme.name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          {([
                            { label: '背景色', key: 'background' },
                            { label: '表面色', key: 'surface' },
                            { label: '主色调', key: 'primary' },
                            { label: '辉光色', key: 'glow' },
                            { label: '前景色', key: 'foreground' },
                            { label: '次要文字', key: 'mutedForeground' },
                            { label: '边框色', key: 'border' },
                            { label: '强调色', key: 'accent' },
                          ] as { label: string; key: keyof typeof selectedTheme.colors }[]).map(({ label, key }) => {
                            const c = selectedTheme.colors[key]
                            return (
                              <div
                                key={key}
                                className="flex items-center gap-3 rounded-lg p-2.5 bg-[hsl(var(--surface-secondary)/0.4)] hover:bg-[hsl(var(--surface-secondary)/0.7)] transition-colors"
                              >
                                <div
                                  className="w-9 h-9 rounded-lg border border-white/10 shrink-0"
                                  style={{ background: `hsl(${c.h} ${c.s}% ${c.l}%)` }}
                                />
                                <div className="min-w-0">
                                  <div className="text-[11px] font-medium text-foreground truncate">{label}</div>
                                  <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                                    {`hsl(${c.h} ${c.s}% ${c.l}%)`}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </motion.div>
                    )
                  })()}
                </>
              )}

              {/* ══════════ AI 智能换色 ══════════ */}
              {themeSubMode === 'recolor' && (
                <>

              <div className="grid grid-cols-2 gap-4">
                {/* Left: Image Upload */}
                <div className="space-y-3">
                  <span className="text-xs font-medium text-foreground">导入图片</span>
                  <div
                    className="relative rounded-xl border-2 border-dashed border-[hsl(var(--foreground)/0.1)] hover:border-primary/40 transition-colors cursor-pointer overflow-hidden"
                    onClick={() => recolorFileRef.current?.click()}
                  >
                    {recolorImage ? (
                      <div className="relative">
                        <img src={recolorImage} alt="Source" className="w-full aspect-video object-contain bg-[hsl(var(--surface))]" />
                        <button
                          className="absolute top-2 right-2 p-1 rounded-lg bg-black/60 hover:bg-black/80 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setRecolorImage(null); setRecolorImageName('') }}
                        >
                          <X size={12} className="text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <Upload size={28} className="mb-2 opacity-40" />
                        <span className="text-xs">点击或拖拽上传 HMI 截图</span>
                        <span className="text-[10px] opacity-50 mt-1">支持 PNG / JPG</span>
                      </div>
                    )}
                    <input
                      ref={recolorFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = (ev) => {
                          setRecolorImage(ev.target?.result as string)
                          setRecolorImageName(file.name)
                        }
                        reader.readAsDataURL(file)
                        e.target.value = ''
                      }}
                    />
                  </div>
                </div>

                {/* Right: Text Input + Template */}
                <div className="space-y-3">
                  <span className="text-xs font-medium text-foreground">换色描述</span>
                  <textarea
                    value={recolorText}
                    onChange={(e) => setRecolorText(e.target.value)}
                    placeholder="可选补充：如「高亮按钮改为橙红」「背景加深对比度」等。注意：仅更换颜色，排版布局与内容保持不变。"
                    className="w-full h-24 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--border))] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">品牌配色模板</span>
                    <button
                      onClick={() => setShowAddPreset(v => !v)}
                      className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/70 transition-colors"
                    >
                      <Plus size={11} />
                      添加预设
                    </button>
                  </div>

                  {/* Add preset inline form */}
                  <AnimatePresence>
                    {showAddPreset && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="glass rounded-xl p-4 space-y-3">
                          <span className="text-xs font-medium text-foreground">新建预设</span>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={newPresetForm.name}
                              onChange={e => setNewPresetForm(f => ({ ...f, name: e.target.value }))}
                              placeholder="预设名称（必填）"
                              className="h-8 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.08)] px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                            />
                            <input
                              value={newPresetForm.description}
                              onChange={e => setNewPresetForm(f => ({ ...f, description: e.target.value }))}
                              placeholder="描述（可选）"
                              className="h-8 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.08)] px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                            />
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {([
                              { key: 'primary', label: '主色调' },
                              { key: 'background', label: '背景色' },
                              { key: 'glow', label: '辉光色' },
                              { key: 'surface', label: '表面色' },
                            ] as { key: keyof typeof newPresetForm; label: string }[]).map(({ key, label }) => (
                              <div key={key} className="space-y-1 text-center">
                                <div className="relative w-full h-8 rounded-lg overflow-hidden border border-[hsl(var(--foreground)/0.08)]">
                                  <input
                                    type="color"
                                    value={newPresetForm[key]}
                                    onChange={e => setNewPresetForm(f => ({ ...f, [key]: e.target.value }))}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                  <div className="w-full h-full" style={{ background: newPresetForm[key] }} />
                                </div>
                                <span className="text-[9px] text-muted-foreground">{label}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => setShowAddPreset(false)}
                              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >取消</button>
                            <Button
                              variant="glow"
                              size="sm"
                              onClick={saveCustomPreset}
                              disabled={!newPresetForm.name.trim()}
                            >保存预设</Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Template grid: built-in + custom */}
                  <div className="grid grid-cols-5 gap-2">
                    {[...themes, ...customPresets].map((theme) => {
                      const isSelected = recolorTemplate === theme.id
                      const isCustom = theme.id.startsWith('custom-')
                      return (
                        <div key={theme.id} className="relative group/card">
                          <button
                            onClick={() => setRecolorTemplate(theme.id)}
                            className={`w-full rounded-lg p-2 border transition-all duration-200 text-center ${
                              isSelected
                                ? 'border-primary/40 bg-primary/8 shadow-sm'
                                : 'glass hover:border-[hsl(var(--foreground)/0.12)]'
                            }`}
                          >
                            <div
                              className="w-full h-8 rounded mb-1"
                              style={{ background: `linear-gradient(135deg, ${theme.preview.primaryHex}, ${theme.preview.primaryHex}88)` }}
                            />
                            <span className={`text-[9px] font-medium block truncate ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                              {theme.name}
                            </span>
                          </button>
                          {isCustom && (
                            <button
                              onClick={() => deleteCustomPreset(theme.id)}
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[hsl(var(--surface-secondary))] border border-[hsl(var(--foreground)/0.1)] text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors items-center justify-center hidden group-hover/card:flex"
                            >
                              <X size={8} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <div className="flex justify-center">
                <Button
                  variant="glow"
                  className="gap-2 px-8"
                  disabled={recolorGenerating || !recolorImage}
                  onClick={async () => {
                    if (!recolorImage) return
                    if (!isLoggedIn) { navigate('/login?return=/workspace'); return }
                    const template = [...themes, ...customPresets].find(t => t.id === recolorTemplate)

                    // Build strict color-only recolor instruction
                    const colorRef = template
                      ? `目标配色方案（${template.name}风格）：主色 hsl(${template.colors.primary.h},${template.colors.primary.s}%,${template.colors.primary.l}%)，背景色 hsl(${template.colors.background.h},${template.colors.background.s}%,${template.colors.background.l}%)，辉光色 hsl(${template.colors.glow.h},${template.colors.glow.s}%,${template.colors.glow.l}%)，表面色 hsl(${template.colors.surface.h},${template.colors.surface.s}%,${template.colors.surface.l}%)。`
                      : ''
                    const strictInstruction =
                      '【严格仅换色，禁止改变排版】：' +
                      '请100%保留原图的布局结构、UI组件位置、图标形状、文字内容、所有元素的尺寸与间距、层级关系，' +
                      '不得新增、删除或移动任何元素。' +
                      '仅将画面中的颜色（背景色、主色调、高亮色、边框色、文字颜色、渐变色）替换为以下配色：' +
                      colorRef
                    const userExtra = recolorText ? `补充要求：${recolorText}` : ''
                    const prompt = `${strictInstruction}${userExtra}`

                    setRecolorGenerating(true)
                    setRecolorError(null)
                    setRecolorResult([])

                    try {
                      if (engine === 'jimeng') {
                        const loginStatus = await checkLoginStatus()
                        if (!loginStatus.ok) {
                          const wasConfigured = (() => {
                            try {
                              const s = localStorage.getItem('api_config_status')
                              if (s) {
                                const cfg = JSON.parse(s)
                                return cfg.provider === 'jimeng' || cfg.provider === 'ark'
                              }
                            } catch {}
                            return false
                          })()
                          if (wasConfigured) {
                            setRecolorError(`即梦 API: ${loginStatus.credit || 'API 验证失败，可能是网络问题或 Key 已过期，请重新配置'}`)
                          } else {
                            setRecolorError(`即梦 API: ${loginStatus.credit || 'API Key 未配置，请先在设置中配置'}`)
                          }
                          setSettingsOpen(true)
                          return
                        } else {
                          localStorage.setItem('api_config_status', JSON.stringify({ provider: 'jimeng', configuredAt: Date.now() }))
                        }
                      } else {
                        const wasConfigured = (() => {
                          try {
                            const s = localStorage.getItem('api_config_status')
                            if (s) {
                              const cfg = JSON.parse(s)
                              return cfg.provider === 'openai'
                            }
                          } catch {}
                          return false
                        })()
                        const openAIKey = getStoredOpenAIKey().trim()
                        const res = await fetch('/api/openai/status', {
                          headers: openAIKey ? { 'X-OpenAI-Api-Key': openAIKey } : undefined,
                        })
                        const st = await res.json()
                        if (!st.ok) {
                          if (wasConfigured) {
                            setRecolorError('OpenAI API 验证失败，可能是网络问题或 Key 已过期，请重新配置')
                          } else {
                            setRecolorError('OpenAI API Key 未配置，请先在设置中配置')
                          }
                          setSettingsOpen(true)
                          return
                        }
                      }

                      let result: { ok: boolean; images: string[]; error?: string }
                      if (engine === 'openai') {
                        const r = await generateOpenAI(prompt, recolorImage)
                        result = { ok: r.ok, images: r.images, error: r.error }
                      } else {
                        const r = await generateWithPoll(prompt, recolorImage)
                        result = { ok: r.success, images: r.images, error: r.error }
                      }

                      if (result.ok && result.images.length > 0) {
                        setRecolorResult(result.images)
                        onAddHistory?.(prompt, result.images, 'theme')
                      } else {
                        setRecolorError(result.error || '换色失败，请重试')
                      }
                    } catch (err) {
                      setRecolorError(err instanceof Error ? err.message : String(err))
                    } finally {
                      setRecolorGenerating(false)
                    }
                  }}
                >
                  {recolorGenerating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      换色中...
                    </>
                  ) : (
                    <>
                      <Wand2 size={14} />
                      一键换色
                    </>
                  )}
                </Button>
              </div>

              {/* Error */}
              {recolorError && (
                <div className="flex items-center gap-2 text-destructive text-xs justify-center">
                  <AlertCircle size={12} />
                  <span>{recolorError}</span>
                </div>
              )}

              {/* Result */}
              {recolorResult.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-medium text-foreground">换色结果</span>
                  <div className="grid grid-cols-2 gap-3">
                    {recolorResult.map((img, i) => (
                      <div key={i} className="rounded-xl overflow-hidden border border-[hsl(var(--foreground)/0.06)] relative group">
                        <img src={img} alt={`Recolor ${i + 1}`} className="w-full aspect-video object-contain bg-[hsl(var(--surface))]" />
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 transition-colors"
                            onClick={() => {
                              const url = img.startsWith('data:') ? img : `/api/jimeng/download?url=${encodeURIComponent(img)}`
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `hmi-recolor-${i + 1}.png`
                              a.click()
                            }}
                          >
                            <Download size={10} className="text-white" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                </>
              )}

              {themeSubMode === 'figma-swap' && (
                <Suspense fallback={<div className="flex items-center justify-center h-32 text-muted-foreground text-sm"><Loader2 size={16} className="animate-spin mr-2" />加载 Figma 换色面板...</div>}>
                  <ThemeSwapPanel />
                </Suspense>
              )}
            </motion.div>
          )}

          {activeTab === 'check' && (
            <motion.div
              key="check"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">加载中...</div>}>
              <CheckPage activeSection={activeSection} onNavigate={onNavigate} />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'export' && (
            <motion.div
              key="export"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="h-full flex flex-col"
            >
              {/* Header */}
              <div className="text-center space-y-2 mb-6">
                <h2 className="text-xl font-semibold text-foreground">导出中心</h2>
                <p className="text-sm text-muted-foreground">Figma Top Level Frame Export Pipeline</p>
              </div>

              {/* Analyzing Animation */}
              {isConnecting && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex items-center justify-center"
                >
                  <div className="text-center space-y-6">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-16 h-16 mx-auto rounded-full border-2 border-primary/20 flex items-center justify-center"
                    >
                      <div className="w-12 h-12 rounded-full border-2 border-primary/40 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                          </svg>
                        </div>
                      </div>
                    </motion.div>

                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-foreground">正在分析 Figma 结构...</h3>
                      <div className="space-y-2">
                        {[
                          { text: '读取文件', done: analyzingStep >= 0 },
                          { text: '识别画框', done: analyzingStep >= 1 },
                          { text: '构建导出队列', done: analyzingStep >= 2 },
                          { text: '准备导出', done: analyzingStep >= 3 },
                        ].map((step, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center gap-3"
                          >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              step.done ? 'bg-primary/20 text-primary' : 'bg-background border border-white/10 text-muted-foreground'
                            }`}>
                              {step.done ? (
                                <CheckCircle2 size={12} />
                              ) : (
                                <span className="text-xs">{index + 1}</span>
                              )}
                            </div>
                            <span className={`text-sm ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {step.text}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Main Layout - Three Columns */}
              {!isConnecting && (
                <div className="flex-1 grid grid-cols-12 gap-4">
                  {/* Left: Frame List */}
                  <div className="col-span-4 flex flex-col">
                    {/* Figma Connection */}
                    <div className="glass rounded-xl p-4 border border-white/10 mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-[#F24E1E]/10 flex items-center justify-center">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F24E1E" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                          </svg>
                        </div>
                        <h3 className="text-sm font-medium text-foreground">Figma 连接</h3>
                      </div>

                      {!figmaConnected ? (
                        <div className="space-y-3">
                          {/* 上传区域 — 照抄ThemeSwapPanel的虚线边框样式 */}
                          {!isConnecting ? (
                            <div
                              onClick={() => document.getElementById('figma-url-input')?.focus()}
                              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-[hsl(var(--foreground)/0.1)] hover:border-primary/40 transition-colors cursor-pointer"
                            >
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/50 mb-2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                <path d="M2 17l10 5 10-5"/>
                                <path d="M2 12l10 5 10-5"/>
                              </svg>
                              <span className="text-xs text-muted-foreground">输入 Figma 文件链接</span>
                              <span className="text-[10px] text-muted-foreground/50 mt-1">点击下方输入框粘贴链接</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-primary/30 bg-primary/5 transition-colors">
                              <Loader2 size={20} className="text-primary animate-spin mb-2" />
                              <span className="text-xs text-primary font-medium">正在连接 Figma...</span>
                              <span className="text-[10px] text-primary/60 mt-0.5">{analyzingStatus || '加载中'}</span>
                            </div>
                          )}
                          <input
                            id="figma-url-input"
                            type="text"
                            value={figmaUrl}
                            onChange={(e) => setFigmaUrl(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && figmaUrl.trim()) connectFigma(); }}
                            placeholder="https://www.figma.com/file/..."
                            className="w-full px-4 py-2 rounded-lg bg-background/50 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                          />
                          <Button
                            onClick={connectFigma}
                            disabled={!figmaUrl.trim() || isConnecting}
                            className="w-full"
                          >
                            连接 Figma
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* 已连接状态 — 照抄ThemeSwapPanel的上传成功样式 */}
                          <div className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 transition-colors">
                            <CheckCircle2 size={20} className="text-emerald-400 mb-2" />
                            <span className="text-xs text-emerald-400 font-medium truncate max-w-full px-1">{figmaFileInfo?.name}</span>
                            <span className="text-[10px] text-emerald-400/60 mt-0.5">已连接 · {figmaFrames.length} 个画板</span>
                            <button
                              onClick={disconnectFigma}
                              className="mt-2 text-[10px] text-primary/60 hover:text-primary transition-colors"
                            >
                              重新连接
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Frame List */}
                    <div className="glass rounded-xl border border-white/10 flex-1 flex flex-col">
                      <div className="p-3 border-b border-white/5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-medium text-foreground">已识别的 Frame</h4>
                          <div className="flex gap-2">
                            <button
                              onClick={selectAllFrames}
                              className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                            >
                              全选
                            </button>
                            <button
                              onClick={deselectAllFrames}
                              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {figmaFrames.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <FileIcon size={24} className="opacity-30 mb-2" />
                            <p className="text-xs">暂无 Frame</p>
                            <p className="text-[10px] mt-1">请先连接 Figma</p>
                          </div>
                        ) : (
                          figmaFrames.map((frame, index) => (
                            <label
                              key={`list-${index}-${frame}`}
                              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                selectedFrames.includes(frame)
                                  ? 'bg-primary/10 border border-primary/20'
                                  : 'bg-background/50 border border-transparent hover:border-white/10'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedFrames.includes(frame)}
                                onChange={() => toggleFrameSelection(frame)}
                                className="w-3 h-3 rounded border-white/20 bg-background text-primary focus:ring-primary"
                              />
                              <span className="text-xs text-foreground truncate">{frame}</span>
                            </label>
                          ))
                        )}
                      </div>
                      {figmaFrames.length > 0 && (
                        <div className="p-3 border-t border-white/5">
                          <p className="text-[10px] text-muted-foreground">
                            已选择 {selectedFrames.length} / {figmaFrames.length} 个 Frame
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Center: Frame Preview */}
                  <div className="col-span-5">
                    <div className="glass rounded-xl border border-white/10 h-full flex flex-col">
                      <div className="p-3 border-b border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-medium text-foreground">
                              {figmaPreviewMode === 'frames' ? 'Frame 预览' : '切图预览'}
                            </h4>
                            {/* 刷新按钮 */}
                            {figmaConnected && figmaPreviewMode === 'frames' && selectedFrames.length > 0 && (
                              <button
                                onClick={refreshFramePreviews}
                                disabled={previewsLoading}
                                className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                                title="刷新预览图"
                              >
                                <RefreshCw size={12} className={previewsLoading ? 'animate-spin' : ''} />
                              </button>
                            )}
                          </div>
                          {/* 画板/切图切换Tab */}
                          {figmaConnected && (
                            <div className="flex items-center bg-black/20 rounded-lg p-0.5">
                              <button
                                onClick={() => setFigmaPreviewMode('frames')}
                                className={`px-2.5 py-1 text-[10px] rounded-md transition-all duration-200 flex items-center gap-1 ${
                                  figmaPreviewMode === 'frames'
                                    ? 'bg-primary/20 text-primary'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <Layout size={12} />
                                画板 ({selectedFrames.length})
                              </button>
                              <button
                                onClick={() => setFigmaPreviewMode('assets')}
                                className={`px-2.5 py-1 text-[10px] rounded-md transition-all duration-200 flex items-center gap-1 ${
                                  figmaPreviewMode === 'assets'
                                    ? 'bg-primary/20 text-primary'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <ImageIcon size={12} />
                                切图 ({figmaExportAssets.length})
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4">
                        {figmaFrames.length === 0 && figmaExportAssets.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <ImageIcon size={48} className="opacity-30 mb-4" />
                            <p className="text-sm">预览区域</p>
                            <p className="text-xs mt-1">连接 Figma 后显示 Frame 预览</p>
                          </div>
                        ) : figmaPreviewMode === 'frames' ? (
                          <div className="space-y-4">
                            {/* 全局加载指示器 */}
                            {previewsLoading && Object.keys(framePreviews).length === 0 && (
                              <div className="flex items-center justify-center py-12 text-muted-foreground">
                                <Loader2 size={20} className="animate-spin mr-2" />
                                <span className="text-xs">正在从 Figma 加载画板预览图...</span>
                              </div>
                            )}
                            {selectedFrames.map((frame, index) => (
                              <motion.div
                                key={`preview-${index}-${frame}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="relative rounded-xl overflow-hidden border border-white/10 bg-black/20"
                              >
                                {framePreviews[frame] ? (
                                  <FigmaImage
                                    url={framePreviews[frame]}
                                    alt={frame}
                                    preview={true}
                                    className="w-full h-auto object-contain"
                                    onError={() => {
                                      // 所有代理都失败，清除该预览并标记错误
                                      setFramePreviews(prev => {
                                        const next = { ...prev }
                                        delete next[frame]
                                        return next
                                      })
                                      setPreviewErrors(prev => ({ ...prev, [frame]: true }))
                                    }}
                                  />
                                ) : previewErrors[frame] ? (
                                  /* 加载失败状态 */
                                  <div className="h-[300px] flex items-center justify-center bg-gradient-to-br from-red-950/30 to-[#1e293b]">
                                    <div className="text-center">
                                      <div className="w-12 h-12 mx-auto rounded-lg bg-red-500/10 flex items-center justify-center mb-3">
                                        <AlertCircle size={24} className="text-red-400" />
                                      </div>
                                      <p className="text-sm font-medium text-foreground">{frame}</p>
                                      <p className="text-xs text-red-400/70 mt-1">预览图加载失败</p>
                                      <button
                                        onClick={() => retryFramePreview(frame)}
                                        className="mt-3 px-3 py-1 text-[10px] rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1 mx-auto"
                                      >
                                        <RefreshCw size={10} />
                                        重试
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  /* 加载中状态 */
                                  <div className="h-[300px] flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1e293b]">
                                    <div className="text-center">
                                      <div className="w-12 h-12 mx-auto rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                                        <Loader2 size={24} className="text-primary animate-spin" />
                                      </div>
                                      <p className="text-sm font-medium text-foreground">{frame}</p>
                                      <p className="text-xs text-muted-foreground mt-1">正在加载真实画板内容...</p>
                                    </div>
                                  </div>
                                )}
                                <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/50 backdrop-blur-sm">
                                  <span className="text-[10px] text-white/80">{frame}.png</span>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          /* 切图预览网格 */
                          <div className="space-y-3">
                            {assetsLoading && (
                              <div className="flex items-center justify-center py-12 text-muted-foreground">
                                <Loader2 size={20} className="animate-spin mr-2" />
                                <span className="text-xs">正在从 Figma 加载切图资源...</span>
                              </div>
                            )}
                            {!assetsLoading && figmaExportAssets.length === 0 && (
                              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                <ImageIcon size={36} className="opacity-30 mb-3" />
                                <p className="text-sm">未找到切图资源</p>
                                <p className="text-xs mt-1">在 Figma 中为图层添加导出设置（PNG/SVG）</p>
                              </div>
                            )}
                            {!assetsLoading && figmaExportAssets.length > 0 && (
                              <>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] text-muted-foreground">
                                    共 {figmaExportAssets.length} 个切图资源
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={refreshExportAssets}
                                      className="flex items-center gap-1 px-2 py-1 text-[10px] rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                      title="刷新切图"
                                    >
                                      <RefreshCw size={10} />
                                      刷新
                                    </button>
                                    <button
                                      onClick={handleDownloadAllAssetsAsZip}
                                      disabled={isAssetsZipping}
                                      title="将所有切图打包成一个 ZIP 文件下载"
                                      className="flex items-center gap-1 px-3 py-1.5 text-[11px] rounded bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                      <Download size={11} className={isAssetsZipping ? 'animate-pulse' : ''} />
                                      {isAssetsZipping
                                        ? `打包中 ${assetsZipProgress.current}/${assetsZipProgress.total}`
                                        : '全部下载 (ZIP)'}
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {figmaExportAssets.map((asset, index) => (
                                    <motion.div
                                      key={`asset-${index}-${asset.id}`}
                                      initial={{ opacity: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ delay: index * 0.03 }}
                                      className="relative group rounded-lg overflow-hidden border border-white/10 bg-black/20"
                                    >
                                      <div className="aspect-square flex items-center justify-center p-2 relative">
                                        {assetErrors[asset.id] ? (
                                          /* 切图加载失败状态 */
                                          <div className="flex flex-col items-center justify-center w-full h-full">
                                            <AlertCircle size={20} className="text-red-400/60 mb-2" />
                                            <p className="text-[9px] text-red-400/70 text-center px-2 truncate max-w-full">
                                              {asset.name}
                                            </p>
                                            <button
                                              onClick={() => retryExportAsset(asset.id)}
                                              className="mt-2 flex items-center gap-1 px-2 py-0.5 text-[9px] rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                            >
                                              <RefreshCw size={8} />
                                              重试
                                            </button>
                                          </div>
                                        ) : (
                                          <FigmaImage
                                            url={asset.url}
                                            alt={asset.name}
                                            preview={true}
                                            className="max-w-full max-h-full object-contain"
                                            loading="lazy"
                                            onError={() => {
                                              setAssetErrors(prev => ({ ...prev, [asset.id]: true }))
                                            }}
                                          />
                                        )}
                                      </div>
                                      <div className="p-2 border-t border-white/5">
                                        <p className="text-[10px] text-foreground truncate" title={asset.name}>
                                          {asset.name}
                                        </p>
                                        <span className="text-[9px] text-muted-foreground">{asset.format}</span>
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Export Options */}
                  <div className="col-span-3 space-y-4">
                    <div className="glass rounded-xl border border-white/10 p-4">
                      <h4 className="text-xs font-medium text-foreground mb-3">导出选项</h4>
                      <div className="space-y-2">
                        {/* PNG 导出 — 点击直接开始导出 */}
                        <motion.button
                          onClick={() => {
                            setExportErrorMessage(null)
                            handlePngExport()
                          }}
                          disabled={!figmaConnected || selectedFrames.length === 0 || isExporting}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 ${
                            figmaConnected && selectedFrames.length > 0
                              ? 'bg-background/50 hover:bg-primary/10 border border-transparent hover:border-primary/20'
                              : 'bg-background/30 opacity-50 cursor-not-allowed border border-transparent'
                          }`}
                          whileHover={figmaConnected && selectedFrames.length > 0 ? { x: 4 } : {}}
                        >
                          <span className={`${
                            figmaConnected && selectedFrames.length > 0 ? 'text-primary/70' : 'text-muted-foreground/40'
                          }`}>
                            <ImageIcon size={16} />
                          </span>
                          <div className="flex-1">
                            <div className="text-xs font-medium text-foreground">PNG 导出</div>
                            <div className="text-[10px] text-muted-foreground">逐 Frame 导出 · 2x · 保留透明度</div>
                          </div>
                        </motion.button>
                      </div>

                      {/* 当前已选 Frame 数量提示 */}
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 size={10} className="text-emerald-400" />
                          当前选中：<span className="text-foreground font-medium">{selectedFrames.length}</span> 个 Frame
                          {selectedFrames.length > 0 && (
                            <span className="text-muted-foreground/60">· 保留透明度</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Quick Info */}
                    <div className="glass rounded-xl border border-white/10 p-4">
                      <h4 className="text-xs font-medium text-foreground mb-3">导出规则</h4>
                      <ul className="space-y-2">
                        {[
                          '文件名保持 Figma Frame 原名称',
                          '不修改空格、大小写、特殊字符',
                          '一个 Frame = 一个文件',
                          '仅导出顶层 Frame',
                        ].map((rule) => (
                          <li key={rule} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <CheckCircle2 size={10} className="text-emerald-400" />
                            {rule}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Export Queue - Bottom */}
              {!isConnecting && (
                <div className="mt-4 glass rounded-xl border border-white/10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-foreground">导出队列</h3>
                    <span className="text-xs text-muted-foreground">{exportQueue.length} 个任务</span>
                  </div>

                  {/* 整体进度条 */}
                  {exportOverallProgress && exportOverallProgress.phase !== 'done' && (
                    <div className="mb-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Loader2 size={12} className="animate-spin text-primary" />
                          <span className="text-[11px] text-foreground font-medium">
                            {exportOverallProgress.phase === 'fetching' && '正在获取图片'}
                            {exportOverallProgress.phase === 'encoding' && '正在编码图片'}
                            {exportOverallProgress.phase === 'zipping' && '正在打包 ZIP'}
                            {exportOverallProgress.phase === 'saving' && '正在写入文件夹'}
                          </span>
                        </div>
                        <span className="text-[11px] text-primary font-medium">
                          {exportOverallProgress.current} / {exportOverallProgress.total}
                        </span>
                      </div>
                      {exportOverallProgress.currentFrame && (
                        <p className="text-[10px] text-muted-foreground truncate mb-2">
                          当前：{exportOverallProgress.currentFrame}
                        </p>
                      )}
                      <div className="h-1.5 bg-background/60 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${exportOverallProgress.total > 0
                              ? (exportOverallProgress.current / exportOverallProgress.total) * 100
                              : 0}%`
                          }}
                          transition={{ duration: 0.3 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* 错误提示 */}
                  {exportErrorMessage && (
                    <div className="mb-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                      <AlertCircle size={12} className="text-destructive flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-destructive flex-1">{exportErrorMessage}</p>
                      <button
                        onClick={() => setExportErrorMessage(null)}
                        className="text-destructive/60 hover:text-destructive transition-colors flex-shrink-0"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {exportQueue.length === 0 ? (
                    <div className="flex items-center justify-center py-4 text-muted-foreground">
                      <Download size={20} className="opacity-30 mr-2" />
                      <span className="text-xs">暂无导出任务</span>
                    </div>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {exportQueue.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50"
                        >
                          <div className={`w-2 h-2 rounded-full ${
                            item.status === 'completed' ? 'bg-emerald-400' :
                            item.status === 'processing' ? 'bg-primary animate-pulse' :
                            item.status === 'failed' ? 'bg-destructive' : 'bg-muted-foreground/50'
                          }`} />
                          <div className="max-w-32">
                            <div className="text-[10px] font-medium text-foreground truncate" title={item.filename}>{item.filename}</div>
                            {item.status === 'processing' && (
                              <div className="text-[9px] text-muted-foreground">{item.progress}%</div>
                            )}
                            {item.status === 'completed' && item.size && (
                              <div className="text-[9px] text-emerald-400/80">{item.size}</div>
                            )}
                            {item.status === 'failed' && (
                              <div className="text-[9px] text-destructive">失败</div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'wallpaper' && (
            <motion.div
              key="wallpaper"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="max-w-5xl mx-auto space-y-5"
            >
              {(() => {
                const { cur, filtered } = wallpaperData
                const hasCategories = Object.keys(wallpaperData.wpMap).length > 0
                if (!hasCategories) {
                  return (
                    <div className="text-center py-20">
                      <Layers className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">暂无壁纸分类</h3>
                      <p className="text-sm text-muted-foreground mb-4">所有分类已被删除，请从创作记录中导入壁纸来创建新分类</p>
                      <Button
                        variant="glow"
                        size="sm"
                        onClick={() => onNavigate?.('dashboard')}
                        className="gap-1.5"
                      >
                        <Sparkles size={12} />
                        前往创作记录
                      </Button>
                    </div>
                  )
                }
                return (
                  <>
                    {/* Header */}
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">壁纸引擎</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">{cur.label} — 共 {cur.list.length} 张壁纸</p>
                      {/* Quick Check Items */}
                      {checkItemsByCategory['wallpaper'].length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-start mt-3">
                          {checkItemsByCategory['wallpaper'].map((item) => (
                            <CheckBadge
                              key={item.id}
                              type={item.type}
                              label={item.label}
                              detail={item.detail}
                              compact
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Category tabs */}
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--foreground)/0.06)] w-fit flex-wrap">
                      {Object.entries(wallpaperData.wpMap).map(([catId, catData]) => (
                        <div key={catId} className="relative group">
                          <button
                            onClick={() => { setWallpaperCategory(catId); setWallpaperTag('全部'); setDeleteCategoryConfirm(null) }}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 pr-6 ${
                              wallpaperCategory === catId
                                ? 'bg-primary/15 text-primary'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {catData.label}
                            <span className="ml-1 text-[10px] opacity-50">{catData.list.length}</span>
                          </button>
                          {deleteCategoryConfirm === catId ? (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-red-500/90 backdrop-blur-sm rounded-lg px-2 py-1 whitespace-nowrap shadow-lg">
                              <span className="text-[9px] text-white/80">删除?</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteCategory(catId) }}
                                className="text-[9px] text-white font-medium hover:text-red-100 transition-colors"
                              >
                                确认
                              </button>
                              <div className="w-px h-3 bg-white/30" />
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteCategoryConfirm(null) }}
                                className="text-[9px] text-white/70 hover:text-white transition-colors"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteCategoryConfirm(catId) }}
                              className="absolute top-1/2 -translate-y-1/2 right-1 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all duration-200"
                            >
                              <X className="w-2.5 h-2.5 text-muted-foreground hover:text-red-400" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Tag filter */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {cur.tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setWallpaperTag(tag)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                            wallpaperTag === tag
                              ? 'bg-primary/15 text-primary border border-primary/30'
                              : 'bg-[hsl(var(--surface-secondary)/0.5)] text-muted-foreground border border-transparent hover:text-foreground hover:bg-[hsl(var(--surface-secondary)/0.8)]'
                          }`}
                        >
                          {tag}
                          <span className="ml-1 text-[10px] opacity-60">
                            {tag === '全部' ? cur.list.length : cur.list.filter((w: any) => w.tags?.includes(tag)).length}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Wallpaper grid */}
                    <div className="grid grid-cols-4 gap-3">
                      {filtered.map((wallpaper) => (
                        <motion.div
                          key={wallpaper.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="group relative rounded-xl overflow-hidden border border-[hsl(var(--foreground)/0.06)] hover:border-primary/30 transition-all duration-300 cursor-pointer"
                          onClick={() => {
                            if (deleteConfirmId === (wallpaper.id || wallpaper.filename)) return
                            // 相对路径 ./images/...,保证应用部署在任意子目录(如作品集 /hmi-agent/)时图片仍可加载
                            const imgSrc = wallpaper.filename.startsWith('data:') || wallpaper.filename.startsWith('http') ? wallpaper.filename : `./images/wallpaper/${cur.dir}/${wallpaper.filename}`
                            setPreviewWallpaper(imgSrc)
                          }}
                        >
                          <div className="aspect-video bg-[hsl(var(--surface-secondary)/0.3)]">
                            <img
                              src={wallpaper.filename.startsWith('data:') || wallpaper.filename.startsWith('http') ? wallpaper.filename : `./images/wallpaper/${cur.dir}/${wallpaper.filename}`}
                              alt={wallpaper.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          {/* Delete button */}
                          <div
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {deleteConfirmId === (wallpaper.id || wallpaper.filename) ? (
                              <div className="flex items-center gap-1 bg-red-500/90 backdrop-blur-sm rounded-lg px-2 py-1">
                                <button
                                  onClick={() => handleDeleteWallpaper(wallpaper, wallpaperCategory)}
                                  className="text-[10px] text-white font-medium hover:text-red-100 transition-colors"
                                >
                                  确认
                                </button>
                                <div className="w-px h-3 bg-white/30" />
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="text-[10px] text-white/70 hover:text-white transition-colors"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(wallpaper.id || wallpaper.filename)}
                                className="w-6 h-6 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-red-500/80 transition-colors"
                              >
                                <Trash2 className="w-3 h-3 text-white" />
                              </button>
                            )}
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-2.5 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                            <p className="text-[11px] font-medium text-white truncate">{wallpaper.name}</p>
                            <div className="flex items-center gap-1 mt-1">
                              {wallpaper.tags?.map((t: string) => (
                                <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/15 text-white/80">{t}</span>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Empty state */}
                    {filtered.length === 0 && (
                      <div className="text-center py-16 text-muted-foreground">
                        <p className="text-sm">该分类下暂无壁纸</p>
                      </div>
                    )}
                  </>
                )
              })()}
            </motion.div>
          )}

          {activeTab === 'ai-wallpaper' && (
            <motion.div
              key="ai-wallpaper"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="max-w-3xl mx-auto space-y-6"
            >
              <div className="flex items-start justify-between">
                <div className="text-center space-y-2 flex-1">
                  <h2 className="text-xl font-semibold text-foreground">AI 生成壁纸</h2>
                  <p className="text-sm text-muted-foreground">输入你的创意灵感，一键生成高清桌面壁纸和手机壁纸</p>
                  {/* Engine + Resolution Selector */}
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.06)]">
                      {(['jimeng', 'openai'] as const).map((e) => (
                        <button
                          key={e}
                          onClick={() => setEngine(e)}
                          className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                            engine === e
                              ? 'bg-primary/15 text-primary'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {e === 'jimeng' ? '即梦 Seedream' : 'GPT 图像'}
                        </button>
                      ))}
                    </div>
                    <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.06)]">
                      {WALLPAPER_RESOLUTIONS.map((res) => (
                        <button
                          key={res.label}
                          onClick={() => setWallpaperRes(res.label)}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
                            wallpaperRes === res.label
                              ? 'bg-primary/15 text-primary'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Monitor size={10} className="inline mr-1" />
                          {res.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {wallpaperError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400 text-xs"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="flex-1">{wallpaperError}</span>
                  <button onClick={() => setWallpaperError(null)} className="hover:text-red-300 transition-colors">
                    <X size={12} />
                  </button>
                </motion.div>
              )}

              {/* Wallpaper Creative Input */}
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-primary">
                  <ImageIcon size={12} />
                  <span>创意描述 / 壁纸灵感</span>
                </div>
                <div className="relative">
                  <textarea
                    value={wallpaperPrompt}
                    onChange={(e) => setWallpaperPrompt(e.target.value)}
                    rows={4}
                    placeholder="用自然语言描述你想要的壁纸画面，例如：一棵古老的樱花树矗立在月光下的湖岸边，花瓣随风飘落，远处是雪山和极光..."
                    className="w-full bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--foreground)/0.08)] rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 resize-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="glow"
                    size="sm"
                    onClick={handleWallpaperGenerate}
                    disabled={wallpaperGenerating || !wallpaperPrompt.trim()}
                    className="gap-1.5"
                  >
                    {wallpaperGenerating ? (
                      <>
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <Zap size={12} />
                        </motion.span>
                        壁纸生成中...
                      </>
                    ) : (
                      <>
                        <ImageIcon size={12} />
                        立即生成壁纸
                      </>
                    )}
                  </Button>
                  {wallpaperError && (
                    <span className="text-[11px] text-red-400">{wallpaperError}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground/60">
                    当前分辨率：{wallpaperRes}
                  </span>
                </div>
              </div>

              {/* Wallpaper Style Quick Prompts */}
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">壁纸风格灵感</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '🏙️ 赛博朋克都市', prompt: '赛博朋克风格的未来都市夜景，霓虹灯光璀璨，雨雾弥漫的街道，深蓝与紫色调' },
                    { label: '🌿 极简自然', prompt: '极简风格的自然风光壁纸，柔和色调，大面积留白，宁静治愈的氛围' },
                    { label: '🎨 抽象艺术', prompt: '抽象几何艺术纹理壁纸，渐变色块，现代设计感，适合桌面背景' },
                    { label: '🌌 宇宙星空', prompt: '浩瀚宇宙星空壁纸，星云与银河，梦幻紫色和深蓝色，高清天文摄影风格' },
                    { label: '⛩️ 国风水墨', prompt: '中国传统水墨山水画风格壁纸，意境深远，黑白灰为主调，留白艺术' },
                    { label: '🌊 海洋风光', prompt: '壮丽的海洋风光壁纸，碧蓝海水，金色沙滩，日落时分的温暖光线' },
                    { label: '🏔️ 雪山极光', prompt: '雪山与极光壁纸，冬季仙境，璀璨星空和绿色极光交相辉映，4K高清' },
                    { label: '🌸 唯美花卉', prompt: '唯美花卉特写壁纸，柔和自然光线，浅景深效果，色彩温柔浪漫' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => setWallpaperPrompt(item.prompt)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--foreground)/0.06)] text-muted-foreground hover:text-foreground hover:border-[hsl(var(--primary)/0.2)] transition-all duration-200"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generated Wallpapers */}
              {wallpaperResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">已生成 {wallpaperResults.length} 张壁纸</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] text-muted-foreground hover:text-foreground h-6"
                      onClick={() => setWallpaperResults([])}
                    >
                      清空全部
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {wallpaperResults.map((img, i) => (
                      <div
                        key={i}
                        className="rounded-xl overflow-hidden border border-[hsl(var(--foreground)/0.06)] aspect-video relative group cursor-pointer hover:border-[hsl(var(--primary)/0.2)] transition-all duration-300"
                      >
                        <img
                          src={img}
                          alt={`AI 生成壁纸 ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-foreground">壁纸 {i + 1}</span>
                            <Button
                              variant="glow"
                              size="sm"
                              className="h-6 text-[10px] gap-1"
                              onClick={() => handleWallpaperDownload(img, i)}
                            >
                              <Download size={10} />
                              下载壁纸
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Wallpaper History Records */}
              {historyRecords.filter(r => r.category === 'wallpaper').length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">壁纸创作记录</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] text-muted-foreground hover:text-foreground h-6"
                      onClick={() => onNavigate?.('dashboard')}
                    >
                      查看全部
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {historyRecords.filter(r => r.category === 'wallpaper').slice(0, 4).map((record) => (
                      <div
                        key={record.id}
                        className="rounded-xl overflow-hidden border border-[hsl(var(--foreground)/0.06)] aspect-video relative group cursor-pointer hover:border-[hsl(var(--primary)/0.2)] transition-all duration-300"
                      >
                        {record.images[0] && (
                          <img
                            src={getProxyImageUrl(record.images[0])}
                            alt={record.prompt}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-foreground truncate">{record.prompt.replace(/^壁纸:\s*/, '').slice(0, 25)}</p>
                            <p className="text-[9px] text-white/50">{new Date(record.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === '3d-model' && (
            <motion.div
              key="3d-model"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">加载中...</div>}>
                <Tripo3DPanel />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wallpaper preview modal */}
        <AnimatePresence key="wallpaper-preview-modal">
          {previewWallpaper && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={() => setPreviewWallpaper(null)}
            >
              <motion.img
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                // 兼容相对路径 ./images/...、绝对路径、data: 与 http(s) 直链;裸文件名才拼接目录
                src={previewWallpaper.startsWith('data:') || previewWallpaper.startsWith('http') || previewWallpaper.startsWith('/') || previewWallpaper.startsWith('./') ? previewWallpaper : `./images/wallpaper/${previewWallpaper}`}
                alt="壁纸预览"
                className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain shadow-2xl"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Export Complete Modal */}
        <AnimatePresence key="export-modal">
          {exportComplete && completedExport && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={closeExportComplete}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="glass rounded-xl p-6 max-w-sm w-full mx-4 border border-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', damping: 15 }}
                    className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-4"
                  >
                    <CheckCircle2 size={24} className="text-emerald-400" />
                  </motion.div>
                  <h3 className="text-lg font-medium text-foreground mb-1">导出完成</h3>
                  <p className="text-xs text-muted-foreground mb-4">{completedExport.type} 导出完成</p>

                  <div className="space-y-2 mb-4 text-left">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">文件名</span>
                      <span className="text-foreground">{completedExport.filename}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">文件大小</span>
                      <span className="text-foreground">{completedExport.size}</span>
                    </div>
                    {completedExport.resolution && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">分辨率</span>
                        <span className="text-foreground">{completedExport.resolution}</span>
                      </div>
                    )}
                  </div>

                  {/* 文件位置指示 */}
                  <div className="mb-4 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[11px] text-emerald-300 font-medium">ZIP 已下载到浏览器默认下载文件夹</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          请检查浏览器右上角的下载图标，或前往系统「下载」目录（如 ~/Downloads）
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          解压后将得到包含所有 Frame PNG 的文件夹
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 部分失败提示 */}
                  {exportErrorMessage && (
                    <div className="mb-4 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                      <AlertCircle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-300 flex-1">{exportErrorMessage}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-9 text-xs"
                      onClick={closeExportComplete}
                    >
                      关闭
                    </Button>
                    <Button
                      className="flex-1 h-9 text-xs"
                      onClick={downloadExportedFile}
                    >
                      <Download size={12} className="mr-1" />
                      再次下载 ZIP
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </main>
  )
}

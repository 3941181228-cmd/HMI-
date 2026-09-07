const STORAGE_KEYS = {
  figmaUrl: 'hmi-studio-figma-url',
  figmaFileKey: 'hmi-studio-figma-filekey',
  figmaFileName: 'hmi-studio-figma-filename',
  frameImages: 'hmi-studio-figma-images',
  connectionStatus: 'hmi-studio-figma-status',
  importStep: 'hmi-studio-figma-step',
}

export interface FrameImage {
  id: string
  name: string
  url: string
}

export interface SavedFigmaState {
  figmaUrl: string
  figmaFileKey: string
  figmaFileName: string
  frameImages: FrameImage[]
  connectionStatus: 'connected'
  importStep: 'result'
}

// 注意：figmaDocument 和 analysisResult 数据量过大（34311个节点），
// 超出 localStorage 存储配额（5-10MB），因此不持久化到 localStorage。
// 这些数据只保留在 React state 中，页面刷新后需要重新导入 Figma 文件。

export function saveFigmaState(data: {
  figmaUrl?: string
  figmaFileKey?: string
  figmaFileName?: string
  figmaDocument?: any
  analysisResult?: any
  frameImages?: FrameImage[]
  connectionStatus?: string
  importStep?: string
}) {
  try {
    if (data.figmaUrl !== undefined) localStorage.setItem(STORAGE_KEYS.figmaUrl, data.figmaUrl)
    if (data.figmaFileKey !== undefined) localStorage.setItem(STORAGE_KEYS.figmaFileKey, data.figmaFileKey)
    if (data.figmaFileName !== undefined) localStorage.setItem(STORAGE_KEYS.figmaFileName, data.figmaFileName)
    // 不存储 figmaDocument 和 analysisResult —— 数据量太大，超出 localStorage 配额
    if (data.frameImages !== undefined) {
      // 只存储缩略图 URL（数据量小），限制最多 20 张
      const limitedImages = data.frameImages.slice(0, 20)
      localStorage.setItem(STORAGE_KEYS.frameImages, JSON.stringify(limitedImages))
    }
    if (data.connectionStatus !== undefined) localStorage.setItem(STORAGE_KEYS.connectionStatus, data.connectionStatus)
    if (data.importStep !== undefined) localStorage.setItem(STORAGE_KEYS.importStep, data.importStep)
  } catch (e) {
    console.warn('Failed to save Figma state to localStorage:', e)
  }
}

export function loadFigmaState(): Partial<{
  figmaUrl: string
  figmaFileKey: string
  figmaFileName: string
  figmaDocument: any
  analysisResult: any
  frameImages: FrameImage[]
  connectionStatus: string
  importStep: string
}> {
  try {
    const figmaUrl = localStorage.getItem(STORAGE_KEYS.figmaUrl)
    const figmaFileKey = localStorage.getItem(STORAGE_KEYS.figmaFileKey)
    const figmaFileName = localStorage.getItem(STORAGE_KEYS.figmaFileName)
    const frameImagesStr = localStorage.getItem(STORAGE_KEYS.frameImages)
    const connectionStatus = localStorage.getItem(STORAGE_KEYS.connectionStatus)
    const importStep = localStorage.getItem(STORAGE_KEYS.importStep)

    return {
      figmaUrl: figmaUrl || undefined,
      figmaFileKey: figmaFileKey || undefined,
      figmaFileName: figmaFileName || undefined,
      // figmaDocument 和 analysisResult 不从 localStorage 加载
      frameImages: frameImagesStr ? JSON.parse(frameImagesStr) : undefined,
      connectionStatus: connectionStatus || undefined,
      importStep: importStep || undefined,
    }
  } catch (e) {
    console.warn('Failed to load Figma state from localStorage:', e)
    clearFigmaState()
    return {}
  }
}

export function clearFigmaState() {
  Object.values(STORAGE_KEYS).forEach(key => {
    try { localStorage.removeItem(key) } catch {}
  })
}

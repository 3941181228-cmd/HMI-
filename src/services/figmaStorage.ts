const STORAGE_KEYS = {
  figmaUrl: 'hmi-studio-figma-url',
  figmaFileKey: 'hmi-studio-figma-filekey',
  figmaFileName: 'hmi-studio-figma-filename',
  figmaDocument: 'hmi-studio-figma-document',
  analysisResult: 'hmi-studio-figma-analysis',
  frameImages: 'hmi-studio-figma-images',
  connectionStatus: 'hmi-studio-figma-status',
  importStep: 'hmi-studio-figma-step',
  specFile: 'hmi-studio-figma-spec',
}

export interface SavedFigmaState {
  figmaUrl: string
  figmaFileKey: string
  figmaFileName: string
  figmaDocument: any
  analysisResult: any
  frameImages: string[]
  connectionStatus: 'connected'
  importStep: 'result'
}

export function saveFigmaState(data: {
  figmaUrl?: string
  figmaFileKey?: string
  figmaFileName?: string
  figmaDocument?: any
  analysisResult?: any
  frameImages?: string[]
  connectionStatus?: string
  importStep?: string
}) {
  try {
    if (data.figmaUrl !== undefined) localStorage.setItem(STORAGE_KEYS.figmaUrl, data.figmaUrl)
    if (data.figmaFileKey !== undefined) localStorage.setItem(STORAGE_KEYS.figmaFileKey, data.figmaFileKey)
    if (data.figmaFileName !== undefined) localStorage.setItem(STORAGE_KEYS.figmaFileName, data.figmaFileName)
    if (data.figmaDocument !== undefined) {
      localStorage.setItem(STORAGE_KEYS.figmaDocument, JSON.stringify(data.figmaDocument))
    }
    if (data.analysisResult !== undefined) {
      localStorage.setItem(STORAGE_KEYS.analysisResult, JSON.stringify(data.analysisResult))
    }
    if (data.frameImages !== undefined) {
      localStorage.setItem(STORAGE_KEYS.frameImages, JSON.stringify(data.frameImages))
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
  frameImages: string[]
  connectionStatus: string
  importStep: string
}> {
  try {
    const figmaUrl = localStorage.getItem(STORAGE_KEYS.figmaUrl)
    const figmaFileKey = localStorage.getItem(STORAGE_KEYS.figmaFileKey)
    const figmaFileName = localStorage.getItem(STORAGE_KEYS.figmaFileName)
    const figmaDocumentStr = localStorage.getItem(STORAGE_KEYS.figmaDocument)
    const analysisResultStr = localStorage.getItem(STORAGE_KEYS.analysisResult)
    const frameImagesStr = localStorage.getItem(STORAGE_KEYS.frameImages)
    const connectionStatus = localStorage.getItem(STORAGE_KEYS.connectionStatus)
    const importStep = localStorage.getItem(STORAGE_KEYS.importStep)

    return {
      figmaUrl: figmaUrl || undefined,
      figmaFileKey: figmaFileKey || undefined,
      figmaFileName: figmaFileName || undefined,
      figmaDocument: figmaDocumentStr ? JSON.parse(figmaDocumentStr) : undefined,
      analysisResult: analysisResultStr ? JSON.parse(analysisResultStr) : undefined,
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
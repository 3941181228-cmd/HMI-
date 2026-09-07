// API 密钥本地存储服务 - 使用 localStorage 持久化保存 API 配置

export interface ApiKeys {
  arkKey?: string
  openaiKey?: string
  visionEndpoint?: string
  figmaToken?: string
}

const API_KEYS_STORAGE_KEY = 'hmi_api_keys'

function loadApiKeysFromStorage(): ApiKeys {
  try {
    const stored = localStorage.getItem(API_KEYS_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return {}
}

function saveApiKeysToStorage(keys: ApiKeys) {
  try {
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys))
  } catch {
    // Ignore storage errors
  }
}

export function getStoredArkKey(): string {
  return loadApiKeysFromStorage().arkKey || ''
}

export function getStoredOpenAIKey(): string {
  return loadApiKeysFromStorage().openaiKey || ''
}

export function getStoredVisionEndpoint(): string {
  return loadApiKeysFromStorage().visionEndpoint || ''
}

export function getStoredFigmaToken(): string {
  return loadApiKeysFromStorage().figmaToken || ''
}

export function saveArkKey(key: string) {
  const keys = loadApiKeysFromStorage()
  keys.arkKey = key
  saveApiKeysToStorage(keys)
}

export function saveOpenAIKey(key: string) {
  const keys = loadApiKeysFromStorage()
  keys.openaiKey = key
  saveApiKeysToStorage(keys)
}

export function saveVisionEndpoint(endpoint: string) {
  const keys = loadApiKeysFromStorage()
  keys.visionEndpoint = endpoint
  saveApiKeysToStorage(keys)
}

export function saveFigmaToken(token: string) {
  const keys = loadApiKeysFromStorage()
  keys.figmaToken = token
  saveApiKeysToStorage(keys)
}

export function getAllStoredApiKeys(): ApiKeys {
  return loadApiKeysFromStorage()
}

export function clearAllApiKeys() {
  try {
    localStorage.removeItem(API_KEYS_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

import { useState, useCallback, useEffect } from 'react'

export type HistoryCategory = 'hmi' | 'wallpaper' | 'theme' | 'other'

export interface HistoryRecord {
  id: string
  prompt: string
  images: string[]
  createdAt: number
  category: HistoryCategory
}

const STORAGE_KEY = 'hmi-studio-history'
const MAX_RECORDS = 20

function migrateRecord(r: any): HistoryRecord {
  if (!r.category) {
    if (r.prompt?.startsWith('壁纸')) {
      r.category = 'wallpaper'
    } else if (r.prompt?.includes('换色') || r.prompt?.includes('主题')) {
      r.category = 'theme'
    } else {
      r.category = 'hmi'
    }
  }
  return r as HistoryRecord
}

function loadFromStorage(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return parsed.map(migrateRecord)
  } catch {
    return []
  }
}

function saveToStorage(records: HistoryRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch { /* quota exceeded, ignore */ }
}

export function useHistory() {
  const [records, setRecords] = useState<HistoryRecord[]>(loadFromStorage)

  useEffect(() => {
    saveToStorage(records)
  }, [records])

  const addRecord = useCallback((prompt: string, images: string[], category: HistoryCategory = 'other') => {
    if (!images.length) return
    const record: HistoryRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      prompt,
      images,
      createdAt: Date.now(),
      category,
    }
    setRecords((prev) => [record, ...prev].slice(0, MAX_RECORDS))
  }, [])

  const clearHistory = useCallback(() => {
    setRecords([])
  }, [])

  const deleteRecords = useCallback((ids: string[]) => {
    setRecords((prev) => prev.filter((record) => !ids.includes(record.id)))
  }, [])

  return { records, addRecord, clearHistory, deleteRecords }
}

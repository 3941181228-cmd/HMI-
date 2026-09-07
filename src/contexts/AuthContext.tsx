import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

interface AuthContextType {
  isLoggedIn: boolean
  userName: string
  userEmail: string
  login: (name?: string, email?: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const AUTH_STORAGE_KEY = 'hmi_auth_state'

interface StoredAuthState {
  isLoggedIn: boolean
  userName: string
  userEmail: string
}

function loadAuthFromStorage(): StoredAuthState {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return { isLoggedIn: false, userName: '', userEmail: '' }
}

function saveAuthToStorage(state: StoredAuthState) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

function clearAuthStorage() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // 初始化时直接从 localStorage 同步读取，避免页面刷新时短暂未登录状态
  const initialAuthState = loadAuthFromStorage()
  const [isLoggedIn, setIsLoggedIn] = useState(initialAuthState.isLoggedIn)
  const [userName, setUserName] = useState(initialAuthState.userName || '用户昵称')
  const [userEmail, setUserEmail] = useState(initialAuthState.userEmail || 'user@example.com')

  // 监听 storage 事件，处理多标签页同步
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY) {
        const saved = loadAuthFromStorage()
        setIsLoggedIn(saved.isLoggedIn)
        setUserName(saved.userName || '用户昵称')
        setUserEmail(saved.userEmail || 'user@example.com')
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const login = useCallback((name?: string, email?: string) => {
    const userNameVal = name || '用户昵称'
    const userEmailVal = email || 'user@example.com'
    setIsLoggedIn(true)
    setUserName(userNameVal)
    setUserEmail(userEmailVal)
    saveAuthToStorage({
      isLoggedIn: true,
      userName: userNameVal,
      userEmail: userEmailVal,
    })
  }, [])

  const logout = useCallback(() => {
    setIsLoggedIn(false)
    setUserName('')
    setUserEmail('')
    clearAuthStorage()
  }, [])

  return (
    <AuthContext.Provider value={{ isLoggedIn, userName, userEmail, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
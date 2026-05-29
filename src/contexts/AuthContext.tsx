import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface AuthContextType {
  isLoggedIn: boolean
  userName: string
  userEmail: string
  login: (name?: string, email?: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')

  const login = useCallback((name?: string, email?: string) => {
    setIsLoggedIn(true)
    setUserName(name || '用户昵称')
    setUserEmail(email || 'user@example.com')
  }, [])

  const logout = useCallback(() => {
    setIsLoggedIn(false)
    setUserName('')
    setUserEmail('')
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
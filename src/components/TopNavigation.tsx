import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Hexagon,
  Bell,
  Settings,
  Circle,
  Moon,
  FileText,
  RefreshCw,
  LogOut,
  ArrowLeftRight,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface TopNavigationProps {
  autoSave?: boolean
  onOpenWorkspaceSettings?: () => void
}

export default function TopNavigation({ autoSave: autoSaveProp = true, onOpenWorkspaceSettings }: TopNavigationProps) {
  const navigate = useNavigate()
  const { isLoggedIn, userName, userEmail, logout } = useAuth()
  const [autoSave, setAutoSave] = useState(autoSaveProp)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const userTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setAutoSave(autoSaveProp)
  }, [autoSaveProp])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node) &&
        userTriggerRef.current &&
        !userTriggerRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  return (
    <header className="h-16 glass-strong border-b border-[hsl(var(--foreground)/0.06)] flex items-center justify-between px-5 shrink-0 z-50">
      {/* Left - Logo */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Hexagon size={28} className="text-primary" strokeWidth={1.5} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[8px] font-bold text-primary">AI</span>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-wide text-foreground">
            HMI Agent Studio
          </span>
          <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
            智能座舱设计平台
          </span>
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onOpenWorkspaceSettings?.()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          <Circle
            size={6}
            className={autoSave ? 'fill-emerald-400 text-emerald-400' : 'fill-muted-foreground text-muted-foreground'}
          />
          <span>{autoSave ? '已自动保存' : '未保存'}</span>
        </button>

        <div className="w-px h-5 bg-[hsl(var(--foreground)/0.06)] mx-2" />

        <button className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[hsl(var(--foreground)/0.04)] transition-colors duration-200 text-muted-foreground hover:text-foreground relative">
          <Moon size={16} />
        </button>
        <button className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[hsl(var(--foreground)/0.04)] transition-colors duration-200 text-muted-foreground hover:text-foreground relative">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-glow-pulse" />
        </button>
        <button className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[hsl(var(--foreground)/0.04)] transition-colors duration-200 text-muted-foreground hover:text-foreground">
          <Settings size={16} />
        </button>

        <div className="w-px h-5 bg-[hsl(var(--foreground)/0.06)] mx-2" />

        <div className="relative">
          <button
            ref={userTriggerRef}
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`ml-2 h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
              isLoggedIn
                ? 'bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 text-primary hover:shadow-glow-sm'
                : 'bg-transparent border border-[hsl(var(--foreground)/0.12)] text-muted-foreground hover:border-[hsl(var(--foreground)/0.2)]'
            }`}
          >
            {isLoggedIn ? 'U' : '?'}
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                ref={userMenuRef}
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden"
                style={{
                  background: 'hsl(var(--surface) / 0.85)',
                  backdropFilter: 'blur(40px) saturate(1.4)',
                  WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.08)',
                }}
              >
                <div className="relative z-10">
                  {isLoggedIn ? (
                    <>
                      <div className="px-4 py-3 border-b border-[hsl(var(--foreground)/0.06)]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 border border-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                            {userName.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-foreground">{userName}</div>
                            <div className="text-[10px] text-muted-foreground">{userEmail}</div>
                          </div>
                        </div>
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => { setUserMenuOpen(false) }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--foreground)/0.04)] transition-all duration-150"
                        >
                          <FileText size={13} className="text-muted-foreground/50" />
                          平台协议
                        </button>
                        <button
                          onClick={() => { setUserMenuOpen(false) }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--foreground)/0.04)] transition-all duration-150"
                        >
                          <RefreshCw size={13} className="text-muted-foreground/50" />
                          更新日志
                        </button>
                      </div>

                      <div className="mx-3 h-px bg-[hsl(var(--foreground)/0.06)]" />

                      <div className="py-1">
                        <button
                          onClick={() => { setUserMenuOpen(false); navigate('/login') }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--foreground)/0.04)] transition-all duration-150"
                        >
                          <ArrowLeftRight size={13} className="text-muted-foreground/50" />
                          切换账号
                        </button>
                        <button
                          onClick={() => { setUserMenuOpen(false); logout(); navigate('/') }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-red-400/80 hover:text-red-400 hover:bg-red-400/[0.04] transition-all duration-150"
                        >
                          <LogOut size={13} />
                          退出账号
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-2 px-4 text-center">
                      <p className="text-xs text-muted-foreground mb-3 mt-1">登录后可使用全部功能</p>
                      <button
                        onClick={() => { setUserMenuOpen(false); navigate('/login') }}
                        className="w-full py-2 text-xs font-medium text-foreground rounded-lg bg-primary/80 hover:bg-primary transition-colors"
                      >
                        去登录
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

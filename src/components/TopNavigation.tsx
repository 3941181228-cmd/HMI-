import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Hexagon,
  Bell,
  Settings,
  ChevronDown,
  Circle,
  LayoutGrid,
  Moon,
  Search,
  Plus,
  SlidersHorizontal,
  Clock,
  Zap,
  Cloud,
  CheckCircle2,
  Pencil,
  FileText,
  RefreshCw,
  LogOut,
  ArrowLeftRight,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const defaultProjects = [
  { id: '1', name: '项目 1', time: '2 分钟前', active: true },
  { id: '2', name: '项目 2', time: '1 小时前', active: false },
  { id: '3', name: '项目 3', time: '3 小时前', active: false },
  { id: '4', name: '项目 4', time: '昨天', active: false },
  { id: '5', name: '项目 5', time: '2 天前', active: false },
]

const quickActions = [
  { icon: Plus, label: '新建工作空间', shortcut: '⌘N' },
  { icon: SlidersHorizontal, label: '工作空间设置', shortcut: '⌘,' },
]

interface TopNavigationProps {
  autoSave?: boolean
  realTimeSync?: boolean
  onOpenWorkspaceSettings?: () => void
}

export default function TopNavigation({ autoSave: autoSaveProp = true, realTimeSync = true, onOpenWorkspaceSettings }: TopNavigationProps) {
  const navigate = useNavigate()
  const { isLoggedIn, userName, userEmail, logout } = useAuth()
  const [autoSave, setAutoSave] = useState(autoSaveProp)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [recentProjects, setRecentProjects] = useState(defaultProjects)
  const [currentProject, setCurrentProject] = useState(recentProjects[0])
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const userTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setAutoSave(autoSaveProp)
  }, [autoSaveProp])

  useEffect(() => {
    if (editingProjectId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingProjectId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setWorkspaceOpen(false)
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node) &&
        userTriggerRef.current &&
        !userTriggerRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false)
      }
    }
    if (workspaceOpen || userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [workspaceOpen, userMenuOpen])

  const startEditing = (projectId: string, currentName: string) => {
    setEditingProjectId(projectId)
    setEditName(currentName)
  }

  const saveEdit = () => {
    if (editingProjectId && editName.trim()) {
      setRecentProjects(prev =>
        prev.map(p => p.id === editingProjectId ? { ...p, name: editName.trim() } : p)
      )
      if (currentProject.id === editingProjectId) {
        setCurrentProject(prev => ({ ...prev, name: editName.trim() }))
      }
    }
    setEditingProjectId(null)
    setEditName('')
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveEdit()
    } else if (e.key === 'Escape') {
      setEditingProjectId(null)
      setEditName('')
    }
  }

  const handleNewWorkspace = () => {
    const maxNum = recentProjects.reduce((max, p) => {
      const match = p.name.match(/项目\s*(\d+)/)
      if (match) {
        const n = parseInt(match[1], 10)
        return n > max ? n : max
      }
      return max
    }, 0)
    const nextNum = maxNum + 1
    const newProject = {
      id: `project-${Date.now()}`,
      name: `项目 ${nextNum}`,
      time: '刚刚',
      active: true,
    }
    setRecentProjects(prev => {
      const updated = prev.map(p => ({ ...p, active: false }))
      return [newProject, ...updated]
    })
    setCurrentProject(newProject)
    setWorkspaceOpen(false)
  }

  const filteredProjects = recentProjects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

      {/* Center - Workspace Switcher */}
      <div className="relative">
        <button
          ref={triggerRef}
          onClick={() => setWorkspaceOpen(!workspaceOpen)}
          className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-[hsl(var(--surface-secondary)/0.6)] border border-[hsl(var(--foreground)/0.06)] hover:border-[hsl(var(--foreground)/0.12)] hover:bg-[hsl(var(--surface-secondary)/0.8)] transition-all duration-300"
        >
          <span className="text-sm font-medium text-foreground">{currentProject.name}</span>
          <motion.span
            animate={{ rotate: workspaceOpen ? 180 : 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <ChevronDown size={12} className="text-muted-foreground" />
          </motion.span>
        </button>

        <AnimatePresence>
          {workspaceOpen && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[380px] rounded-2xl overflow-hidden"
              style={{
                background: 'hsl(var(--surface) / 0.85)',
                backdropFilter: 'blur(40px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1)',
              }}
            >
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div
                  className="absolute -top-1/2 -right-1/4 w-64 h-64 rounded-full opacity-[0.03]"
                  style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)' }}
                />
              </div>

              <div className="relative z-10">
                {/* Search */}
                <div className="p-3 pb-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索工作空间..."
                      className="w-full h-9 pl-9 pr-3 text-xs bg-[hsl(var(--surface-secondary)/0.5)] border border-[hsl(var(--foreground)/0.06)] rounded-xl text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[hsl(var(--primary)/0.25)] focus:ring-1 focus:ring-[hsl(var(--primary)/0.1)] transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Current Workspace */}
                <div className="px-3 pb-2">
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/[0.06] border border-primary/[0.1]">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                      <Zap size={14} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{currentProject.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {autoSave ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 size={10} className="text-emerald-400" />
                            <span className="text-[10px] text-emerald-400/80">已自动保存</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Circle size={6} className="text-muted-foreground/40" />
                            <span className="text-[10px] text-muted-foreground/50">未自动保存</span>
                          </div>
                        )}
                        {realTimeSync ? (
                          <div className="flex items-center gap-1">
                            <Cloud size={9} className="text-primary/50" />
                            <span className="text-[10px] text-muted-foreground/50">已同步</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Cloud size={9} className="text-muted-foreground/30" />
                            <span className="text-[10px] text-muted-foreground/30">未同步</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[9px] text-emerald-400/60">AI 在线</span>
                    </div>
                  </div>
                </div>

                {/* Recent Projects */}
                <div className="px-3 pb-1">
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">最近项目</span>
                    <Clock size={10} className="text-muted-foreground/30" />
                  </div>
                  <div className="space-y-0.5">
                    {filteredProjects.map((project, index) => (
                      <motion.button
                        key={project.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: index * 0.03 }}
                        onClick={() => {
                          if (editingProjectId === project.id) return
                          setCurrentProject(project)
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault()
                          startEditing(project.id, project.name)
                        }}
                        className={`group w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-200 ${
                          currentProject.id === project.id
                            ? 'bg-primary/[0.06]'
                            : 'hover:bg-[hsl(var(--foreground)/0.04)]'
                        }`}
                      >
                        <div className={`w-0.5 h-4 rounded-full transition-all duration-200 ${
                          currentProject.id === project.id ? 'bg-primary/60' : 'bg-transparent group-hover:bg-primary/60'
                        }`} />
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                          currentProject.id === project.id ? 'bg-primary/10' : 'bg-[hsl(var(--surface-secondary)/0.6)]'
                        }`}>
                          {editingProjectId === project.id ? (
                            <Pencil size={10} className="text-primary" />
                          ) : (
                            <LayoutGrid size={11} className={`transition-colors ${
                              currentProject.id === project.id ? 'text-primary' : 'text-muted-foreground/50 group-hover:text-primary/70'
                            }`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {editingProjectId === project.id ? (
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              onBlur={saveEdit}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full px-1.5 py-0.5 text-xs font-medium bg-background border border-primary/30 rounded-md text-foreground outline-none focus:border-primary/60 transition-colors"
                            />
                          ) : (
                            <div className={`text-xs font-medium truncate ${
                              currentProject.id === project.id ? 'text-primary' : 'text-foreground/80 group-hover:text-foreground'
                            }`}>
                              {project.name}
                            </div>
                          )}
                        </div>
                        {currentProject.id === project.id && editingProjectId !== project.id && (
                          <CheckCircle2 size={12} className="text-primary shrink-0" />
                        )}
                        {editingProjectId === project.id ? (
                          <span className="text-[9px] text-primary/60 shrink-0">编辑中</span>
                        ) : (
                          <span className="text-[9px] text-muted-foreground/30 shrink-0">{project.time}</span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-4 my-2 h-px bg-[hsl(var(--foreground)/0.06)]" />

                {/* Quick Actions */}
                <div className="px-3 pb-3">
                  <div className="space-y-0.5">
                    {quickActions.map((action, index) => (
                      <motion.button
                        key={action.label}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: 0.15 + index * 0.03 }}
                        onClick={() => {
                          if (action.label === '新建工作空间') {
                            handleNewWorkspace()
                          } else if (action.label === '工作空间设置') {
                            setWorkspaceOpen(false)
                            onOpenWorkspaceSettings?.()
                          }
                        }}
                        className="group w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-200 hover:bg-[hsl(var(--foreground)/0.04)]"
                      >
                        <div className="w-0.5 h-4 rounded-full bg-transparent group-hover:bg-primary/40 transition-all duration-200" />
                        <action.icon size={13} className="text-muted-foreground/50 group-hover:text-primary/70 transition-colors shrink-0" />
                        <span className="text-xs text-muted-foreground/80 group-hover:text-foreground transition-colors flex-1">{action.label}</span>
                        <span className="text-[9px] text-muted-foreground/20 font-mono">{action.shortcut}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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

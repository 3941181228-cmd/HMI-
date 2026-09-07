import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Clock,
  Sparkles,
  PencilRuler,
  Palette,
  Image,
  ShieldCheck,
  Download,
  Settings,
  ChevronDown,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HistoryRecord } from '@/hooks/useHistory'

interface SidebarSection {
  id: string
  icon: React.ReactNode
  title: string
  items: string[]
  navigateTo?: string
}

const sections: SidebarSection[] = [
  {
    id: 'history',
    icon: <Clock size={16} />,
    title: '创作记录',
    items: ['最近项目', '历史方案', '自动保存', '版本记录'],
  },
  {
    id: 'ai-gen',
    icon: <Sparkles size={16} />,
    title: 'AI 生成',
    items: ['AI 生成 HMI', 'AI 生成壁纸', '3D 模型生成'],
    navigateTo: 'generate',
  },
  {
    id: 'hmi-edit',
    icon: <PencilRuler size={16} />,
    title: 'HMI 编辑',
    items: [],
    navigateTo: 'edit',
  },
  {
    id: 'theme',
    icon: <Palette size={16} />,
    title: '主题工作室',
    items: ['AI 智能换色', 'Figma 一键换色'],
    navigateTo: 'theme:ai-recolor',
  },
  {
    id: 'wallpaper',
    icon: <Image size={16} />,
    title: '壁纸引擎',
    items: ['动漫卡通类', '自然风光类', '抽象艺术类', '城市建筑类', '交通工具类', '动物植物类'],
  },
  {
    id: 'check',
    icon: <ShieldCheck size={16} />,
    title: 'AI 设计自检',
    items: ['导入检测', '布局对齐', '字体规范', '色彩对比', '间距系统'],
  },
  {
    id: 'export',
    icon: <Download size={16} />,
    title: '导出中心',
    items: [],
    navigateTo: 'export',
  },
  {
    id: 'settings',
    icon: <Settings size={16} />,
    title: '系统设置',
    items: [],
    navigateTo: 'settings:theme',
  },
]

interface SidebarProps {
  onNavigate?: (target: string) => void
  activeSection?: string
  historyRecords?: HistoryRecord[]
  onClearHistory?: () => void
}

// Map HMI edit item names to sub-modes
const editItemMap: Record<string, string> = {
  'PNG 生成 SVG': 'edit:png2svg',
  '文本提取': 'edit:text_extract',
}

const genItemMap: Record<string, string> = {
  'AI 生成 HMI': 'generate',
  'AI 生成壁纸': 'ai-wallpaper',
  '3D 模型生成': '3d-model',
}

const themeItemMap: Record<string, string> = {
  'AI 智能换色': 'theme:ai-recolor',
  'Figma 一键换色': 'theme:figma-swap',
}

const wallpaperItemMap: Record<string, string> = {
  '动漫卡通类': 'wallpaper:anime',
  '自然风光类': 'wallpaper:nature',
  '抽象艺术类': 'wallpaper:abstract',
  '城市建筑类': 'wallpaper:city',
  '交通工具类': 'wallpaper:vehicle',
  '动物植物类': 'wallpaper:animal',
}

const exportItemMap: Record<string, string> = {
  'PNG 导出': 'export:png',
  'SVG 导出': 'export:svg',
  '壁纸导出': 'export:wallpaper',
  'JSON 导出': 'export:json',
  '设计令牌': 'export:token',
  '开发导出': 'export:dev',
}

const wallpaperSectionToItem: Record<string, string> = {
  anime: '动漫卡通类',
  nature: '自然风光类',
  abstract: '抽象艺术类',
  city: '城市建筑类',
  vehicle: '交通工具类',
  animal: '动物植物类',
}

const checkItemMap: Record<string, string> = {
  '布局对齐': 'check:layout',
  '布局对齐 ✓': 'check:layout',
  '字体规范': 'check:typography',
  '字体规范 ✓': 'check:typography',
  '色彩对比': 'check:color',
  '色彩对比 ✓': 'check:color',
  '间距系统': 'check:spacing',
  '间距系统 ✓': 'check:spacing',
  '导入检测': 'check:full',
}

const checkCategoryToItems: Record<string, string[]> = {
  'ai-gen': ['AI 生成 HMI', 'AI 生成壁纸'],
  'hmi-edit': [],
  'theme': ['AI 智能换色', 'Figma 一键换色'],
  'wallpaper': [],
  'check': ['导入检测', '布局对齐', '字体规范', '色彩对比', '间距系统'],
}

export default function Sidebar({ onNavigate, activeSection, historyRecords = [], onClearHistory }: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  )
  const [activeItem, setActiveItem] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (activeSection && wallpaperSectionToItem[activeSection]) {
      setActiveItem(wallpaperSectionToItem[activeSection])
      setExpandedSections((prev) => new Set([...prev, 'wallpaper']))
    }
    if (activeSection && ['full', 'layout', 'typography', 'color', 'spacing'].includes(activeSection)) {
      const checkItemName = activeSection === 'full' ? '导入检测' : 
        Object.entries(checkItemMap).find(([, v]) => v === `check:${activeSection}`)?.[0]
      if (checkItemName) setActiveItem(checkItemName)
      setExpandedSections((prev) => new Set([...prev, 'check']))
    }
  }, [activeSection])

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSectionClick = (section: SidebarSection) => {
    setActiveItem('')
    if (section.items.length === 0 && section.navigateTo) {
      onNavigate?.(section.navigateTo)
      return
    }
    if (section.id === 'history') {
      onNavigate?.('dashboard')
    }
    if (section.id === 'check') {
      onNavigate?.('check')
      toggleSection(section.id)
    } else if (section.id === 'hmi-edit') {
      onNavigate?.('edit')
    } else if (section.id === 'theme') {
      onNavigate?.('theme:ai-recolor')
      toggleSection(section.id)
    } else if (section.id === 'export') {
      onNavigate?.('export')
    } else if (section.id === 'wallpaper') {
      onNavigate?.('wallpaper')
      toggleSection(section.id)
    } else if (section.id === 'ai-gen') {
      onNavigate?.('generate')
      toggleSection(section.id)
    }
  }

  const handleItemClick = (sectionId: string, item: string) => {
    setActiveItem(item)
    if (checkItemMap[item]) {
      onNavigate?.(checkItemMap[item])
      return
    }
    if (genItemMap[item]) {
      onNavigate?.(genItemMap[item])
    } else if (editItemMap[item]) {
      onNavigate?.(editItemMap[item])
    } else if (themeItemMap[item]) {
      onNavigate?.(themeItemMap[item])
    } else if (wallpaperItemMap[item]) {
      onNavigate?.(wallpaperItemMap[item])
    } else if (exportItemMap[item]) {
      onNavigate?.(exportItemMap[item])
    }
  }

  const filteredSections = sections.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.items.some((item) => item.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <aside className="w-[280px] h-full glass-strong flex flex-col overflow-hidden shrink-0">
      {/* Search */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索 AI 工具..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[hsl(var(--surface-secondary)/0.8)] border border-[hsl(var(--foreground)/0.06)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--primary)/0.3)] focus:ring-1 focus:ring-[hsl(var(--primary)/0.15)] transition-all duration-200"
          />
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
        {filteredSections.map((section) => {
          const isExpanded = expandedSections.has(section.id)
          const isDirectNav = section.items.length === 0 && section.navigateTo
          const isActive = activeSection === section.id || (section.id === 'history' && activeSection === 'history') || (section.id === 'wallpaper' && ['anime', 'nature', 'abstract', 'city', 'vehicle', 'animal'].includes(activeSection || '')) || (section.id === 'check' && ['full', 'layout', 'typography', 'color', 'spacing'].includes(activeSection || ''))

          if (isDirectNav) {
            return (
              <div key={section.id} className="animate-fade-in">
                <button
                  onClick={() => handleSectionClick(section)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--foreground)/0.03)]'
                  )}
                >
                  <span className={cn(
                    'transition-colors duration-200',
                    isActive ? 'text-primary' : 'text-primary/70 group-hover:text-primary'
                  )}>
                    {section.icon}
                  </span>
                  <span className="flex-1 text-left">{section.title}</span>
                  <Sparkles size={12} className={cn(
                    'transition-all duration-200',
                    isActive ? 'text-primary' : 'text-primary/30 group-hover:text-primary/60'
                  )} />
                </button>
              </div>
            )
          }

          return (
            <div key={section.id} className="animate-fade-in">
              <button
                onClick={() => handleSectionClick(section)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--foreground)/0.03)]'
                )}
              >
                <span className={cn(
                  'transition-colors duration-200',
                  isActive ? 'text-primary' : 'text-primary/70 group-hover:text-primary'
                )}>
                  {section.icon}
                </span>
                <span className="flex-1 text-left">{section.title}</span>
                {section.id === 'history' && historyRecords.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary mr-1">
                    {historyRecords.length}
                  </span>
                )}
                <motion.span
                  animate={{ rotate: isExpanded ? 0 : -90 }}
                  transition={{ duration: 0.2 }}
                  className="text-muted-foreground/50"
                >
                  <ChevronDown size={12} />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    {/* 创作记录：不显示内容，点击直接导航到首页 */}
                    {section.id === 'history' ? (
                      <div className="px-2 py-1.5 space-y-2">
                        {(() => {
                          const hmiRecords = historyRecords.filter(r => r.category === 'hmi' || (!r.category && !r.prompt?.startsWith('壁纸')))
                          const wallpaperRecords = historyRecords.filter(r => r.category === 'wallpaper' || (!r.category && r.prompt?.startsWith('壁纸')))
                          return (
                            <>
                              {hmiRecords.length > 0 && (
                                <div>
                                  <div className="text-[10px] text-muted-foreground/40 px-2 mb-1 font-medium">HMI 设计</div>
                                  {hmiRecords.slice(0, 3).map((record) => (
                                    <button
                                      key={record.id}
                                      onClick={() => onNavigate?.('generate')}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-muted-foreground/70 hover:text-foreground hover:bg-[hsl(var(--foreground)/0.03)] transition-all duration-200"
                                    >
                                      <Sparkles size={10} className="shrink-0 text-primary/40" />
                                      <span className="truncate">{record.prompt.slice(0, 20)}</span>
                                      <span className="ml-auto text-[9px] text-muted-foreground/30">
                                        {new Date(record.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {wallpaperRecords.length > 0 && (
                                <div>
                                  <div className="text-[10px] text-muted-foreground/40 px-2 mb-1 font-medium">壁纸生成</div>
                                  {wallpaperRecords.slice(0, 3).map((record) => (
                                    <button
                                      key={record.id}
                                      onClick={() => onNavigate?.('ai-wallpaper')}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-muted-foreground/70 hover:text-foreground hover:bg-[hsl(var(--foreground)/0.03)] transition-all duration-200"
                                    >
                                      <Image size={10} className="shrink-0 text-primary/40" />
                                      <span className="truncate">{record.prompt.replace(/^壁纸:\s*/, '').slice(0, 20)}</span>
                                      <span className="ml-auto text-[9px] text-muted-foreground/30">
                                        {new Date(record.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              <button
                                onClick={() => onNavigate?.('dashboard')}
                                className="w-full text-[11px] text-muted-foreground/50 text-center py-2 hover:text-muted-foreground transition-colors"
                              >
                                查看全部记录 ({historyRecords.length})
                              </button>
                            </>
                          )
                        })()}
                      </div>
                    ) : (
                      <div className="pl-4 py-1 space-y-0.5">
                        {section.items.map((item) => (
                          <button
                            key={item}
                            onClick={() => {
                              setActiveItem(item)
                              if (genItemMap[item]) {
                                onNavigate?.(genItemMap[item])
                              } else if (editItemMap[item]) {
                                onNavigate?.(editItemMap[item])
                              } else if (themeItemMap[item]) {
                                onNavigate?.(themeItemMap[item])
                              } else if (wallpaperItemMap[item]) {
                                onNavigate?.(wallpaperItemMap[item])
                              } else if (checkItemMap[item]) {
                                onNavigate?.(checkItemMap[item])
                              } else if (exportItemMap[item]) {
                                onNavigate?.(exportItemMap[item])
                              }
                            }}
                            className={cn(
                              'sidebar-item text-[13px] w-full',
                              activeItem === item && 'active'
                            )}
                          >
                            <ChevronRight
                              size={10}
                              className={cn(
                                'shrink-0 transition-transform duration-200',
                                activeItem === item ? 'text-primary' : 'text-muted-foreground/30'
                              )}
                            />
                            <span>{item}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

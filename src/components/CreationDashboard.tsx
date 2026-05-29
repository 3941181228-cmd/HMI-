import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Clock, Star, ArrowUpDown, Sparkles, ArrowRight, Trash2, CheckSquare, Square, X, ZoomIn, ChevronLeft, ChevronRight, Image, Palette, Download, FolderPlus, Plus } from 'lucide-react'
import type { HistoryRecord, HistoryCategory } from '@/hooks/useHistory'
import { wallpaperCategories } from '@/data/wallpaperData'
import { getProxyImageUrl } from '@/utils/imageProxy'

interface CreationDashboardProps {
  records: HistoryRecord[]
  onOpenProject?: (record: HistoryRecord) => void
  onStartGenerate?: () => void
  onDeleteRecords?: (ids: string[]) => void
  onNavigateToHmi?: () => void
  onNavigateToWallpaper?: () => void
}

type Filter = 'recent' | 'starred' | 'time'

const categoryLabels: Record<HistoryCategory, string> = {
  hmi: 'HMI 设计',
  wallpaper: '壁纸生成',
  theme: '主题换色',
  other: '其他',
}

const categoryIcons: Record<HistoryCategory, React.ReactNode> = {
  hmi: <Sparkles className="w-3 h-3" />,
  wallpaper: <Image className="w-3 h-3" />,
  theme: <Palette className="w-3 h-3" />,
  other: <Clock className="w-3 h-3" />,
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

function getProjectMeta(prompt: string) {
  // Extract style/scene info from prompt
  const styles = ['极简', '特斯拉', '保时捷', '蔚来', '比亚迪', '宝马']
  const scenes = ['充电界面', '仪表盘', '导航', 'ADAS', '媒体', '空调']

  const style = styles.find(s => prompt.toLowerCase().includes(s.toLowerCase())) || '自定义'
  const scene = scenes.find(s => prompt.toLowerCase().includes(s.toLowerCase())) || 'HMI Design'

  return { style, scene }
}

export default function CreationDashboard({ records, onOpenProject, onStartGenerate, onDeleteRecords, onNavigateToHmi, onNavigateToWallpaper }: CreationDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<Filter>('recent')
  const [activeCategory, setActiveCategory] = useState<HistoryCategory>('hmi')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [currentImages, setCurrentImages] = useState<string[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [importTarget, setImportTarget] = useState<string>('')
  const [customCategoryName, setCustomCategoryName] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)

  const customCategories = (() => {
    try {
      const raw = localStorage.getItem('wallpaper-custom-categories')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })()

  const allImportCategories = [
    ...wallpaperCategories.map(c => ({ id: c.id, name: c.name, type: 'builtin' as const })),
    ...customCategories.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name, type: 'custom' as const })),
  ]

  const filteredRecords = records
    .filter(r => r.category === activeCategory)
    .filter(r => r.prompt.toLowerCase().includes(searchQuery.toLowerCase()))

  const isAllSelected = filteredRecords.length > 0 && filteredRecords.every(r => selectedIds.includes(r.id))
  const selectedCount = selectedIds.filter(id => filteredRecords.some(r => r.id === id)).length

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredRecords.map(r => r.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleImportToEngine = () => {
    if (!importTarget || selectedIds.length === 0) return

    const selectedRecords = records.filter(r => selectedIds.includes(r.id))
    const importItems = selectedRecords.flatMap(r =>
      r.images.map((img, idx) => ({
        id: `imported-${r.id}-${idx}`,
        filename: img,
        name: r.prompt.replace(/^壁纸:\s*/, '').slice(0, 20) || 'AI生成壁纸',
        tags: ['AI生成'],
        category: importTarget,
      }))
    )

    const storageKey = `wallpaper-engine-imports-${importTarget}`
    try {
      const rawExisting = JSON.parse(localStorage.getItem(storageKey) || '[]')
      const existing = Array.isArray(rawExisting) ? rawExisting : []
      const merged = [...existing, ...importItems]
      localStorage.setItem(storageKey, JSON.stringify(merged))
    } catch {
      try {
        localStorage.setItem(storageKey, JSON.stringify(importItems))
      } catch {}
    }

    setShowImportModal(false)
    setImportTarget('')
    setSelectedIds([])
    setImportSuccess(true)
    setTimeout(() => setImportSuccess(false), 3000)
  }

  const handleAddCustomCategory = () => {
    if (!customCategoryName.trim()) return
    const newCat = {
      id: `custom-${Date.now()}`,
      name: customCategoryName.trim(),
    }
    const existing = (() => {
      try {
        const raw = localStorage.getItem('wallpaper-custom-categories')
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed : []
      } catch { return [] }
    })()
    try {
      existing.push(newCat)
      localStorage.setItem('wallpaper-custom-categories', JSON.stringify(existing))
    } catch {}
    setImportTarget(newCat.id)
    setCustomCategoryName('')
    setShowCustomInput(false)
  }

  const handleDeleteSelected = () => {
    if (selectedCount > 0 && onDeleteRecords) {
      const filteredSelectedIds = selectedIds.filter(id => filteredRecords.some(r => r.id === id))
      onDeleteRecords(filteredSelectedIds)
      setSelectedIds(prev => prev.filter(id => !filteredSelectedIds.includes(id)))
    }
  }

  const openImagePreview = (images: string[], index: number) => {
    setCurrentImages(images)
    setPreviewIndex(index)
    setPreviewImage(images[index])
  }

  const closeImagePreview = () => {
    setPreviewImage(null)
    setCurrentImages([])
    setPreviewIndex(0)
  }

  const prevImage = () => {
    if (previewIndex > 0) {
      const newIndex = previewIndex - 1
      setPreviewIndex(newIndex)
      setPreviewImage(currentImages[newIndex])
    }
  }

  const nextImage = () => {
    if (previewIndex < currentImages.length - 1) {
      const newIndex = previewIndex + 1
      setPreviewIndex(newIndex)
      setPreviewImage(currentImages[newIndex])
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto p-8">
      <div className="max-w-[1100px] mx-auto">
        {/* Import Success Toast */}
        <AnimatePresence>
          {importSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm shadow-lg backdrop-blur-sm"
            >
              <Download className="w-4 h-4" />
              已成功导入壁纸引擎
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8"
        >
          <h1 className="text-2xl font-light text-foreground tracking-tight mb-1">
            创作记录
          </h1>
          <p className="text-sm text-muted-foreground">
            你的 AI 创作项目历史
          </p>
        </motion.div>

        {/* Toolbar */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="flex items-center justify-between mb-4 gap-4"
        >
          {/* Search */}
          <div className="relative flex-1 max-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="搜索项目..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-surface-secondary/50 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Select All */}
            {filteredRecords.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                  isAllSelected
                    ? 'bg-primary/10 text-primary/80'
                    : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-surface-secondary/50'
                }`}
              >
                {isAllSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                {isAllSelected ? '取消全选' : '全选'}
              </button>
            )}

            {/* Delete Selected */}
            {selectedCount > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all duration-200"
              >
                <Trash2 className="w-3 h-3" />
                删除 ({selectedCount})
              </button>
            )}

            {/* Filters */}
            <div className="flex items-center gap-1 ml-2">
              {([
                { id: 'recent' as Filter, icon: Clock, label: '最近编辑' },
                ...(activeCategory !== 'wallpaper' ? [{ id: 'starred' as Filter, icon: Star, label: '收藏项目' }] : []),
                { id: 'time' as Filter, icon: ArrowUpDown, label: '时间排序' },
              ]).map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                    activeFilter === filter.id
                      ? 'bg-primary/10 text-primary/80'
                      : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-surface-secondary/50'
                  }`}
                >
                  <filter.icon className="w-3 h-3" />
                  {filter.label}
                </button>
              ))}
              {activeCategory === 'wallpaper' && (
                <button
                  onClick={() => selectedIds.length > 0 && setShowImportModal(true)}
                  disabled={selectedIds.length === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ml-1 ${
                    selectedIds.length > 0
                      ? 'bg-primary/10 text-primary/80 hover:bg-primary/20 cursor-pointer'
                      : 'text-muted-foreground/30 cursor-not-allowed'
                  }`}
                >
                  <Download className="w-3 h-3" />
                  导入壁纸引擎{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="flex items-center gap-2 mb-6"
        >
          {([
            { id: 'hmi' as const, label: 'HMI 设计', icon: <Sparkles className="w-3 h-3" /> },
            { id: 'wallpaper' as const, label: '壁纸生成', icon: <Image className="w-3 h-3" /> },
            { id: 'theme' as const, label: '主题换色', icon: <Palette className="w-3 h-3" /> },
          ]).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                activeCategory === cat.id
                  ? 'bg-primary/10 text-primary/80 border border-primary/20'
                  : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-surface-secondary/50 border border-transparent'
              }`}
            >
              {cat.icon}
              {cat.label}
              <span className="text-[10px] text-muted-foreground/40">
                ({records.filter(r => r.category === cat.id).length})
              </span>
            </button>
          ))}
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {filteredRecords.length > 0 ? (
            <motion.div
              key="grid"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 gap-5"
            >
              {filteredRecords.map((record) => {
                const meta = getProjectMeta(record.prompt)
                const isSelected = selectedIds.includes(record.id)
                return (
                  <motion.div
                    key={record.id}
                    variants={cardVariants}
                    className={`group relative rounded-2xl glass cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-glow-sm hover:-translate-y-0.5 border-glow ${
                      isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                    }`}
                  >
                    {/* Selection checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelect(record.id)
                      }}
                      className="absolute top-3 left-3 z-10 w-6 h-6 rounded border border-foreground/20 bg-background/80 backdrop-blur-sm flex items-center justify-center hover:border-primary/50 hover:bg-primary/10 transition-all duration-200"
                    >
                      {isSelected && <CheckSquare className="w-4 h-4 text-primary" />}
                    </button>

                    {/* Thumbnail */}
                    <div 
                      className="h-[140px] bg-surface-secondary/30 relative overflow-hidden cursor-pointer"
                      onClick={() => openImagePreview(record.images, 0)}
                    >
                      {record.images[0] ? (
                        <img
                          src={getProxyImageUrl(record.images[0])}
                          alt={record.prompt}
                          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-12 h-12 rounded-xl bg-surface-tertiary/50 border border-border/30" />
                        </div>
                      )}
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      {/* Zoom icon */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center">
                          <ZoomIn className="w-5 h-5 text-foreground" />
                        </div>
                      </div>
                    </div>

                    {/* Card info */}
                    <div 
                      className="p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-medium text-foreground/90 line-clamp-1 flex-1">
                          {record.prompt.slice(0, 30) || 'HMI Project'}
                        </h3>
                        <span className="text-[10px] text-emerald-400/60 ml-2 flex-shrink-0">
                          AI 已生成
                        </span>
                      </div>

                      {/* Tags */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded bg-primary/8 text-primary/60 border border-primary/10">
                          {categoryIcons[record.category]}
                          {categoryLabels[record.category]}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] rounded bg-surface-tertiary/60 text-muted-foreground/60">
                          {meta.style}
                        </span>
                      </div>

                      {/* Time */}
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-muted-foreground/40" />
                        <span className="text-[11px] text-muted-foreground/50">
                          {getTimeAgo(record.createdAt)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          ) : (
            /* Empty state */
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center justify-center py-24"
            >
              {/* Background glow */}
              <div className="absolute w-[400px] h-[300px] rounded-full bg-primary/[0.03] blur-[80px] pointer-events-none" />

              <div className="relative flex flex-col items-center text-center">
                {/* Decorative icon */}
                <div className="w-20 h-20 rounded-2xl glass border border-primary/10 flex items-center justify-center mb-6">
                  <Sparkles className="w-8 h-8 text-primary/40" />
                </div>

                <h2 className="text-xl font-light text-foreground mb-2">
                  开始创建你的第一个 HMI 项目
                </h2>
                <p className="text-sm text-muted-foreground/60 max-w-sm mb-8">
                  使用 AI Agent 智能生成新能源座舱界面，从 Prompt 到 HMI 设计方案一键完成
                </p>

                <button
                  onClick={onStartGenerate}
                  className="group flex items-center gap-2.5 px-7 py-3.5 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:shadow-glow transition-all duration-300"
                >
                  开始 AI 生成
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Preview Modal */}
        <AnimatePresence>
          {previewImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeImagePreview}
              className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8"
            >
              {/* Close Button */}
              <button
                onClick={closeImagePreview}
                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              {/* Previous Button */}
              {currentImages.length > 1 && previewIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    prevImage()
                  }}
                  className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
              )}

              {/* Image */}
              <motion.img
                key={previewImage}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                src={previewImage}
                alt="Preview"
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />

              {/* Next Button */}
              {currentImages.length > 1 && previewIndex < currentImages.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    nextImage()
                  }}
                  className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              )}

              {/* Image Counter */}
              {currentImages.length > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/10">
                  <span className="text-sm text-white">
                    {previewIndex + 1} / {currentImages.length}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Import to Wallpaper Engine Modal */}
        <AnimatePresence>
          {showImportModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImportModal(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-background border border-border/40 rounded-2xl shadow-2xl overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <FolderPlus className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-medium text-foreground">导入壁纸引擎</h3>
                  </div>
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="w-7 h-7 rounded-lg hover:bg-surface-secondary/50 flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Info */}
                <div className="px-6 py-3 bg-surface-secondary/20 border-b border-border/20">
                  <p className="text-xs text-muted-foreground">
                    已选择 <span className="text-primary font-medium">{selectedIds.length}</span> 项壁纸，选择目标分类后导入壁纸引擎
                  </p>
                </div>

                {/* Category List */}
                <div className="px-6 py-4 space-y-2 max-h-[320px] overflow-y-auto">
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">现有分类</p>
                  {allImportCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => { setImportTarget(cat.id); setShowCustomInput(false) }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-200 ${
                        importTarget === cat.id
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'text-foreground/80 hover:bg-surface-secondary/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          importTarget === cat.id ? 'bg-primary/15' : 'bg-surface-secondary/50'
                        }`}>
                          {cat.type === 'builtin' ? (
                            <Image className="w-4 h-4 text-primary/60" />
                          ) : (
                            <FolderPlus className="w-4 h-4 text-primary/60" />
                          )}
                        </div>
                        <div className="text-left">
                          <div className="text-xs font-medium">{cat.name}</div>
                          <div className="text-[10px] text-muted-foreground/50">
                            {cat.type === 'builtin' ? '内置分类' : '自定义分类'}
                          </div>
                        </div>
                      </div>
                      {importTarget === cat.id && (
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        </div>
                      )}
                    </button>
                  ))}

                  {/* Custom Category */}
                  <div className="pt-2">
                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">自定义分类</p>
                    {!showCustomInput ? (
                      <button
                        onClick={() => { setShowCustomInput(true); setImportTarget('') }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm text-muted-foreground/60 hover:text-foreground hover:bg-surface-secondary/30 border border-dashed border-border/40 transition-all duration-200"
                      >
                        <div className="w-8 h-8 rounded-lg bg-surface-secondary/30 flex items-center justify-center">
                          <Plus className="w-4 h-4" />
                        </div>
                        <span className="text-xs">新增自定义分类</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Plus className="w-4 h-4 text-primary" />
                        </div>
                        <input
                          type="text"
                          value={customCategoryName}
                          onChange={(e) => setCustomCategoryName(e.target.value)}
                          placeholder="输入分类名称..."
                          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleAddCustomCategory()}
                        />
                        <button
                          onClick={handleAddCustomCategory}
                          className="px-2.5 py-1 rounded-md text-[10px] bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                        >
                          添加
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/30">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-surface-secondary/50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleImportToEngine}
                    disabled={!importTarget || selectedIds.length === 0}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:shadow-glow transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
                  >
                    <Download className="w-3 h-3" />
                    导入到壁纸引擎
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

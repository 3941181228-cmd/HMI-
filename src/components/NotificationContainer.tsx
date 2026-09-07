import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, Sparkles, Download, RefreshCw, Layers } from 'lucide-react'
import { useSystemSettings, type AppNotification } from '@/contexts/SystemSettingsContext'

/**
 * 全局通知容器
 * - 订阅 SystemSettingsContext 的通知事件
 * - 根据设置中的 style（banner/alert/silent）和 bannerDuration 渲染
 * - 使用 glass class 让模糊特效真实生效
 */
export default function NotificationContainer() {
  const { settings, subscribe } = useSystemSettings()
  const [list, setList] = useState<AppNotification[]>([])

  // 订阅通知事件
  useEffect(() => {
    const unsub = subscribe((n) => {
      setList((prev) => [...prev, n])
    })
    return unsub
  }, [subscribe])

  // 自动移除过期通知
  const remove = useCallback((id: string) => {
    setList((prev) => prev.filter((n) => n.id !== id))
  }, [])

  // 当 style 为 silent 或全局关闭时不渲染
  if (!settings.notifications.enabled || settings.notifications.style === 'silent') {
    return null
  }

  // 不同通知样式的位置
  const positionClass =
    settings.notifications.style === 'alert'
      ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'  // 屏幕中央弹窗
      : 'top-4 right-4'  // 右上角横幅

  return (
    <div className={`fixed z-[100] flex flex-col gap-2 w-80 pointer-events-none ${positionClass}`}>
      <AnimatePresence>
        {list.map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            duration={settings.notifications.bannerDuration}
            style={settings.notifications.style}
            onClose={() => remove(n.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

function NotificationItem({
  notification,
  duration,
  style,
  onClose,
}: {
  notification: AppNotification
  duration: number
  style: string
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration * 1000)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  // 应用图标映射
  const appConfig: Record<string, { icon: typeof Bell; color: string }> = {
    aiGenerate: { icon: Sparkles, color: 'text-primary' },
    exportReady: { icon: Download, color: 'text-emerald-400' },
    systemUpdate: { icon: RefreshCw, color: 'text-blue-400' },
    figmaSync: { icon: Layers, color: 'text-orange-400' },
  }
  const cfg = appConfig[notification.app] || { icon: Bell, color: 'text-primary' }
  const Icon = cfg.icon

  // alert 模式：模态遮罩
  if (style === 'alert') {
    return (
      <motion.div
        className="fixed inset-0 z-[101] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-primary/30"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Icon className={`w-5 h-5 ${cfg.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-foreground">{notification.title}</h4>
              {notification.body && (
                <p className="text-xs text-muted-foreground mt-1 break-words">{notification.body}</p>
              )}
              <button
                onClick={onClose}
                className="mt-3 px-4 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs rounded-lg transition-colors"
              >
                确定
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-foreground/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  // banner 模式：右上角横幅
  return (
    <motion.div
      className="glass rounded-xl p-3 shadow-xl border border-foreground/10 pointer-events-auto cursor-pointer"
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={onClose}
      layout
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Icon className={`w-4 h-4 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold text-foreground truncate">{notification.title}</h4>
          {notification.body && (
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {/* 进度条：显示剩余时间 */}
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 bg-primary/40 rounded-full"
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: duration, ease: 'linear' }}
      />
    </motion.div>
  )
}

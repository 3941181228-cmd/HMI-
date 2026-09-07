import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

// ============================================================
// 系统偏好设置类型定义
// ============================================================

/** 动效强度级别：minimal 低 / smooth 中 / premium 高 */
export type MotionLevel = 'minimal' | 'smooth' | 'premium'

/** 通知样式：banner 横幅 / alert 弹窗 / silent 静默 */
export type NotificationStyle = 'banner' | 'alert' | 'silent'

/** 通知声音类型 */
export type NotificationSound = 'none' | 'default' | 'subtle' | 'glass'

/**
 * 系统设置完整结构
 */
export interface SystemSettings {
  // ── 1. 动效强度 ──
  motion: {
    /** 动效强度级别（低/中/高） */
    level: MotionLevel
    /** 动效持续时间倍率（minimal=0.4, smooth=1.0, premium=1.6） */
    durationScale: number
    /** 是否启用加载动画 */
    loadingAnimation: boolean
    /** 是否启用页面切换动画 */
    pageTransition: boolean
  }

  // ── 2. 背景模糊 ──
  blur: {
    /** 模糊总开关 */
    enabled: boolean
    /** 模糊强度 0-4（共 5 级） */
    level: 0 | 1 | 2 | 3 | 4
  }

  // ── 3. 通知管理 ──
  notifications: {
    /** 全局通知开关 */
    enabled: boolean
    /** 按应用分类的开关 */
    apps: {
      aiGenerate: boolean
      exportReady: boolean
      systemUpdate: boolean
      figmaSync: boolean
    }
    /** 显示样式 */
    style: NotificationStyle
    /** 声音提醒 */
    sound: NotificationSound
    /** 横幅持续时间（秒） */
    bannerDuration: number
  }
}

/** 默认设置 */
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  motion: {
    level: 'smooth',
    durationScale: 1.0,
    loadingAnimation: true,
    pageTransition: true,
  },
  blur: {
    enabled: true,
    level: 2,
  },
  notifications: {
    enabled: true,
    apps: {
      aiGenerate: true,
      exportReady: true,
      systemUpdate: false,
      figmaSync: true,
    },
    style: 'banner',
    sound: 'default',
    bannerDuration: 5,
  },
}

// ============================================================
// Context
// ============================================================

interface SystemSettingsContextValue {
  settings: SystemSettings
  /** 更新某个分类的某个字段（支持嵌套） */
  update: <K extends keyof SystemSettings, SK extends keyof SystemSettings[K]>(
    category: K,
    field: SK,
    value: SystemSettings[K][SK]
  ) => void
  /** 整体替换某个分类 */
  setCategory: <K extends keyof SystemSettings>(
    category: K,
    value: Partial<SystemSettings[K]>
  ) => void
  /** 重置全部设置 */
  reset: () => void
  /** 派生值：动效倍率（0.4 / 1.0 / 1.6），用于 MotionConfig */
  motionScale: number
  /** 推送一个系统通知（受 notifications 设置控制） */
  notify: (notification: { app: keyof SystemSettings['notifications']['apps']; title: string; body?: string }) => void
  /** 订阅通知事件（供 NotificationContainer 使用） */
  subscribe: (handler: (n: AppNotification) => void) => () => void
}

/** 应用级通知对象 */
export interface AppNotification {
  id: string
  app: keyof SystemSettings['notifications']['apps']
  title: string
  body?: string
  createdAt: number
}

const SystemSettingsContext = createContext<SystemSettingsContextValue | null>(null)

const STORAGE_KEY = 'hmi-system-settings'

function loadSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SYSTEM_SETTINGS
    // 浅合并以容忍新增字段
    const parsed = JSON.parse(raw) as Partial<SystemSettings>
    return {
      motion: { ...DEFAULT_SYSTEM_SETTINGS.motion, ...parsed.motion },
      blur: { ...DEFAULT_SYSTEM_SETTINGS.blur, ...parsed.blur },
      notifications: {
        ...DEFAULT_SYSTEM_SETTINGS.notifications,
        ...parsed.notifications,
        apps: { ...DEFAULT_SYSTEM_SETTINGS.notifications.apps, ...parsed.notifications?.apps },
      },
    }
  } catch {
    return DEFAULT_SYSTEM_SETTINGS
  }
}

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(loadSettings)

  // 通知订阅者列表（用于通知中心订阅事件）
  const subscribersRef = useRef<Set<(n: AppNotification) => void>>(new Set())

  // 持久化
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  // 将设置映射到 :root 上的 CSS 变量，供全局 CSS 使用
  useEffect(() => {
    const root = document.documentElement
    const s = settings

    // 动效持续时间倍率（minimal=0.4, smooth=1.0, premium=1.6）
    const motionScale =
      s.motion.level === 'minimal' ? 0.4 : s.motion.level === 'premium' ? 1.6 : 1.0
    // 通过 reduce-motion 等控制动画总开关
    if (s.motion.level === 'minimal') {
      root.style.setProperty('--app-motion-scale', '0.4')
    } else if (s.motion.level === 'premium') {
      root.style.setProperty('--app-motion-scale', '1.6')
    } else {
      root.style.setProperty('--app-motion-scale', '1')
    }
    // 是否禁用所有动画（minimal 时不是禁用，是减弱）
    root.style.setProperty('--app-animation-enabled', s.motion.loadingAnimation ? '1' : '0')
    root.style.setProperty('--app-page-transition', s.motion.pageTransition ? '1' : '0')

    // 背景模糊：level 0-4 对应 px 值
    const blurPxValues = [0, 4, 10, 18, 28]
    const blurPx = s.blur.enabled ? blurPxValues[s.blur.level] : 0
    root.style.setProperty('--app-blur', `${blurPx}px`)

    // 通知（供通知组件读取）
    root.style.setProperty('--app-notification-duration', `${s.notifications.bannerDuration}s`)

    // 同步 data 属性，让 CSS 可通过属性选择器响应
    root.dataset.blurDisabled = (s.blur.enabled && s.blur.level > 0) ? '0' : '1'
    root.dataset.animationDisabled = s.motion.loadingAnimation ? '0' : '1'
    root.dataset.motionLevel = s.motion.level

    // 移除编译时常量提示
    void motionScale
  }, [settings])

  // 派生值：动效倍率
  const motionScale =
    settings.motion.level === 'minimal' ? 0.4 :
    settings.motion.level === 'premium' ? 1.6 : 1.0

  // 推送通知（受全局开关 + 应用分类开关控制）
  const notify = (n: { app: keyof SystemSettings['notifications']['apps']; title: string; body?: string }) => {
    const cfg = settings.notifications
    if (!cfg.enabled) return
    if (!cfg.apps[n.app]) return
    if (cfg.style === 'silent') return
    const notification: AppNotification = {
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      app: n.app,
      title: n.title,
      body: n.body,
      createdAt: Date.now(),
    }
    // 播放声音（如果开启了）
    if (cfg.sound !== 'none') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        const ctx = new AudioCtx()
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g)
        g.connect(ctx.destination)
        const soundFreq = cfg.sound === 'glass' ? 1200 : cfg.sound === 'subtle' ? 440 : 880
        o.frequency.value = soundFreq
        o.type = 'sine'
        g.gain.setValueAtTime(0.15, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
        o.start()
        o.stop(ctx.currentTime + 0.5)
      } catch {
        // 浏览器不支持 AudioContext，静默失败
      }
    }
    // 通知所有订阅者
    subscribersRef.current.forEach(fn => fn(notification))
  }

  // 订阅通知事件
  const subscribe = (handler: (n: AppNotification) => void) => {
    subscribersRef.current.add(handler)
    return () => {
      subscribersRef.current.delete(handler)
    }
  }

  const value: SystemSettingsContextValue = {
    settings,
    update: (category, field, value) => {
      setSettings(prev => ({
        ...prev,
        [category]: {
          ...(prev[category] as object),
          [field]: value,
        },
      }))
    },
    setCategory: (category, partial) => {
      setSettings(prev => ({
        ...prev,
        [category]: {
          ...(prev[category] as object),
          ...(partial as object),
        },
      }))
    },
    reset: () => {
      setSettings(DEFAULT_SYSTEM_SETTINGS)
      localStorage.removeItem(STORAGE_KEY)
    },
    motionScale,
    notify,
    subscribe,
  }

  return (
    <SystemSettingsContext.Provider value={value}>
      {children}
    </SystemSettingsContext.Provider>
  )
}

export function useSystemSettings() {
  const ctx = useContext(SystemSettingsContext)
  if (!ctx) {
    throw new Error('useSystemSettings must be used within SystemSettingsProvider')
  }
  return ctx
}

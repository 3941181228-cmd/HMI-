import { useState, useCallback, useEffect } from 'react'
import { type HMITheme, themes, DEFAULT_THEME_ID, getThemeById } from '@/data/themeData'

const STORAGE_KEY = 'hmi-studio-theme'

/** camelCase → kebab-case for CSS variable names */
function toKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase()
}

/** Format HSLValue as "H S% L%" string for CSS */
function formatHSL({ h, s, l }: { h: number; s: number; l: number }): string {
  return `${h} ${s}% ${l}%`
}

export function useTheme() {
  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME_ID
  })

  const applyTheme = useCallback((theme: HMITheme) => {
    const root = document.documentElement
    const colors = theme.colors as unknown as Record<string, { h: number; s: number; l: number }>

    for (const [key, value] of Object.entries(colors)) {
      const cssVar = `--${toKebab(key)}`
      root.style.setProperty(cssVar, formatHSL(value))
    }

    setActiveThemeId(theme.id)
    localStorage.setItem(STORAGE_KEY, theme.id)
  }, [])

  const resetTheme = useCallback(() => {
    const defaultTheme = getThemeById(DEFAULT_THEME_ID)
    if (defaultTheme) applyTheme(defaultTheme)
  }, [applyTheme])

  // Apply saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const theme = getThemeById(saved)
      if (theme) applyTheme(theme)
    }
  }, [applyTheme])

  const activeTheme = getThemeById(activeThemeId) || themes[0]

  return {
    activeThemeId,
    activeTheme,
    applyTheme,
    resetTheme,
    themes,
  }
}

export interface HSLValue {
  h: number
  s: number
  l: number
}

export interface HMIThemeColors {
  background: HSLValue
  surface: HSLValue
  surfaceSecondary: HSLValue
  surfaceTertiary: HSLValue
  foreground: HSLValue
  mutedForeground: HSLValue
  primary: HSLValue
  primaryForeground: HSLValue
  glow: HSLValue
  glowSubtle: HSLValue
  secondary: HSLValue
  secondaryForeground: HSLValue
  accent: HSLValue
  accentForeground: HSLValue
  card: HSLValue
  cardForeground: HSLValue
  popover: HSLValue
  popoverForeground: HSLValue
  muted: HSLValue
  destructive: HSLValue
  destructiveForeground: HSLValue
  border: HSLValue
  input: HSLValue
  ring: HSLValue
}

export interface HMITheme {
  id: string
  name: string
  description: string
  preview: {
    gradient: string
    bg: string
    primaryHex: string
  }
  colors: HMIThemeColors
}

function hsl(h: number, s: number, l: number): HSLValue {
  return { h, s, l }
}

export const themes: HMITheme[] = [
  {
    id: 'xiaomi-violet',
    name: '小米紫',
    description: '科技感紫色主题，深蓝黑底色，温暖紫罗兰高亮',
    preview: {
      gradient: 'from-violet-500 to-purple-600',
      bg: 'bg-violet-500/10 border-violet-500/20',
      primaryHex: '#9b7dff',
    },
    colors: {
      background: hsl(228, 22, 3.5),
      surface: hsl(228, 20, 6),
      surfaceSecondary: hsl(228, 18, 9),
      surfaceTertiary: hsl(228, 16, 13),
      foreground: hsl(225, 18, 92),
      mutedForeground: hsl(225, 10, 52),
      primary: hsl(255, 55, 65),
      primaryForeground: hsl(228, 22, 3.5),
      glow: hsl(255, 70, 75),
      glowSubtle: hsl(255, 40, 30),
      secondary: hsl(265, 30, 14),
      secondaryForeground: hsl(225, 18, 88),
      accent: hsl(228, 18, 12),
      accentForeground: hsl(225, 18, 92),
      card: hsl(228, 20, 6.5),
      cardForeground: hsl(225, 18, 92),
      popover: hsl(228, 20, 6),
      popoverForeground: hsl(225, 18, 92),
      muted: hsl(228, 16, 10),
      destructive: hsl(0, 72, 51),
      destructiveForeground: hsl(225, 18, 96),
      border: hsl(228, 14, 13),
      input: hsl(228, 14, 13),
      ring: hsl(255, 55, 65),
    },
  },
  {
    id: 'tesla-white',
    name: '特斯拉白',
    description: '极简白色主题，近白底色，冷灰蓝点缀',
    preview: {
      gradient: 'from-gray-200 to-white',
      bg: 'bg-white/10 border-white/20',
      primaryHex: '#6b7a8d',
    },
    colors: {
      background: hsl(220, 14, 97),
      surface: hsl(220, 12, 94),
      surfaceSecondary: hsl(220, 10, 91),
      surfaceTertiary: hsl(220, 8, 88),
      foreground: hsl(220, 20, 12),
      mutedForeground: hsl(220, 8, 46),
      primary: hsl(210, 15, 45),
      primaryForeground: hsl(220, 14, 97),
      glow: hsl(210, 20, 55),
      glowSubtle: hsl(210, 10, 75),
      secondary: hsl(220, 10, 90),
      secondaryForeground: hsl(220, 20, 18),
      accent: hsl(220, 8, 88),
      accentForeground: hsl(220, 20, 12),
      card: hsl(220, 12, 95),
      cardForeground: hsl(220, 20, 12),
      popover: hsl(220, 12, 94),
      popoverForeground: hsl(220, 20, 12),
      muted: hsl(220, 10, 92),
      destructive: hsl(0, 72, 51),
      destructiveForeground: hsl(220, 14, 98),
      border: hsl(220, 8, 85),
      input: hsl(220, 8, 85),
      ring: hsl(210, 15, 45),
    },
  },
  {
    id: 'porsche-red',
    name: '保时捷红',
    description: '运动豪华主题，深碳灰底色，赛车红高亮',
    preview: {
      gradient: 'from-red-600 to-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
      primaryHex: '#dc2626',
    },
    colors: {
      background: hsl(240, 8, 4),
      surface: hsl(240, 7, 7),
      surfaceSecondary: hsl(240, 6, 10),
      surfaceTertiary: hsl(240, 5, 14),
      foreground: hsl(0, 5, 92),
      mutedForeground: hsl(0, 5, 52),
      primary: hsl(0, 72, 51),
      primaryForeground: hsl(0, 5, 97),
      glow: hsl(0, 80, 62),
      glowSubtle: hsl(0, 45, 28),
      secondary: hsl(0, 20, 14),
      secondaryForeground: hsl(0, 5, 88),
      accent: hsl(0, 8, 12),
      accentForeground: hsl(0, 5, 92),
      card: hsl(240, 7, 7.5),
      cardForeground: hsl(0, 5, 92),
      popover: hsl(240, 7, 7),
      popoverForeground: hsl(0, 5, 92),
      muted: hsl(240, 5, 10),
      destructive: hsl(0, 72, 51),
      destructiveForeground: hsl(0, 5, 97),
      border: hsl(0, 6, 14),
      input: hsl(0, 6, 14),
      ring: hsl(0, 72, 51),
    },
  },
  {
    id: 'nio-deep',
    name: '蔚来深色',
    description: '高端深色主题，深石板蓝底，静谧蓝点缀',
    preview: {
      gradient: 'from-slate-600 to-slate-400',
      bg: 'bg-slate-500/10 border-slate-500/20',
      primaryHex: '#7a8fa6',
    },
    colors: {
      background: hsl(220, 15, 5),
      surface: hsl(220, 13, 8),
      surfaceSecondary: hsl(220, 11, 11),
      surfaceTertiary: hsl(220, 9, 15),
      foreground: hsl(215, 18, 90),
      mutedForeground: hsl(215, 10, 55),
      primary: hsl(215, 25, 55),
      primaryForeground: hsl(220, 15, 5),
      glow: hsl(215, 30, 65),
      glowSubtle: hsl(215, 18, 28),
      secondary: hsl(215, 18, 14),
      secondaryForeground: hsl(215, 15, 86),
      accent: hsl(220, 10, 12),
      accentForeground: hsl(215, 18, 90),
      card: hsl(220, 13, 8.5),
      cardForeground: hsl(215, 18, 90),
      popover: hsl(220, 13, 8),
      popoverForeground: hsl(215, 18, 90),
      muted: hsl(220, 10, 11),
      destructive: hsl(0, 72, 51),
      destructiveForeground: hsl(215, 18, 95),
      border: hsl(220, 8, 14),
      input: hsl(220, 8, 14),
      ring: hsl(215, 25, 55),
    },
  },
  {
    id: 'cyber-blue',
    name: '赛博蓝',
    description: '未来科技主题，超深海军蓝底，电光青蓝高亮',
    preview: {
      gradient: 'from-blue-500 to-cyan-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      primaryHex: '#22d3ee',
    },
    colors: {
      background: hsl(230, 30, 2.5),
      surface: hsl(230, 25, 5.5),
      surfaceSecondary: hsl(230, 22, 9),
      surfaceTertiary: hsl(230, 18, 13),
      foreground: hsl(200, 20, 92),
      mutedForeground: hsl(200, 12, 50),
      primary: hsl(195, 90, 55),
      primaryForeground: hsl(230, 30, 2.5),
      glow: hsl(195, 95, 68),
      glowSubtle: hsl(195, 50, 25),
      secondary: hsl(200, 35, 14),
      secondaryForeground: hsl(200, 18, 88),
      accent: hsl(220, 20, 11),
      accentForeground: hsl(200, 20, 92),
      card: hsl(230, 25, 6),
      cardForeground: hsl(200, 20, 92),
      popover: hsl(230, 25, 5.5),
      popoverForeground: hsl(200, 20, 92),
      muted: hsl(225, 18, 10),
      destructive: hsl(0, 72, 51),
      destructiveForeground: hsl(200, 20, 96),
      border: hsl(225, 15, 13),
      input: hsl(225, 15, 13),
      ring: hsl(195, 90, 55),
    },
  },
]

export function getThemeById(id: string): HMITheme | undefined {
  return themes.find((t) => t.id === id)
}

export const DEFAULT_THEME_ID = 'xiaomi-violet'

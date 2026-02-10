import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ThemeIntensity, ThemeSpec } from '../types'

const DEFAULT_THEME: ThemeSpec = {
  themeId: 'aurora',
  palette: {
    background: '#1e1b4b',
    surface: '#312e81',
    text: '#f8fafc',
    accent: '#6366f1',
    accent2: '#22d3ee',
    border: '#4338ca'
  },
  typography: {
    fontFamily: 'system',
    weights: { base: 400, strong: 700 },
    scale: { sm: 0.9, base: 1.0, lg: 1.15, xl: 1.3 }
  },
  density: 'comfortable',
  components: { button: 'filled', card: 'shadowed', table: 'minimal' },
  motion: 'subtle',
  motifs: null
}

const STORAGE_THEME = 'pref_theme_spec'
const STORAGE_LOCK = 'pref_lock_theme'
const STORAGE_INTENSITY = 'pref_theme_intensity'
const STORAGE_EXPERIMENTAL = 'pref_experimental_theme'

const FONT_STACKS: Record<string, string> = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
  humanist: "'Segoe UI', 'Trebuchet MS', 'Verdana', sans-serif",
  display: "'Trebuchet MS', 'Segoe UI', 'Arial Rounded MT Bold', sans-serif",
  mono: "'JetBrains Mono', 'Cascadia Mono', 'Consolas', 'Courier New', monospace",
  serif: "'Merriweather', 'Georgia', 'Times New Roman', serif"
}

const ThemeContext = createContext<{
  theme: ThemeSpec
  lockTheme: boolean
  intensity: ThemeIntensity
  experimentalTheme: boolean
  applyTheme: (theme: ThemeSpec, persist?: boolean) => void
  setLockTheme: (value: boolean) => void
  setIntensity: (value: ThemeIntensity) => void
  setExperimentalTheme: (value: boolean) => void
} | null>(null)

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return null
  const r = Number.parseInt(cleaned.slice(0, 2), 16)
  const g = Number.parseInt(cleaned.slice(2, 4), 16)
  const b = Number.parseInt(cleaned.slice(4, 6), 16)
  if ([r, g, b].some(value => Number.isNaN(value))) return null
  return { r, g, b }
}

function rgba(rgb: { r: number; g: number; b: number }, alpha: number): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function getReduceMotionPref(): boolean {
  return localStorage.getItem('pref_reduce_motion') === 'true'
}

function applyThemeToDocument(theme: ThemeSpec) {
  const root = document.documentElement
  const body = document.body
  const reduceMotion = getReduceMotionPref()

  const surfaceRgb = hexToRgb(theme.palette.surface) || { r: 49, g: 46, b: 129 }
  const textRgb = hexToRgb(theme.palette.text) || { r: 248, g: 250, b: 252 }
  const borderRgb = hexToRgb(theme.palette.border) || { r: 67, g: 56, b: 202 }
  const accentRgb = hexToRgb(theme.palette.accent) || { r: 99, g: 102, b: 241 }
  const accent2Rgb = hexToRgb(theme.palette.accent2) || { r: 34, g: 211, b: 238 }

  root.style.setProperty('--pq-background', theme.palette.background)
  root.style.setProperty('--pq-surface', theme.palette.surface)
  root.style.setProperty('--pq-text', theme.palette.text)
  root.style.setProperty('--pq-border', theme.palette.border)
  root.style.setProperty('--pq-accent', `${accentRgb.r} ${accentRgb.g} ${accentRgb.b}`)
  root.style.setProperty('--pq-accent-2', `${accent2Rgb.r} ${accent2Rgb.g} ${accent2Rgb.b}`)

  root.style.setProperty('--pq-surface-05', rgba(surfaceRgb, 0.05))
  root.style.setProperty('--pq-surface-10', rgba(surfaceRgb, 0.1))
  root.style.setProperty('--pq-surface-15', rgba(surfaceRgb, 0.15))
  root.style.setProperty('--pq-surface-20', rgba(surfaceRgb, 0.2))
  root.style.setProperty('--pq-border-10', rgba(borderRgb, 0.1))
  root.style.setProperty('--pq-border-20', rgba(borderRgb, 0.2))
  root.style.setProperty('--pq-border-30', rgba(borderRgb, 0.3))
  root.style.setProperty('--pq-text-40', rgba(textRgb, 0.4))
  root.style.setProperty('--pq-text-50', rgba(textRgb, 0.5))
  root.style.setProperty('--pq-text-60', rgba(textRgb, 0.6))
  root.style.setProperty('--pq-text-80', rgba(textRgb, 0.8))
  root.style.setProperty('--pq-accent-glow-50', rgba(accentRgb, 0.5))
  root.style.setProperty('--pq-accent-glow-80', rgba(accentRgb, 0.8))
  const fontStack = FONT_STACKS[theme.typography.fontFamily] || FONT_STACKS.system
  root.style.setProperty('--pq-font-family', fontStack)

  root.dataset.density = theme.density
  root.dataset.motion = reduceMotion ? 'none' : theme.motion
  root.dataset.button = theme.components.button
  root.dataset.card = theme.components.card
  root.dataset.table = theme.components.table
  root.dataset.motif = theme.motifs || ''

  body.dataset.motif = theme.motifs || ''
}

function loadStoredTheme(): ThemeSpec | null {
  const stored = localStorage.getItem(STORAGE_THEME)
  if (!stored) return null
  try {
    return JSON.parse(stored) as ThemeSpec
  } catch (e) {
    console.warn('Failed to parse stored theme', e)
    return null
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeSpec>(() => loadStoredTheme() || DEFAULT_THEME)
  const [lockTheme, setLockThemeState] = useState(() => localStorage.getItem(STORAGE_LOCK) === 'true')
  const [intensity, setIntensityState] = useState<ThemeIntensity>(
    () => (localStorage.getItem(STORAGE_INTENSITY) as ThemeIntensity) || 'subtle'
  )
  const [experimentalTheme, setExperimentalThemeState] = useState(
    () => localStorage.getItem(STORAGE_EXPERIMENTAL) === 'true'
  )

  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  const applyTheme = useCallback((nextTheme: ThemeSpec, persist = true) => {
    setTheme(nextTheme)
    if (persist) {
      localStorage.setItem(STORAGE_THEME, JSON.stringify(nextTheme))
    }
  }, [])

  const setLockTheme = useCallback((value: boolean) => {
    setLockThemeState(value)
    localStorage.setItem(STORAGE_LOCK, String(value))
  }, [])

  const setIntensity = useCallback((value: ThemeIntensity) => {
    setIntensityState(value)
    localStorage.setItem(STORAGE_INTENSITY, value)
  }, [])

  const setExperimentalTheme = useCallback((value: boolean) => {
    setExperimentalThemeState(value)
    localStorage.setItem(STORAGE_EXPERIMENTAL, String(value))
  }, [])

  const value = useMemo(
    () => ({
      theme,
      lockTheme,
      intensity,
      experimentalTheme,
      applyTheme,
      setLockTheme,
      setIntensity,
      setExperimentalTheme
    }),
    [
      theme,
      lockTheme,
      intensity,
      experimentalTheme,
      applyTheme,
      setLockTheme,
      setIntensity,
      setExperimentalTheme
    ]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

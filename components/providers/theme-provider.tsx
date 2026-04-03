'use client'
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'
interface ThemeCtx { theme: Theme; toggle: () => void }
const ThemeContext = createContext<ThemeCtx>({ theme: 'dark', toggle: () => {} })

// Light theme values applied as inline CSS vars on <html> — overrides :root with highest priority
const LIGHT: Record<string, string> = {
  '--bg-base':                  '#edf0f8',
  '--bg-base-alt':              '#f4f6fc',
  '--bg-surface':               '#ffffff',
  '--bg-elevated':              '#f0f2fa',
  '--bg-depth':                 '#e6e9f5',
  '--bg-hover':                 '#dde1f2',
  '--bg-inset':                 'rgba(0,0,0,0.04)',
  '--bg-row-heading':           'rgba(99,102,241,0.03)',
  '--overlay':                  'rgba(15,18,40,0.50)',
  '--accent':                   '#6366f1',
  '--accent-hover':             '#4f52d9',
  '--accent-muted':             'rgba(99,102,241,0.10)',
  '--accent-soft':              'rgba(99,102,241,0.07)',
  '--accent-subtle':            'rgba(99,102,241,0.04)',
  '--accent-glow':              'rgba(99,102,241,0.18)',
  '--border':                   'rgba(99,102,241,0.12)',
  '--border-strong':            'rgba(0,0,0,0.13)',
  '--border-mid':               'rgba(0,0,0,0.08)',
  '--border-subtle':            'rgba(0,0,0,0.04)',
  '--border-track':             '#c8cce6',
  '--text-primary':             '#1a1c2e',
  '--text-body':                '#2e3254',
  '--text-body-dim':            '#404670',
  '--text-secondary':           '#5c6382',
  '--text-muted':               '#848dab',
  '--text-dim':                 '#a2a9c5',
  '--text-dimmer':              '#bec5dc',
  '--sidebar-bg':               '#ffffff',
  '--sidebar-title':            '#1a1c2e',
  '--sidebar-label':            '#a2a9c5',
  '--sidebar-item':             '#5c6382',
  '--sidebar-item-active':      '#6366f1',
  '--sidebar-item-active-bg':   'rgba(99,102,241,0.08)',
  '--sidebar-item-active-border':'#6366f1',
  '--sidebar-empty':            '#bec5dc',
  '--sidebar-plus-bg':          'rgba(99,102,241,0.10)',
  '--sidebar-plus-border':      'rgba(99,102,241,0.30)',
  '--sidebar-plus-color':       '#6366f1',
  '--topnav-bg':                'rgba(237,240,248,0.92)',
}

function applyTheme(t: Theme) {
  const el = document.documentElement
  if (t === 'light') {
    Object.entries(LIGHT).forEach(([k, v]) => el.style.setProperty(k, v))
  } else {
    Object.keys(LIGHT).forEach(k => el.style.removeProperty(k))
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = (localStorage.getItem('qf_theme') ?? 'dark') as Theme
    setTheme(stored)
    applyTheme(stored)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    localStorage.setItem('qf_theme', next)
  }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)

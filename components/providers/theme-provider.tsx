'use client'
import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'

// useLayoutEffect fires before browser paint (no flash); falls back to useEffect on SSR
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

type Theme = 'dark' | 'light'
interface ThemeCtx { theme: Theme; toggle: () => void }
const ThemeContext = createContext<ThemeCtx>({ theme: 'light', toggle: () => {} })

function applyTheme(t: Theme) {
  const el = document.documentElement
  el.removeAttribute('style')
  if (t === 'light') {
    el.classList.add('qf-light')
  } else {
    el.classList.remove('qf-light')
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useIsomorphicLayoutEffect(() => {
    const stored = (localStorage.getItem('qf_theme') ?? 'light') as Theme
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

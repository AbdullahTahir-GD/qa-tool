'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'

interface SidebarCtx {
  open: boolean
  isMobile: boolean
  toggle: () => void
  close: () => void
  openSidebar: () => void
}
const SidebarContext = createContext<SidebarCtx>({
  open: true,
  isMobile: false,
  toggle: () => {},
  close: () => {},
  openSidebar: () => {},
})
export const useSidebar = () => useContext(SidebarContext)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Lazy initial state — read URL/localStorage synchronously to prevent open→close flash on refresh
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    if (window.innerWidth < 768) return false
    // If refreshing on a script page, start closed (matches the auto-close behavior)
    if (pathname?.includes('/script/')) return false
    const stored = localStorage.getItem('testra_sidebar')
    return stored !== 'false'
  })
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
  })

  useEffect(() => {
    const handleResize = () => {
      const m = window.innerWidth < 768
      setIsMobile(m)
      if (m) setOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toggle = useCallback(() => setOpen(prev => {
    const next = !prev
    if (!isMobile) localStorage.setItem('testra_sidebar', String(next))
    return next
  }), [isMobile])

  const close = useCallback(() => setOpen(false), [])
  const openSidebar = useCallback(() => setOpen(true), [])

  return (
    <SidebarContext.Provider value={{ open, isMobile, toggle, close, openSidebar }}>
      {children}
    </SidebarContext.Provider>
  )
}

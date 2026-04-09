'use client'
import { createContext, useContext, useEffect, useState } from 'react'

interface SidebarCtx {
  open: boolean
  isMobile: boolean
  toggle: () => void
  close: () => void
}
const SidebarContext = createContext<SidebarCtx>({
  open: true,
  isMobile: false,
  toggle: () => {},
  close: () => {},
})
export const useSidebar = () => useContext(SidebarContext)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mobile = window.innerWidth < 768
    setIsMobile(mobile)
    if (mobile) {
      setOpen(false)
    } else {
      const stored = localStorage.getItem('testra_sidebar')
      if (stored === 'false') setOpen(false)
    }

    const handleResize = () => {
      const m = window.innerWidth < 768
      setIsMobile(m)
      if (m) setOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toggle = () => setOpen(prev => {
    const next = !prev
    if (!isMobile) localStorage.setItem('testra_sidebar', String(next))
    return next
  })

  const close = () => setOpen(false)

  return (
    <SidebarContext.Provider value={{ open, isMobile, toggle, close }}>
      {children}
    </SidebarContext.Provider>
  )
}

'use client'
import { createContext, useContext, useEffect, useState } from 'react'

interface SidebarCtx { open: boolean; toggle: () => void }
const SidebarContext = createContext<SidebarCtx>({ open: true, toggle: () => {} })
export const useSidebar = () => useContext(SidebarContext)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('testra_sidebar')
    if (stored === 'false') setOpen(false)
  }, [])

  const toggle = () => setOpen(prev => {
    localStorage.setItem('testra_sidebar', String(!prev))
    return !prev
  })

  return <SidebarContext.Provider value={{ open, toggle }}>{children}</SidebarContext.Provider>
}

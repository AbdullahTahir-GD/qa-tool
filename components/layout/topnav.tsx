'use client'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/components/providers/sidebar-context'
import { getProjects } from '@/lib/store'
import { useEffect, useState } from 'react'

export function TopnavContent() {
  const pathname = usePathname()
  const { open, toggle } = useSidebar()
  const [projectName, setProjectName] = useState<string | null>(null)

  // Extract project name from URL
  useEffect(() => {
    const match = pathname.match(/\/projects\/([^/]+)/)
    if (match) {
      const proj = getProjects().find(p => p.id === match[1])
      setProjectName(proj?.name ?? null)
    } else {
      setProjectName(null)
    }
  }, [pathname])

  const baseTitle =
    pathname === '/dashboard' ? 'Dashboard' :
    pathname === '/projects'  ? 'Projects'  :
    pathname === '/team'      ? 'Team'       :
    pathname.includes('/projects/') ? (projectName ?? 'Project') :
    'Testra'

  return (
    <>
      {/* Hamburger */}
      <button
        onClick={toggle}
        title={open ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:4, padding:'6px 8px', marginRight:8, background:'none', border:'none', cursor:'pointer', borderRadius:6, flexShrink:0 }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <span style={{ display:'block', width:16, height:2, background:'var(--text-secondary)', borderRadius:2 }} />
        <span style={{ display:'block', width:16, height:2, background:'var(--text-secondary)', borderRadius:2 }} />
        <span style={{ display:'block', width:16, height:2, background:'var(--text-secondary)', borderRadius:2 }} />
      </button>

      {/* Mini brand when sidebar closed */}
      {!open && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginRight:14, paddingRight:14, borderRight:'1px solid var(--border-strong)' }}>
          <div style={{ width:26, height:26, borderRadius:8, background:'linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 1px 6px rgba(99,102,241,0.4)' }}>
            <span style={{ color:'white', fontWeight:900, fontSize:13 }}>T</span>
          </div>
          <span style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', letterSpacing:'-0.3px' }}>Testra</span>
        </div>
      )}

      {/* Page / Project title */}
      <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.2px' }}>{baseTitle}</span>

      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
        <ThemeToggle />
      </div>
    </>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'dark'|'light'>('dark')
  const [hovered, setHovered] = useState(false)

  // On mount: restore saved theme by toggling the CSS class
  useEffect(() => {
    const stored = localStorage.getItem('qf_theme') as 'dark'|'light' | null
    if (stored === 'light') {
      setTheme('light')
      document.documentElement.classList.add('qf-light')
    } else {
      document.documentElement.classList.remove('qf-light')
    }
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('qf_theme', next)
    if (next === 'light') {
      document.documentElement.classList.add('qf-light')
    } else {
      document.documentElement.classList.remove('qf-light')
    }
  }

  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:'flex', alignItems:'center', gap:8, padding:'6px 16px',
        background: hovered
          ? 'linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%)'
          : 'var(--bg-elevated)',
        border: hovered ? '1px solid transparent' : '1px solid var(--border-strong)',
        borderRadius:20,
        cursor:'pointer',
        fontSize:12, fontWeight:600,
        color: hovered ? '#ffffff' : 'var(--text-secondary)',
        transition:'all 0.2s',
        boxShadow: hovered ? '0 3px 14px rgba(99,102,241,0.40)' : 'none',
        letterSpacing:'0.01em',
      }}>
      <span style={{ fontSize:15, lineHeight:1 }}>{theme === 'dark' ? '☀' : '☽'}</span>
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  )
}

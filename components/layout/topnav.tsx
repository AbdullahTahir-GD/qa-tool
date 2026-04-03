'use client'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/components/providers/sidebar-context'
import { useTheme } from '@/components/providers/theme-provider'
import { getProjects, getScripts } from '@/lib/store'
import { useEffect, useState } from 'react'
import { LayoutGrid, FolderKanban, Users, Layers, ChevronRight } from 'lucide-react'

const PAGE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  '/dashboard': { label: 'Dashboard',   icon: <LayoutGrid  size={15} strokeWidth={2} /> },
  '/projects':  { label: 'Projects',    icon: <FolderKanban size={15} strokeWidth={2} /> },
  '/team':      { label: 'Team',        icon: <Users        size={15} strokeWidth={2} /> },
}

export function TopnavContent() {
  const pathname  = usePathname()
  const { open, toggle } = useSidebar()
  const [projectName, setProjectName] = useState<string | null>(null)
  const [scriptName, setScriptName] = useState<string | null>(null)

  useEffect(() => {
    const projMatch = pathname.match(/\/projects\/([^/]+)/)
    if (projMatch) {
      const proj = getProjects().find(p => p.id === projMatch[1])
      setProjectName(proj?.name ?? null)
    } else {
      setProjectName(null)
    }
    const scriptMatch = pathname.match(/\/plan\/([^/]+)\/script\/([^/]+)/)
    if (scriptMatch) {
      const planId = scriptMatch[1]
      const scriptId = scriptMatch[2]
      const sc = getScripts(planId).find(s => s.id === scriptId)
      setScriptName(sc?.name ?? null)
    } else {
      setScriptName(null)
    }
  }, [pathname])

  const meta = PAGE_META[pathname] ?? null
  const isProject = pathname.includes('/projects/')
  const isScript  = pathname.includes('/script/')

  return (
    <>
      {/* Hamburger — three clean lines */}
      <button
        onClick={toggle}
        title={open ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4.5,
          padding: '7px 9px', marginRight: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          borderRadius: 8, flexShrink: 0, transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <span style={{ display:'block', width:17, height:2, background:'var(--text-secondary)', borderRadius:2, transition:'all 0.2s' }} />
        <span style={{ display:'block', width:13, height:2, background:'var(--text-secondary)', borderRadius:2, transition:'all 0.2s' }} />
        <span style={{ display:'block', width:17, height:2, background:'var(--text-secondary)', borderRadius:2, transition:'all 0.2s' }} />
      </button>

      {/* Mini brand when sidebar closed */}
      {!open && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginRight:14, paddingRight:14, borderRight:'1px solid var(--border-strong)' }}>
          <div style={{
            width:28, height:28, borderRadius:8, flexShrink:0,
            background:'linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 2px 8px rgba(99,102,241,0.45)',
          }}>
            <span style={{ color:'white', fontWeight:900, fontSize:14 }}>T</span>
          </div>
          <span style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', letterSpacing:'-0.3px' }}>Testra</span>
        </div>
      )}

      {/* Breadcrumb / Title */}
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        {meta ? (
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ color:'var(--accent)', opacity:0.9 }}>{meta.icon}</span>
            <span style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.2px' }}>{meta.label}</span>
          </div>
        ) : isProject ? (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Layers size={15} color="var(--accent)" strokeWidth={2} style={{ opacity:0.9 }} />
            <span style={{ fontSize:14, color:'var(--text-muted)', fontWeight:500 }}>Projects</span>
            <ChevronRight size={13} color="var(--text-dim)" />
            <span style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.2px' }}>
              {projectName ?? '…'}
            </span>
            {isScript && (
              <>
                <ChevronRight size={13} color="var(--text-dim)" />
                <span style={{ fontSize:13, color:'var(--text-secondary)', fontWeight:500 }}>{scriptName ?? 'Script'}</span>
              </>
            )}
          </div>
        ) : (
          <span style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>Testra</span>
        )}
      </div>

      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
        <ThemeToggle />
      </div>
    </>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const [hov, setHov] = useState(false)

  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 18px',
        background: hov
          ? 'linear-gradient(135deg,#0ea5e9 0%,#6366f1 50%,#8b5cf6 100%)'
          : 'var(--bg-elevated)',
        border: hov ? '1px solid transparent' : '1px solid var(--border-strong)',
        borderRadius: 24,
        cursor: 'pointer',
        fontSize: 13, fontWeight: 600,
        color: hov ? '#fff' : 'var(--text-secondary)',
        transition: 'all 0.2s',
        boxShadow: hov ? '0 4px 18px rgba(99,102,241,0.50)' : 'none',
        letterSpacing: '0.01em',
      }}>
      <span style={{ fontSize: 15, lineHeight: 1 }}>{theme === 'dark' ? '☀' : '☽'}</span>
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  )
}

'use client'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/components/providers/sidebar-context'
import { useTheme } from '@/components/providers/theme-provider'
import { peekCache, getProjects as getProjectsDB, getScripts as getScriptsDB, type Project, type Script } from '@/lib/db'
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
      const projId = projMatch[1]
      const cached = peekCache<Project[]>('projects')
      if (cached) {
        setProjectName(cached.find(p => p.id === projId)?.name ?? null)
      } else {
        getProjectsDB().then(projects => {
          setProjectName(projects.find(p => p.id === projId)?.name ?? null)
        }).catch(() => setProjectName(null))
      }
    } else {
      setProjectName(null)
    }
    const scriptMatch = pathname.match(/\/plan\/([^/]+)\/script\/([^/]+)/)
    if (scriptMatch) {
      const planId = scriptMatch[1]
      const scriptId = scriptMatch[2]
      // Try in-memory cache first (instant, already populated from plan page)
      const cached = peekCache<Script[]>(`scripts:${planId}`)
      if (cached) {
        setScriptName(cached.find(s => s.id === scriptId)?.name ?? null)
      } else {
        getScriptsDB(planId).then(scripts => {
          setScriptName(scripts.find(s => s.id === scriptId)?.name ?? null)
        }).catch(() => setScriptName(null))
      }
    } else {
      setScriptName(null)
    }
  }, [pathname])

  const meta = PAGE_META[pathname] ?? null
  const isProject = pathname.includes('/projects/')
  const isScript  = pathname.includes('/script/')

  return (
    <>
      {/* Hamburger — animates to × when sidebar open */}
      <button
        onClick={toggle}
        title={open ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 0,
          width: 34, height: 34, marginRight: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          borderRadius: 8, flexShrink: 0, transition: 'background 0.15s', position: 'relative',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <span style={{
          display: 'block', width: 16, height: 2,
          background: 'var(--text-secondary)', borderRadius: 2,
          position: 'absolute',
          transition: 'transform 0.22s ease, opacity 0.22s ease, top 0.22s ease',
          top: open ? '50%' : 'calc(50% - 5px)',
          transform: open ? 'translateY(-50%) rotate(45deg)' : 'translateY(0)',
        }} />
        <span style={{
          display: 'block', width: 12, height: 2,
          background: 'var(--text-secondary)', borderRadius: 2,
          position: 'absolute', top: '50%',
          transition: 'opacity 0.15s ease, transform 0.15s ease',
          opacity: open ? 0 : 1,
          transform: open ? 'scaleX(0)' : 'translateY(-50%)',
        }} />
        <span style={{
          display: 'block', width: 16, height: 2,
          background: 'var(--text-secondary)', borderRadius: 2,
          position: 'absolute',
          transition: 'transform 0.22s ease, opacity 0.22s ease, top 0.22s ease',
          top: open ? '50%' : 'calc(50% + 3px)',
          transform: open ? 'translateY(-50%) rotate(-45deg)' : 'translateY(0)',
        }} />
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
      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
        {meta ? (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ color:'var(--accent)', opacity:0.85, display:'flex' }}>{meta.icon}</span>
            <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.2px' }}>{meta.label}</span>
          </div>
        ) : isProject ? (
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <Layers size={13} color="var(--text-dim)" strokeWidth={2} style={{ flexShrink:0, display:'block' }} />
            <span style={{ fontSize:13, color:'var(--text-dim)', fontWeight:500, lineHeight:1.5 }}>Projects</span>
            <ChevronRight size={13} color="var(--border-strong)" strokeWidth={2.5} style={{ flexShrink:0, display:'block' }} />
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', lineHeight:1.5, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {projectName ?? '…'}
            </span>
            {isScript && scriptName && (
              <>
                <ChevronRight size={13} color="var(--border-strong)" strokeWidth={2.5} style={{ flexShrink:0, display:'block' }} />
                <span style={{ fontSize:13, fontWeight:600, color:'var(--accent)', lineHeight:1.5, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{scriptName}</span>
              </>
            )}
          </div>
        ) : (
          <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Testra</span>
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

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        borderRadius: 9,
        cursor: 'pointer',
        fontSize: 16, lineHeight: 1,
        color: 'var(--text-secondary)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-depth)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
      {theme === 'dark' ? '☀' : '☽'}
    </button>
  )
}

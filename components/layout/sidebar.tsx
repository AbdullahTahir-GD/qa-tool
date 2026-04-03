'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname } from 'next/navigation'
import { getProjects, getPlans, deleteProject, type Project } from '@/lib/store'
import { FolderKanban, Plus } from 'lucide-react'

export function SidebarContent() {
  const [projects, setProjects] = useState<Project[]>([])
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; projectId: string } | null>(null)
  const router   = useRouter()
  const pathname = usePathname()

  const refresh = () => setProjects(getProjects())
  useEffect(() => { refresh() }, [pathname])
  useEffect(() => {
    window.addEventListener('qaflow:change', refresh)
    return () => window.removeEventListener('qaflow:change', refresh)
  }, [])
  useEffect(() => {
    const close = () => setCtxMenu(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const handleDeleteProject = (projectId: string) => {
    deleteProject(projectId)
    setCtxMenu(null)
    refresh()
    if (pathname.includes('/projects/' + projectId)) router.push('/projects')
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', position: 'relative',
      /* Rich dark gradient — feels deep & premium */
      background: 'linear-gradient(170deg, #141828 0%, #0f1220 55%, #0b0d14 100%)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      overflow: 'hidden',
    }}>

      {/* Glossy top sheen overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 220,
        background: 'linear-gradient(180deg, rgba(99,102,241,0.10) 0%, transparent 100%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      {/* Bottom fade */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.35) 0%, transparent 100%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Logo ── */}
      <div onClick={() => router.push('/projects')}
        style={{
          position: 'relative', zIndex: 1,
          padding: '24px 20px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0, cursor: 'pointer',
        }}>
        {/* Badge with glow ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13,
            background: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 60%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 18px rgba(99,102,241,0.60), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: 22, letterSpacing: '-1px', lineHeight: 1 }}>T</span>
          </div>
          {/* Glow dot */}
          <div style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 9, height: 9, borderRadius: '50%',
            background: '#22c55e',
            border: '2px solid #0f1220',
            boxShadow: '0 0 6px rgba(34,197,94,0.8)',
          }} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#f0f2ff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>Testra</div>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2 }}>QA Platform</div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 20, position: 'relative', zIndex: 1 }}>

        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <FolderKanban size={11} color="rgba(255,255,255,0.28)" strokeWidth={2} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.28)' }}>
              Projects
            </span>
          </div>
          <a
            href="/new-project"
            title="New project"
            style={{
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
              background: 'rgba(34,197,94,0.14)',
              border: '1px solid rgba(34,197,94,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', textDecoration: 'none', transition: 'all 0.15s',
              boxShadow: '0 0 0 0 rgba(34,197,94,0)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(34,197,94,0.28)'
              e.currentTarget.style.borderColor = 'rgba(34,197,94,0.65)'
              e.currentTarget.style.boxShadow = '0 0 12px rgba(34,197,94,0.35)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(34,197,94,0.14)'
              e.currentTarget.style.borderColor = 'rgba(34,197,94,0.35)'
              e.currentTarget.style.boxShadow = '0 0 0 0 rgba(34,197,94,0)'
            }}
          >
            <Plus size={14} color="#22c55e" strokeWidth={2.5} />
          </a>
        </div>

        {/* Empty */}
        {projects.length === 0 && (
          <div style={{ padding: '10px 20px', fontSize: 13, color: 'rgba(255,255,255,0.20)', fontStyle: 'italic' }}>
            No projects yet
          </div>
        )}

        {/* Project items */}
        {projects.map(p => {
          const plans    = getPlans(p.id)
          const isActive = pathname.includes('/projects/' + p.id)
          return (
            <div
              key={p.id}
              onClick={() => plans.length >= 1
                ? router.push(`/projects/${p.id}/plan/${plans[0].id}`)
                : router.push('/projects/' + p.id)
              }
              onContextMenu={e => { e.preventDefault(); const x=Math.min(e.clientX,window.innerWidth-180-8); const y=Math.min(e.clientY,window.innerHeight-80-8); setCtxMenu({ x, y, projectId: p.id }) }}
              style={{
                position: 'relative',
                padding: '11px 20px 11px 22px',
                fontSize: 14.5,
                cursor: 'pointer',
                color: isActive ? '#ffffff' : 'rgba(255,255,255,0.58)',
                fontWeight: isActive ? 600 : 400,
                background: isActive
                  ? 'linear-gradient(90deg, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0.06) 100%)'
                  : 'transparent',
                borderLeft: isActive ? '3px solid #22c55e' : '3px solid transparent',
                userSelect: 'none',
                transition: 'all 0.14s',
                lineHeight: 1.45,
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.055)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.88)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.58)'
                }
              }}
            >
              {p.name}
            </div>
          )
        })}
      </div>

      {/* ── Right-click context menu (portalled to body so position:fixed is always viewport-relative) ── */}
      {ctxMenu && (() => {
        const pid = ctxMenu.projectId
        return createPortal(
          <div
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
              background: '#1e2235', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
              zIndex: 9999, minWidth: 160, overflow: 'hidden',
            }}>
            <button
              onMouseDown={e => { e.stopPropagation(); handleDeleteProject(pid) }}
              style={{
                display: 'block', width: '100%', padding: '10px 16px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#f87171', fontSize: 13, fontWeight: 600,
                textAlign: 'left', transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              🗑 Delete Project
            </button>
          </div>,
          document.body
        )
      })()}

      {/* ── Footer version ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: '14px 20px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.8)', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.04em' }}>Testra v1.0 · Local</span>
      </div>
    </div>
  )
}

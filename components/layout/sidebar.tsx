'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname } from 'next/navigation'
import { getProjects, getPlans, deleteProject, type Project } from '@/lib/store'
import { FolderKanban, Plus, HelpCircle, X } from 'lucide-react'

export function SidebarContent() {
  const [projects, setProjects] = useState<Project[]>([])
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; projectId: string } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
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
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
              title={p.name}
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
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.04em', flex: 1 }}>Testra v1.0 · Local</span>
        <button
          onClick={() => setShowHelp(true)}
          title="How to use Testra"
          style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 7, width: 26, height: 26, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}>
          <HelpCircle size={13} color="rgba(255,255,255,0.45)" />
        </button>
      </div>

      {/* ── Tutorial overlay ── */}
      {showHelp && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.60)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
        }} onClick={() => setShowHelp(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#14172a', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: '28px 32px', maxWidth: 540, width: '90vw',
            maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 1.7,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HelpCircle size={16} color="white" />
                </div>
                <span style={{ fontSize: 17, fontWeight: 800, color: '#f0f2ff', letterSpacing: '-0.3px' }}>How to use Testra</span>
              </div>
              <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
                <X size={18} />
              </button>
            </div>

            {[
              { step: '1', title: 'Create a Project', color: '#0ea5e9', body: 'Click the + button next to PROJECTS in the sidebar. Name your project (e.g. "Mobile App v3"). A project is the top-level container for all related test plans.' },
              { step: '2', title: 'Add a Test Plan', color: '#6366f1', body: 'Inside a project, create a test plan to represent a release or sprint (e.g. "Release 2.4"). Each plan has its own folder structure and run history.' },
              { step: '3', title: 'Organise with Folders & Scripts', color: '#8b5cf6', body: 'Click the Folder button to create a folder (e.g. "Authentication"). Then use the Script button to create scripts inside that folder. Scripts are where your test cases live.' },
              { step: '4', title: 'Author Test Cases', color: '#a78bfa', body: 'Open a script and type a test case title in the input at the bottom — press Enter to add it. Double-click any row to edit. Right-click a row to insert above, add a heading, or delete. Press Shift+Enter on any selected row to insert a blank row above it.' },
              { step: '5', title: 'Execute a Test Run', color: '#22c55e', body: 'Click New Run and enter the tester name and build reference. Click a run column to activate it, then click any test row to record a result: Pass, Fail, Blocked, Query, or Exclude.' },
              { step: '6', title: 'Review Combined Results', color: '#f59e0b', body: 'The plan overview shows aggregated totals across all runs and testers for every folder and script. Expand any script row to see a per-run breakdown. The top bar shows overall plan progress.' },
              { step: '7', title: 'Export a PDF Report', color: '#ef4444', body: 'Inside any script, click the Report button to generate a combined PDF — includes a runs summary table with pass rates and a full results matrix for every test case across all runs.' },
            ].map(({ step, title, color, body }) => (
              <div key={step} style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'white' }}>{step}</span>
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#f0f2ff', marginBottom: 3 }}>{title}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.60)', lineHeight: 1.6 }}>{body}</div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 8, padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, fontSize: 12.5, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
              All data is stored locally in your browser · Right-click any project or folder for rename and delete options
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

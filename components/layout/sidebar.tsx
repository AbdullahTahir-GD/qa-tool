'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getProjects, getPlans, type Project } from '@/lib/store'

export function SidebarContent() {
  const [projects, setProjects] = useState<Project[]>([])
  const router = useRouter()
  const pathname = usePathname()

  const refresh = () => setProjects(getProjects())

  useEffect(() => { refresh() }, [pathname])
  useEffect(() => {
    window.addEventListener('qaflow:change', refresh)
    return () => window.removeEventListener('qaflow:change', refresh)
  }, [])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#13151e',
      borderRight: '1px solid rgba(255,255,255,0.07)',
    }}>

      {/* Logo area */}
      <div style={{
        padding: '16px 14px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(99,102,241,0.45)',
        }}>
          <span style={{ color: 'white', fontWeight: 900, fontSize: 18, letterSpacing: '-1px', lineHeight: 1 }}>T</span>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#e6e9f5', letterSpacing: '-0.3px', lineHeight: 1.2 }}>Testra</div>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>QA Platform</div>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 14 }}>

        {/* PROJECTS label + add button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px 10px' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.11em', color: 'rgba(255,255,255,0.28)',
          }}>
            PROJECTS
          </span>
          <a
            href="/new-project"
            style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#22c55e', fontSize: 17, textDecoration: 'none',
              fontWeight: 300, lineHeight: 1, transition: 'all 0.14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.26)'; e.currentTarget.style.borderColor = 'rgba(34,197,94,0.55)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.14)'; e.currentTarget.style.borderColor = 'rgba(34,197,94,0.30)' }}
          >
            +
          </a>
        </div>

        {/* Empty state */}
        {projects.length === 0 && (
          <div style={{ padding: '6px 16px', fontSize: 12.5, color: 'rgba(255,255,255,0.20)', fontStyle: 'italic' }}>
            No projects yet
          </div>
        )}

        {/* Project list */}
        {projects.map(p => {
          const plans = getPlans(p.id)
          const isActive = pathname.includes('/projects/' + p.id)
          return (
            <div
              key={p.id}
              onClick={() => plans.length >= 1
                ? router.push(`/projects/${p.id}/plan/${plans[0].id}`)
                : router.push('/projects/' + p.id)
              }
              style={{
                padding: '8px 14px 8px 16px',
                fontSize: 13.5,
                cursor: 'pointer',
                color: isActive ? '#ffffff' : 'rgba(255,255,255,0.60)',
                fontWeight: isActive ? 600 : 400,
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                borderLeft: isActive ? '3px solid #22c55e' : '3px solid transparent',
                userSelect: 'none',
                transition: 'all 0.12s',
                lineHeight: 1.45,
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.60)'
                }
              }}
            >
              {p.name}
            </div>
          )
        })}
      </div>
    </div>
  )
}

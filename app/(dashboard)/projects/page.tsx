'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProjects, getPlans, type Project } from '@/lib/db'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [planCounts, setPlanCounts] = useState<Record<string, { count: number; firstId: string | null }>>({})
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const ps = await getProjects()
      setProjects(ps)
      const planLists = await Promise.all(ps.map(p => getPlans(p.id)))
      const counts: Record<string, { count: number; firstId: string | null }> = {}
      ps.forEach((p, i) => {
        counts[p.id] = { count: planLists[i].length, firstId: planLists[i][0]?.id ?? null }
      })
      setPlanCounts(counts)
      setLoading(false)
    }
    load()
    window.addEventListener('qaflow:change', load)
    return () => window.removeEventListener('qaflow:change', load)
  }, [])

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'70vh' }}>
        <div style={{ fontSize:13, color:'var(--text-muted)' }}>Loading…</div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'70vh', gap:16 }}>
        <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,#0ea5e9,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 32px rgba(99,102,241,0.4)' }}>
          <span style={{ color:'white', fontSize:28, fontWeight:900 }}>T</span>
        </div>
        <h2 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0, letterSpacing:'-0.4px' }}>Welcome to Testra</h2>
        <p style={{ fontSize:14, color:'var(--text-muted)', margin:0 }}>Click the <strong style={{ color:'var(--text-body)' }}>+</strong> next to PROJECTS in the sidebar to get started.</p>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'70vh', padding:'32px 24px' }}>

      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:36 }}>
        <div style={{ width:48, height:48, borderRadius:14, background:'linear-gradient(135deg,#0ea5e9,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 8px 28px rgba(99,102,241,0.38)' }}>
          <span style={{ color:'white', fontSize:24, fontWeight:900 }}>T</span>
        </div>
        <h2 style={{ fontSize:26, fontWeight:800, color:'var(--text-primary)', margin:'0 0 8px', letterSpacing:'-0.5px' }}>Your Projects</h2>
        <p style={{ fontSize:14, color:'var(--text-muted)', margin:0 }}>Select a project to continue</p>
      </div>

      {/* Project cards */}
      <div style={{ width:'100%', maxWidth:480, display:'flex', flexDirection:'column', gap:10 }}>
        {projects.map((p, i) => {
          const info = planCounts[p.id] ?? { count: 0, firstId: null }
          const created = new Date(p.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
          return (
            <div key={p.id}
              onClick={() => router.push(info.firstId ? `/projects/${p.id}/plan/${info.firstId}` : '/projects/' + p.id)}
              style={{
                padding:'18px 22px', cursor:'pointer', userSelect:'none',
                background:'var(--bg-surface)',
                border:'1px solid var(--border-strong)',
                borderRadius:12,
                display:'flex', alignItems:'center', gap:16,
                transition:'all 0.15s',
                boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--border-accent)'
                e.currentTarget.style.boxShadow = '0 4px 24px rgba(99,102,241,0.14)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-strong)'
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'
                e.currentTarget.style.transform = 'none'
              }}>
              {/* Avatar */}
              <div style={{
                width:40, height:40, borderRadius:10, flexShrink:0,
                background:`linear-gradient(135deg, ${['#6366f1','#0ea5e9','#8b5cf6','#ec4899'][i % 4]} 0%, ${['#8b5cf6','#6366f1','#ec4899','#6366f1'][i % 4]} 100%)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 2px 10px rgba(99,102,241,0.3)',
              }}>
                <span style={{ color:'white', fontWeight:800, fontSize:16 }}>{p.name.charAt(0).toUpperCase()}</span>
              </div>

              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>
                  {info.count} plan{info.count !== 1 ? 's' : ''} · Created {created}
                </div>
              </div>

              {/* Arrow */}
              <span style={{ fontSize:18, color:'var(--text-dim)', flexShrink:0 }}>›</span>
            </div>
          )
        })}
      </div>

      {/* New project hint */}
      <p style={{ fontSize:12, color:'var(--text-dimmer)', marginTop:28 }}>
        Right-click a project in the sidebar to delete · Click <strong style={{ color:'var(--text-muted)' }}>+</strong> to add a new project
      </p>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProjects, getPlans, getRows, getScripts, getFolders, getTestRuns } from '@/lib/store'

export default function DashboardPage() {
  const [stats, setStats] = useState({ projects:0, plans:0, cases:0, runs:0 })
  const router = useRouter()
  useEffect(() => {
    const projects = getProjects()
    let plans=0, cases=0, runs=0
    projects.forEach(p => {
      const pl = getPlans(p.id); plans += pl.length
      pl.forEach(plan => {
        const scripts = getScripts(plan.id)
        scripts.forEach(s => { cases += getRows(s.id).filter(r=>r.type==='case').length })
        runs += getTestRuns(plan.id).length
      })
    })
    setStats({ projects:projects.length, plans, cases, runs })
  }, [])
  return (
    <div style={{ maxWidth:800, margin:'0 auto' }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>Dashboard</h2>
      <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:24 }}>Your QA workspace overview</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[['Projects',stats.projects,'#6366f1'],['Test Plans',stats.plans,'#60a5fa'],['Test Cases',stats.cases,'#34d399'],['Runs',stats.runs,'#f59e0b']].map(([l,v,c]) => (
          <div key={l as string} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 18px' }}>
            <div style={{ fontSize:26, fontWeight:700, color:c as string }}>{v as number}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{l as string}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:28, padding:'20px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:10, fontSize:13, color:'var(--text-muted)', textAlign:'center' }}>
        Click a project in the sidebar to open it, or click <strong style={{color:'var(--text-secondary)'}}>+</strong> next to PROJECTS to create a new one.
      </div>
    </div>
  )
}

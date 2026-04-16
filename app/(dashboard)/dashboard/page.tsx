'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { getProjects, getPlans, getRows, getScripts, getTestRuns } from '@/lib/db'

export default function DashboardPage() {
  const [stats, setStats] = useState({ projects:0, plans:0, cases:0, runs:0 })
  const [cols, setCols] = useState(4)

  const load = useCallback(async () => {
    const projects = await getProjects()
    if (projects.length === 0) { setStats({ projects:0, plans:0, cases:0, runs:0 }); return }

    // Batch 1: all plans in parallel
    const planLists = await Promise.all(projects.map(p => getPlans(p.id)))
    const allPlans = planLists.flat()

    if (allPlans.length === 0) { setStats({ projects: projects.length, plans:0, cases:0, runs:0 }); return }

    // Batch 2: all scripts + runs in parallel
    const [scriptLists, runLists] = await Promise.all([
      Promise.all(allPlans.map(pl => getScripts(pl.id))),
      Promise.all(allPlans.map(pl => getTestRuns(pl.id))),
    ])
    const allScripts = scriptLists.flat()

    // Batch 3: all rows in parallel
    const rowLists = allScripts.length > 0
      ? await Promise.all(allScripts.map(s => getRows(s.id)))
      : []

    const cases = rowLists.flat().filter(r => r.type === 'case').length
    const runs  = runLists.flat().length
    setStats({ projects: projects.length, plans: allPlans.length, cases, runs })
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    window.addEventListener('qaflow:change', load)
    return () => window.removeEventListener('qaflow:change', load)
  }, [load])

  useEffect(() => {
    const update = () => setCols(window.innerWidth < 480 ? 2 : 4)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <div style={{ maxWidth:800, margin:'0 auto', width:'100%' }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>Dashboard</h2>
      <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:24 }}>Your QA workspace overview</p>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap:12 }}>
        {[['Projects',stats.projects,'#0ea5e9'],['Test Plans',stats.plans,'#60a5fa'],['Test Cases',stats.cases,'#34d399'],['Runs',stats.runs,'#f59e0b']].map(([l,v,c]) => (
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

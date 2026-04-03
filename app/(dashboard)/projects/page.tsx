'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProjects, type Project } from '@/lib/store'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const router = useRouter()
  useEffect(() => {
    const p = getProjects()
    setProjects(p)
    if (p.length === 1) router.push('/projects/' + p[0].id)
  }, [])
  return (
    <div style={{ maxWidth:600, margin:'60px auto', textAlign:'center' }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:12 }}>
        {projects.length === 0 ? 'Welcome to QAFlow' : 'Select a Project'}
      </h2>
      <p style={{ color:'var(--text-muted)', fontSize:13 }}>
        {projects.length === 0 ? 'Click the + next to PROJECTS in the sidebar to create your first project.' : ''}
      </p>
      {projects.map(p => (
        <div key={p.id} onClick={() => router.push('/projects/'+p.id)}
          style={{ padding:'12px 16px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', marginBottom:8, textAlign:'left', fontSize:13, color:'var(--text-primary)' }}>
          {p.name}
        </div>
      ))}
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getProjects, getPlans, savePlan, type Project, type TestPlan } from '@/lib/store'
import { Plus } from 'lucide-react'

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [plans, setPlans] = useState<TestPlan[]>([])
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    const p = getProjects().find(x => x.id === id)
    if (!p) { router.push('/projects'); return }
    setProject(p)
    const pl = getPlans(id)
    setPlans(pl)
    if (pl.length === 1) router.push(`/projects/${id}/plan/${pl[0].id}`)
  }, [id])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const plan = savePlan(id, name.trim())
    router.push(`/projects/${id}/plan/${plan.id}`)
  }

  return (
    <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{project?.name}</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>Create a test plan to get started</p>
      {adding ? (
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setAdding(false)}
            placeholder="e.g. MSS - Build Test Plan"
            style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--accent)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', outline: 'none', width: 280 }} />
          <button type="submit" style={btn}>Create</button>
          <button type="button" onClick={() => setAdding(false)} style={btnG}>Cancel</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} style={btn}><Plus size={13} /> New Test Plan</button>
      )}
      {plans.length > 1 && (
        <div style={{ marginTop: 32 }}>
          {plans.map(p => (
            <div key={p.id} onClick={() => router.push(`/projects/${id}/plan/${p.id}`)}
              style={{ padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', marginBottom: 8, textAlign: 'left', fontSize: 13, color: 'var(--text-primary)' }}>
              {p.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
const btn: React.CSSProperties = { display:'inline-flex',alignItems:'center',gap:5,padding:'8px 16px',background:'var(--accent)',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer' }
const btnG: React.CSSProperties = { ...btn, background:'transparent',color:'var(--text-secondary)',border:'1px solid var(--border-strong)' }

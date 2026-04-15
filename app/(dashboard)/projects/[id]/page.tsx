'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getProjects, getProjectById, getPlans, getScripts, getTestRuns, savePlan, invalidateCache, type Project, type TestPlan } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { Plus, ClipboardList, ChevronRight } from 'lucide-react'

interface PlanMeta { scriptCount: number; runCount: number }

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [plans, setPlans] = useState<TestPlan[]>([])
  const [planMeta, setPlanMeta] = useState<Record<string, PlanMeta>>({})
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const load = useCallback(async () => {
    const projects = await getProjects()
    const p = projects.find(x => x.id === id) ?? await getProjectById(id)
    if (!p) { router.push('/projects'); return }
    setProject(p)
    const pl = await getPlans(id)
    setPlans(pl)
    const metaList = await Promise.all(
      pl.map(plan =>
        Promise.all([getScripts(plan.id), getTestRuns(plan.id)]).then(([scripts, runs]) => ({
          planId: plan.id, scriptCount: scripts.length, runCount: runs.length,
        }))
      )
    )
    const meta: Record<string, PlanMeta> = {}
    metaList.forEach(m => { meta[m.planId] = { scriptCount: m.scriptCount, runCount: m.runCount } })
    setPlanMeta(meta)
  }, [id, router])

  useEffect(() => { load() }, [load])

  // Realtime — sync plan additions/deletions/renames from other team members instantly
  useEffect(() => {
    type PR = { id: string; project_id: string; name: string; created_at: string }
    const channel = supabase
      .channel(`project-plans-${id}`)
      // New plan created by another user → add it instantly (zero scripts/runs yet)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'plans',
        filter: `project_id=eq.${id}` }, ({ new: r }) => {
        const plan: TestPlan = { id:(r as PR).id, projectId:(r as PR).project_id, name:(r as PR).name, createdAt:(r as PR).created_at }
        setPlans(prev => prev.some(p=>p.id===plan.id) ? prev : [...prev, plan])
        setPlanMeta(prev => ({ ...prev, [plan.id]: { scriptCount: 0, runCount: 0 } }))
        invalidateCache(`plans:${id}`)
      })
      // Plan renamed
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'plans',
        filter: `project_id=eq.${id}` }, ({ new: r }) => {
        const plan: TestPlan = { id:(r as PR).id, projectId:(r as PR).project_id, name:(r as PR).name, createdAt:(r as PR).created_at }
        setPlans(prev => prev.map(p => p.id===plan.id ? plan : p))
        invalidateCache(`plans:${id}`)
      })
      // Plan deleted by another user
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'plans',
        filter: `project_id=eq.${id}` }, ({ old: r }) => {
        const planId = (r as { id: string }).id
        setPlans(prev => prev.filter(p => p.id !== planId))
        setPlanMeta(prev => { const n={...prev}; delete n[planId]; return n })
        invalidateCache(`plans:${id}`)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  // Polling + visibility-based refresh — guarantees plan list stays in sync
  // with other team members within a few seconds, even if Realtime is flaky
  const forceReload = useCallback(async () => {
    invalidateCache(`plans:${id}`)
    await load()
  }, [id, load])

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') forceReload()
    }, 5000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') forceReload()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [forceReload])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const plan = await savePlan(id, name.trim())
    router.push(`/projects/${id}/plan/${plan.id}`)
  }

  return (
    <div style={{ maxWidth: 580, margin: '0 auto', padding: '52px 24px' }}>

      {/* Page header */}
      <div style={{ marginBottom: 36, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.4px' }}>
            {project?.name}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '5px 0 0' }}>
            {plans.length === 0 ? 'No test plans yet — create one to get started.' : `${plans.length} test plan${plans.length > 1 ? 's' : ''}`}
          </p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} style={btnPrimary}>
            <Plus size={14} strokeWidth={2.5} /> New Plan
          </button>
        )}
      </div>

      {/* Add plan form */}
      {adding && (
        <form onSubmit={handleCreate} style={{
          display: 'flex', gap: 8, marginBottom: 24,
          padding: '14px 16px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-accent)',
          borderRadius: 10,
        }}>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && (setAdding(false), setName(''))}
            placeholder="e.g. Sprint 12 Regression"
            style={{
              flex: 1, padding: '8px 12px',
              background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
              borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', outline: 'none',
            }} />
          <button type="submit" style={btnPrimary}>Create</button>
          <button type="button" onClick={() => { setAdding(false); setName('') }} style={btnGhost}>Cancel</button>
        </form>
      )}

      {/* Empty state */}
      {plans.length === 0 && !adding && (
        <div style={{
          border: '1.5px dashed var(--border-strong)',
          borderRadius: 12, padding: '40px 24px',
          textAlign: 'center', color: 'var(--text-dim)',
        }}>
          <ClipboardList size={32} color="var(--border-strong)" strokeWidth={1.5} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>No test plans yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 18 }}>Create a plan to start organising your test cases and runs.</div>
          <button onClick={() => setAdding(true)} style={btnPrimary}><Plus size={13} /> New Plan</button>
        </div>
      )}

      {/* Plan cards */}
      {plans.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plans.map(p => {
            const meta = planMeta[p.id] ?? { scriptCount: 0, runCount: 0 }
            return (
              <div key={p.id}
                onClick={() => router.push(`/projects/${id}/plan/${p.id}`)}
                style={{
                  padding: '14px 18px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 14,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.background = 'var(--bg-elevated)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: 'var(--accent-muted)', border: '1px solid var(--border-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ClipboardList size={16} color="var(--accent)" strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                    {meta.scriptCount} script{meta.scriptCount !== 1 ? 's' : ''}
                    {meta.runCount > 0 && <> · {meta.runCount} run{meta.runCount !== 1 ? 's' : ''}</>}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-dim)" strokeWidth={2} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px',
  background: 'var(--accent)', color: 'white',
  border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  flexShrink: 0, whiteSpace: 'nowrap',
}
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-strong)', borderRadius: 8,
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
  flexShrink: 0,
}

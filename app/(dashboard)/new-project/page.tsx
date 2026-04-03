'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveProject, savePlan } from '@/lib/store'

export default function NewProjectPage() {
  const [name, setName] = useState('')
  const router = useRouter()

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const p = saveProject(name.trim())
    const plan = savePlan(p.id, name.trim() + ' - Test Plan')
    router.push(`/projects/${p.id}/plan/${plan.id}`)
  }

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '14px 16px',
    background: 'var(--bg-elevated)',
    border: '2px solid var(--accent)',
    borderRadius: 10, fontSize: 16,
    color: 'var(--text-primary)',
    outline: 'none', boxSizing: 'border-box', marginBottom: 24,
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* Brand header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 18px rgba(99,102,241,0.45)',
          }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: 24, letterSpacing: '-1px' }}>T</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1.2 }}>Testra</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>QA Platform</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 18, padding: '44px 44px 40px', boxShadow: '0 12px 48px rgba(0,0,0,0.2)' }}>

          <h2 style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', letterSpacing: '-0.6px' }}>New Project</h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', margin: '0 0 32px', lineHeight: 1.6 }}>Give your project a name to get started</p>
          <form onSubmit={handleCreateProject}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Project Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. MSS - Build Test Plan" style={inputStyle} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => router.back()}
                style={{ flex: 1, padding: '14px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)', borderRadius: 11, fontSize: 15, cursor: 'pointer', fontWeight: 500 }}>
                Cancel
              </button>
              <button type="submit"
                style={{ flex: 2, padding: '14px', background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)', color: 'white', border: 'none', borderRadius: 11, fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.01em' }}>
                Create Project →
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  )
}

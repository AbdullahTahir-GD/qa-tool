'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { saveProject, savePlan } from '@/lib/db'

// Module-level lock — immune to React re-renders and Strict Mode
let _submitting = false

export default function NewProjectPage() {
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [isSmall, setIsSmall] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset lock each time the page mounts (so returning here works normally)
  useEffect(() => {
    _submitting = false
    setCreating(false)
  }, [])

  // Poll for autofill values that bypass React events (browser autofill ignores onChange/onInput)
  useEffect(() => {
    const interval = setInterval(() => {
      if (inputRef.current && inputRef.current.value !== name) {
        setName(inputRef.current.value)
      }
    }, 150)
    return () => clearInterval(interval)
  }, [name])

  useEffect(() => {
    const check = () => setIsSmall(window.innerWidth < 520)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const canCreate = name.trim().length > 0 || (inputRef.current?.value.trim().length ?? 0) > 0

  const handleCreate = async () => {
    const actualName = inputRef.current?.value.trim() || name.trim()
    if (!actualName || _submitting) return
    _submitting = true
    setCreating(true)
    const p = await saveProject(actualName)
    const plan = await savePlan(p.id, actualName + ' - Test Plan')
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

  const btnDisabled = !canCreate || creating

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: isSmall ? '16px 12px' : '32px 24px',
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

        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
          borderRadius: 18,
          padding: isSmall ? '28px 20px 24px' : '44px 44px 40px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.2)',
        }}>
          <h2 style={{ fontSize: isSmall ? 24 : 30, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', letterSpacing: '-0.6px' }}>New Project</h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', margin: '0 0 32px', lineHeight: 1.6 }}>Give your project a name to get started</p>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Project Name</label>
          <input
            ref={inputRef}
            autoFocus
            autoComplete="new-password"
            value={name}
            onChange={e => setName(e.target.value)}
            onInput={e => setName((e.target as HTMLInputElement).value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
            placeholder="e.g. MSS - Build Test Plan"
            style={inputStyle}
          />

          <div style={{ display: 'flex', gap: 12, flexWrap: isSmall ? 'wrap' : 'nowrap' }}>
            <button
              type="button"
              onClick={() => { _submitting = false; router.back() }}
              style={{
                flex: isSmall ? '1 1 100%' : 1,
                padding: '14px', background: 'transparent', color: 'var(--text-secondary)',
                border: '1px solid var(--border-strong)', borderRadius: 11, fontSize: 15,
                cursor: 'pointer', fontWeight: 500,
              }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={btnDisabled}
              style={{
                flex: isSmall ? '1 1 100%' : 2,
                padding: '14px', borderRadius: 11, fontSize: 15, fontWeight: 700,
                letterSpacing: '0.01em', border: 'none', transition: 'all 0.15s',
                background: btnDisabled
                  ? 'var(--border-strong)'
                  : 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
                color: btnDisabled ? 'var(--text-dim)' : 'white',
                cursor: btnDisabled ? 'not-allowed' : 'pointer',
                opacity: btnDisabled ? 0.55 : 1,
                pointerEvents: btnDisabled ? 'none' : 'auto',
              }}>
              {creating ? 'Creating…' : 'Create Project →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

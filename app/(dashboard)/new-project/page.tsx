'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { saveProject, savePlan } from '@/lib/db'

let _submitting = false

function NewProjectForm() {
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [isSmall, setIsSmall] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)

  const teamId   = searchParams.get('teamId')   || null
  const teamName = searchParams.get('teamName') || null

  useEffect(() => {
    _submitting = false
    setCreating(false)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      if (inputRef.current && inputRef.current.value !== name) setName(inputRef.current.value)
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
  const btnDisabled = !canCreate || creating

  const handleCreate = async () => {
    const actualName = inputRef.current?.value.trim() || name.trim()
    if (!actualName || _submitting) return
    _submitting = true
    setCreating(true)
    const p = await saveProject(actualName, teamId || undefined)
    const plan = await savePlan(p.id, actualName + ' - Test Plan')
    router.push(`/projects/${p.id}/plan/${plan.id}`)
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: isSmall ? '16px 12px' : '32px 24px',
    }}>

      {/* Brand header */}
      <div style={{ display:'flex', alignItems:'center', gap:13, marginBottom:28, justifyContent:'center' }}>
        <div style={{
          width:46, height:46, borderRadius:13, flexShrink:0,
          background:'linear-gradient(135deg,#f59e0b 0%,#f97316 60%,#ef4444 100%)',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 4px 18px rgba(249,115,22,0.50)',
        }}>
          <span style={{ color:'white', fontWeight:900, fontSize:22, letterSpacing:'-1px' }}>T</span>
        </div>
        <div>
          <div style={{ fontWeight:800, fontSize:21, color:'var(--text-primary)', letterSpacing:'-0.4px', lineHeight:1.15 }}>Testra</div>
          <div style={{ fontSize:10, color:'var(--text-secondary)', letterSpacing:'0.12em', textTransform:'uppercase', marginTop:1 }}>QA Platform</div>
        </div>
      </div>

      {/* Card */}
      <div style={{
        width:'100%', maxWidth:500,
        background:'var(--bg-surface)',
        border:'1px solid var(--border-strong)',
        borderTop:'3px solid #0ea5e9',
        borderRadius:16,
        padding: isSmall ? '28px 22px 26px' : '40px 40px 36px',
        boxShadow:'0 8px 40px rgba(0,0,0,0.18), 0 2px 16px rgba(14,165,233,0.08)',
      }}>

        {/* Heading */}
        <div style={{ marginBottom:6 }}>
          <h2 style={{ fontSize: isSmall ? 22 : 27, fontWeight:800, color:'var(--text-primary)', margin:0, letterSpacing:'-0.5px', lineHeight:1.2 }}>
            New Project
          </h2>
        </div>

        {/* Context label */}
        {teamId ? (
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:26 }}>
            <div style={{
              width:18, height:18, borderRadius:5,
              background:'linear-gradient(135deg,#0ea5e9,#0284c7)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:9, fontWeight:800, color:'white', flexShrink:0,
            }}>{(teamName || 'T')[0].toUpperCase()}</div>
            <span style={{ fontSize:13, color:'var(--text-secondary)' }}>
              Team project · <strong style={{ color:'var(--accent)', fontWeight:700 }}>{teamName}</strong>
            </span>
          </div>
        ) : (
          <p style={{ fontSize:13.5, color:'var(--text-secondary)', margin:'0 0 26px', lineHeight:1.6 }}>
            Personal project — only you can see it.
          </p>
        )}

        {/* Label */}
        <label style={{
          display:'block', fontSize:11, fontWeight:700,
          color:'var(--text-secondary)', marginBottom:8,
          textTransform:'uppercase', letterSpacing:'0.09em',
        }}>
          Project Name
        </label>

        {/* Input */}
        <input
          ref={inputRef} autoFocus autoComplete="new-password"
          value={name}
          onChange={e => setName(e.target.value)}
          onInput={e => setName((e.target as HTMLInputElement).value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
          placeholder="e.g. Mobile App v3 — QA"
          style={{
            display:'block', width:'100%', padding:'13px 15px',
            background:'var(--bg-elevated)',
            border:'1.5px solid var(--border-strong)',
            borderRadius:10, fontSize:15, color:'var(--text-primary)',
            outline:'none', boxSizing:'border-box', marginBottom:24,
            transition:'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = 'rgba(14,165,233,0.70)'
            e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(14,165,233,0.12)'
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = 'var(--border-strong)'
            e.currentTarget.style.boxShadow   = 'none'
          }}
        />

        {/* Buttons */}
        <div style={{ display:'flex', gap:10, flexWrap: isSmall ? 'wrap' : 'nowrap' }}>
          <button type="button" onClick={() => { _submitting = false; router.back() }}
            style={{
              flex: isSmall ? '1 1 100%' : 1,
              padding:'12px', background:'transparent', color:'var(--text-secondary)',
              border:'1px solid var(--border-strong)', borderRadius:10, fontSize:14,
              cursor:'pointer', fontWeight:600, transition:'all 0.14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-accent)'; e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.background='var(--bg-elevated)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-strong)'; e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.background='transparent' }}>
            Cancel
          </button>
          <button type="button" onClick={handleCreate} disabled={btnDisabled}
            style={{
              flex: isSmall ? '1 1 100%' : 2,
              padding:'12px', borderRadius:10, fontSize:14, fontWeight:700,
              border:'none', transition:'all 0.16s',
              background: btnDisabled
                ? 'var(--bg-depth)'
                : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 55%, #0369a1 100%)',
              color: btnDisabled ? 'var(--text-muted)' : 'white',
              cursor: btnDisabled ? 'not-allowed' : 'pointer',
              boxShadow: btnDisabled ? 'none' : '0 3px 14px rgba(14,165,233,0.40), inset 0 1px 0 rgba(255,255,255,0.22)',
              opacity: btnDisabled ? 0.6 : 1,
              letterSpacing:'0.01em',
            }}
            onMouseEnter={e => { if (!btnDisabled) { e.currentTarget.style.boxShadow='0 5px 22px rgba(14,165,233,0.60), inset 0 1px 0 rgba(255,255,255,0.22)'; e.currentTarget.style.transform='translateY(-1px)' } }}
            onMouseLeave={e => { if (!btnDisabled) { e.currentTarget.style.boxShadow='0 3px 14px rgba(14,165,233,0.40), inset 0 1px 0 rgba(255,255,255,0.22)'; e.currentTarget.style.transform='none' } }}>
            {creating ? 'Creating…' : 'Create Project →'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewProjectPage() {
  return <Suspense><NewProjectForm /></Suspense>
}

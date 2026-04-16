'use client'
import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { getProjects, getPlans, getFolders, getScripts, getTestRuns, deleteProject, getMyTeams, getTeamProjects, getSessionUser, invalidateCache, type Project, type Team } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { FolderKanban, Plus, HelpCircle, X, LogOut, KeyRound, ChevronUp, ChevronRight, Users } from 'lucide-react'
import { useSidebar } from '@/components/providers/sidebar-context'

// Unique gradient per team name (consistent hash)
const TEAM_PALETTES = [
  { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', shadow: 'rgba(245,158,11,0.50)' },  // amber
  { bg: 'linear-gradient(135deg,#10b981,#059669)', shadow: 'rgba(16,185,129,0.50)' },  // emerald
  { bg: 'linear-gradient(135deg,#f97316,#ea580c)', shadow: 'rgba(249,115,22,0.50)' },  // orange
  { bg: 'linear-gradient(135deg,#ec4899,#db2777)', shadow: 'rgba(236,72,153,0.50)' },  // pink
  { bg: 'linear-gradient(135deg,#14b8a6,#0d9488)', shadow: 'rgba(20,184,166,0.50)' },  // teal
  { bg: 'linear-gradient(135deg,#a78bfa,#7c3aed)', shadow: 'rgba(167,139,250,0.50)' }, // violet
  { bg: 'linear-gradient(135deg,#0ea5e9,#0284c7)', shadow: 'rgba(14,165,233,0.50)' },  // sky
]
function teamPalette(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return TEAM_PALETTES[Math.abs(h) % TEAM_PALETTES.length]
}

export function SidebarContent() {
  return (
    <Suspense fallback={null}>
      <SidebarInner />
    </Suspense>
  )
}

function SidebarInner() {
  const [projects, setProjects] = useState<Project[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [teamProjects, setTeamProjects] = useState<Record<string, Project[]>>({})
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; projectId: string } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [personalExpanded, setPersonalExpanded] = useState(true)
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({})
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSetPassword, setShowSetPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const router   = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isMobile, close } = useSidebar()

  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefetchProject = useCallback((projectId: string) => {
    getPlans(projectId).then(plans => {
      if (plans.length === 0) return
      const planId = plans[0].id
      Promise.all([getFolders(planId), getScripts(planId), getTestRuns(planId)]).catch(() => {})
    }).catch(() => {})
  }, [])

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const teamsRef = useRef<Team[]>([])
  useEffect(() => { teamsRef.current = teams }, [teams])

  const refresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(async () => {
      const [ps, ts] = await Promise.all([getProjects(), getMyTeams()])
      setProjects(ps)
      setTeams(ts)
      if (ts.length > 0) {
        const tpLists = await Promise.all(ts.map(t => getTeamProjects(t.id)))
        const tpMap: Record<string, Project[]> = {}
        ts.forEach((t, i) => { tpMap[t.id] = tpLists[i] })
        setTeamProjects(tpMap)
      }
    }, 80)
  }, [])

  // Force-refresh — bust all caches then re-fetch. Used by polling + focus.
  const forceRefresh = useCallback(async () => {
    const u = await getSessionUser()
    if (!u) return
    invalidateCache(`projects:${u.id}`, `teams:${u.id}`)
    teamsRef.current.forEach(t => invalidateCache(`team-projects:${t.id}`))
    refresh()
  }, [refresh])

  // Auto-expand any newly-loaded team that hasn't been explicitly collapsed
  useEffect(() => {
    setExpandedTeams(prev => {
      const updates: Record<string, boolean> = {}
      teams.forEach(t => { if (!(t.id in prev)) updates[t.id] = true })
      return Object.keys(updates).length ? { ...prev, ...updates } : prev
    })
  }, [teams])

  useEffect(() => { refresh() }, [pathname, refresh])
  useEffect(() => {
    window.addEventListener('qaflow:change', refresh)
    return () => window.removeEventListener('qaflow:change', refresh)
  }, [refresh])

  // Polling + visibility-based refresh — GUARANTEES team changes are seen
  // within a few seconds even if Supabase Realtime is misconfigured
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') forceRefresh()
    }, 5000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') forceRefresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [forceRefresh])
  useEffect(() => {
    const close = () => { setCtxMenu(null); setShowUserMenu(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    getSessionUser().then(u => { if (u?.email) setUserEmail(u.email) })
  }, [])

  // Realtime — when THIS user's team membership changes (added/removed by owner),
  // bust the stale teams cache and refresh sidebar immediately
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    getSessionUser().then(u => {
      if (!u) return
      channel = supabase
        .channel(`my-memberships-${u.id}`)
        .on('postgres_changes', {
          event: 'DELETE', schema: 'public', table: 'team_members',
          filter: `user_id=eq.${u.id}`,
        }, () => {
          // Removed from a team — clear all team caches and refresh
          invalidateCache(`teams:${u.id}`)
          refresh()
        })
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'team_members',
          filter: `user_id=eq.${u.id}`,
        }, () => {
          // Added to a new team — clear teams cache and refresh
          invalidateCache(`teams:${u.id}`)
          refresh()
        })
        .subscribe()
    })
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [refresh])

  // Realtime — when a project is added/deleted inside any of this user's teams,
  // bust the cache and refresh so it appears/disappears instantly
  useEffect(() => {
    if (teams.length === 0) return
    const channels = teams.map(team =>
      supabase
        .channel(`team-projects-${team.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects',
          filter: `team_id=eq.${team.id}` }, () => {
          invalidateCache(`team-projects:${team.id}`)
          refresh()
        })
        .subscribe()
    )
    return () => { channels.forEach(c => supabase.removeChannel(c)) }
  }, [teams, refresh])

  const handleSignOut = async () => {
    // Clear persisted cache so next user doesn't see stale data
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('testra_cache_'))
        .forEach(k => localStorage.removeItem(k))
    } catch {}
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSetPassword = async () => {
    if (newPassword.length < 6) { setPwError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match.'); return }
    setPwLoading(true); setPwError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwLoading(false)
    if (error) {
      if (error.message.includes('JWT') || error.message.includes('sub claim')) {
        // Stale session from deleted account — sign out and redirect
        await supabase.auth.signOut()
        router.push('/login')
        return
      }
      setPwError(error.message)
      return
    }
    setPwSuccess(true)
    setTimeout(() => {
      setShowSetPassword(false); setNewPassword(''); setConfirmPassword(''); setPwSuccess(false)
    }, 1800)
  }

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId)
    setCtxMenu(null)
    refresh()
    if (pathname.includes('/projects/' + projectId)) router.push('/projects')
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', position: 'relative',
      background: 'linear-gradient(170deg, #0d1b2e 0%, #091524 55%, #060f1c 100%)',
      borderRight: '1px solid rgba(14,165,233,0.12)',
      overflow: 'hidden',
    }}>

      {/* Glossy top sheen overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 220,
        background: 'linear-gradient(180deg, rgba(14,165,233,0.16) 0%, transparent 100%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      {/* Bottom fade */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.35) 0%, transparent 100%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Logo ── */}
      <div onClick={() => { router.push('/projects'); if (isMobile) close() }}
        style={{
          position: 'relative', zIndex: 1,
          padding: '24px 20px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0, cursor: 'pointer',
        }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13,
            background: 'linear-gradient(135deg,#f59e0b 0%,#f97316 60%,#ef4444 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 18px rgba(249,115,22,0.55), inset 0 1px 0 rgba(255,255,255,0.22)',
          }}>
            <span style={{
              color: 'white', fontWeight: 900, fontSize: 22,
              letterSpacing: '-1px', lineHeight: 1,
            }}>T</span>
          </div>
          <div style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 9, height: 9, borderRadius: '50%',
            background: '#22c55e',
            border: '2px solid #0f1220',
            boxShadow: '0 0 6px rgba(34,197,94,0.8)',
          }} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#f0f2ff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>Testra</div>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2 }}>QA Platform</div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 16, position: 'relative', zIndex: 1 }}>

        {/* ── PERSONAL section ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px 8px 18px' }}>
          <div
            onClick={() => setPersonalExpanded(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1, minWidth: 0, padding: '2px 0', userSelect: 'none' }}
          >
            <ChevronRight size={11} color="rgba(255,255,255,0.35)" strokeWidth={2.5}
              style={{ flexShrink: 0, transform: personalExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.22s ease' }} />
            <FolderKanban size={11} color="rgba(255,255,255,0.28)" strokeWidth={2} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.28)' }}>
              Personal
            </span>
            {!personalExpanded && projects.length > 0 && (
              <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 5px', marginLeft: 2 }}>
                {projects.length}
              </span>
            )}
          </div>
          <a href="/new-project" title="New project" style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0,
            background: 'rgba(14,165,233,0.14)', border: '1px solid rgba(14,165,233,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', textDecoration: 'none', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.28)'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.60)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.14)'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.30)' }}>
            <Plus size={12} color="#38bdf8" strokeWidth={2.5} />
          </a>
        </div>

        {/* Personal projects — animated collapse */}
        <div style={{ overflow: 'hidden', maxHeight: personalExpanded ? '2000px' : '0px', transition: 'max-height 0.28s ease' }}>
        {projects.length === 0 && (
          <div style={{ padding: '6px 22px 10px', fontSize: 12, color: 'rgba(255,255,255,0.18)', fontStyle: 'italic' }}>
            No projects yet
          </div>
        )}

        {projects.map(p => {
          const isActive = pathname.includes('/projects/' + p.id)
          return (
            <div key={p.id}
              onClick={async () => {
                const plans = await getPlans(p.id)
                if (plans.length >= 1) router.push(`/projects/${p.id}/plan/${plans[0].id}`)
                else router.push('/projects/' + p.id)
                if (isMobile) close()
              }}
              onContextMenu={e => { e.preventDefault(); const x=Math.min(e.clientX,window.innerWidth-180-8); const y=Math.min(e.clientY,window.innerHeight-80-8); setCtxMenu({ x, y, projectId: p.id }) }}
              style={{
                position: 'relative', padding: '9px 20px 9px 22px', fontSize: 13.5, cursor: 'pointer',
                color: isActive ? '#ffffff' : 'rgba(255,255,255,0.55)',
                fontWeight: isActive ? 600 : 400,
                background: isActive ? 'linear-gradient(90deg, rgba(14,165,233,0.18) 0%, rgba(14,165,233,0.06) 100%)' : 'transparent',
                borderLeft: isActive ? '3px solid #0ea5e9' : '3px solid transparent',
                userSelect: 'none', transition: 'all 0.14s', lineHeight: 1.45,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.055)'; e.currentTarget.style.color = 'rgba(255,255,255,0.88)' }
                if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current)
                prefetchTimerRef.current = setTimeout(() => prefetchProject(p.id), 150)
              }}
              onMouseLeave={e => {
                if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }
                if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current)
              }}
              title={p.name}>
              {p.name}
            </div>
          )
        })}

        </div>{/* end personal collapse wrapper */}

        {/* ── TEAM section ── */}
        <div style={{ margin: '12px 0 0', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 18px 10px' }}>
            <Users size={11} color="rgba(255,255,255,0.28)" strokeWidth={2} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.28)' }}>
              Teams
            </span>
          </div>

          {teams.length === 0 ? (
            <div onClick={() => { router.push('/team'); if (isMobile) close() }}
              style={{ padding: '6px 22px 10px', fontSize: 12, color: 'rgba(255,255,255,0.22)', cursor: 'pointer', fontStyle: 'italic', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.22)')}>
              Create or join a team →
            </div>
          ) : (
            teams.map(team => {
              const isTeamActive = pathname === '/team' && searchParams.get('tid') === team.id
              const tProjects = teamProjects[team.id] || []
              return (
                <div key={team.id} style={{ marginBottom: 6 }}>
                  {/* Team header row — chevron + avatar + name + add button */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 0 14px', gap: 4, marginBottom: 2 }}>
                    {/* Collapse chevron */}
                    <div
                      onClick={() => setExpandedTeams(prev => ({ ...prev, [team.id]: !prev[team.id] }))}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 4, flexShrink: 0, transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      title={expandedTeams[team.id] !== false ? 'Collapse' : 'Expand'}
                    >
                      <ChevronRight size={11} color="rgba(255,255,255,0.40)" strokeWidth={2.5}
                        style={{ transform: expandedTeams[team.id] !== false ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.22s ease' }} />
                    </div>

                    {/* Team name (→ /team page) */}
                    <div onClick={() => { router.push(`/team?tid=${team.id}`); if (isMobile) close() }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0,
                        padding: '6px 6px 6px 2px', cursor: 'pointer', borderRadius: 7,
                        background: isTeamActive ? 'rgba(14,165,233,0.15)' : 'transparent',
                        transition: 'background 0.14s',
                      }}
                      onMouseEnter={e => { if (!isTeamActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                      onMouseLeave={e => { if (!isTeamActive) e.currentTarget.style.background = 'transparent' }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                        background: teamPalette(team.name).bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 2px 8px ${teamPalette(team.name).shadow}`,
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'white' }}>{(team.name || '?')[0].toUpperCase()}</span>
                      </div>
                      <span style={{
                        fontSize: 12.5, fontWeight: 600,
                        color: isTeamActive ? '#7dd3fc' : 'rgba(255,255,255,0.72)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      }}>{team.name}</span>
                      {expandedTeams[team.id] === false && tProjects.length > 0 && (
                        <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>
                          {tProjects.length}
                        </span>
                      )}
                    </div>

                    {/* + New project in team */}
                    <button
                      onClick={() => { router.push(`/new-project?teamId=${team.id}&teamName=${encodeURIComponent(team.name)}`); if (isMobile) close() }}
                      title={`New project in ${team.name}`}
                      style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        background: 'rgba(14,165,233,0.14)', border: '1px solid rgba(14,165,233,0.30)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.30)'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.6)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.14)'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.30)' }}>
                      <Plus size={11} color="#38bdf8" strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* Team projects — animated collapse */}
                  <div style={{ overflow: 'hidden', maxHeight: expandedTeams[team.id] !== false ? '2000px' : '0px', transition: 'max-height 0.28s ease' }}>
                    {tProjects.length === 0 ? (
                      <div style={{ padding: '3px 22px 6px 54px', fontSize: 11.5, color: 'rgba(255,255,255,0.18)', fontStyle: 'italic' }}>
                        No projects yet
                      </div>
                    ) : (
                      tProjects.map(p => {
                        const isActive = pathname.includes('/projects/' + p.id)
                        return (
                          <div key={p.id}
                            onClick={async () => {
                              const plans = await getPlans(p.id)
                              if (plans.length >= 1) router.push(`/projects/${p.id}/plan/${plans[0].id}`)
                              else router.push('/projects/' + p.id)
                              if (isMobile) close()
                            }}
                            onContextMenu={e => { e.preventDefault(); const x=Math.min(e.clientX,window.innerWidth-180-8); const y=Math.min(e.clientY,window.innerHeight-80-8); setCtxMenu({ x, y, projectId: p.id }) }}
                            style={{
                              padding: '7px 20px 7px 54px', fontSize: 13, cursor: 'pointer',
                              color: isActive ? '#ffffff' : 'rgba(255,255,255,0.50)',
                              fontWeight: isActive ? 600 : 400,
                              background: isActive ? 'linear-gradient(90deg,rgba(14,165,233,0.18) 0%,rgba(14,165,233,0.06) 100%)' : 'transparent',
                              borderLeft: isActive ? '3px solid #0284c7' : '3px solid transparent',
                              transition: 'all 0.14s', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)' } }}
                            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.50)' } }}
                            title={p.name}>
                            {p.name}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

      </div>

      {/* ── Right-click context menu ── */}
      {ctxMenu && (() => {
        const pid = ctxMenu.projectId
        return createPortal(
          <div
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
              background: '#0d1b2e', border: '1px solid rgba(14,165,233,0.20)',
              borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
              zIndex: 9999, minWidth: 160, overflow: 'hidden',
            }}>
            <button
              onMouseDown={e => { e.stopPropagation(); handleDeleteProject(pid) }}
              style={{
                display: 'block', width: '100%', padding: '10px 16px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#f87171', fontSize: 13, fontWeight: 600,
                textAlign: 'left', transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              🗑 Delete Project
            </button>
          </div>,
          document.body
        )
      })()}

      {/* ── User menu popup ── */}
      {showUserMenu && createPortal(
        <div onMouseDown={e => e.stopPropagation()} style={{
          position: 'fixed', bottom: 72, left: 12, width: 212,
          background: '#1e2235', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 9999, overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>Signed in as</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
          </div>
          <button
            onMouseDown={() => { setShowUserMenu(false); setShowSetPassword(true); setPwError(''); setNewPassword(''); setConfirmPassword('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.70)', fontSize: 13, fontWeight: 500, transition: 'background 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <KeyRound size={14} color="rgba(255,255,255,0.45)" />
            Set password
          </button>
          <button
            onMouseDown={handleSignOut}
            style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 13, fontWeight: 500, transition: 'background 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <LogOut size={14} color="#f87171" />
            Sign out
          </button>
        </div>,
        document.body
      )}

      {/* ── Footer ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: '10px 14px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {/* User avatar button */}
        <button
          onClick={() => setShowUserMenu(v => !v)}
          title={userEmail}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0,
            background: showUserMenu ? 'rgba(14,165,233,0.18)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${showUserMenu ? 'rgba(14,165,233,0.45)' : 'rgba(255,255,255,0.09)'}`,
            borderRadius: 8, padding: '6px 9px', cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!showUserMenu) { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)' } }}
          onMouseLeave={e => { if (!showUserMenu) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)' } }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            background: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: 'white',
          }}>
            {userEmail ? userEmail[0].toUpperCase() : '?'}
          </div>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
            {userEmail || 'Account'}
          </span>
          <ChevronUp size={12} color="rgba(255,255,255,0.30)" style={{ flexShrink: 0, transform: showUserMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>

        <button
          onClick={() => setShowHelp(true)}
          title="How to use Testra"
          style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 7, width: 26, height: 26, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.25)'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.6)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}>
          <HelpCircle size={13} color="rgba(255,255,255,0.45)" />
        </button>
      </div>

      {/* ── Set password modal ── */}
      {showSetPassword && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.60)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}
          onClick={() => setShowSetPassword(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#14172a', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: '28px 32px', width: 360, maxWidth: '90vw',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <KeyRound size={16} color="white" />
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#f0f2ff', letterSpacing: '-0.3px' }}>Set password</span>
              </div>
              <button onClick={() => setShowSetPassword(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
                <X size={18} />
              </button>
            </div>
            {pwSuccess ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
                <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 15 }}>Password set successfully!</div>
              </div>
            ) : (
              <>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.40)', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>NEW PASSWORD</label>
                <input
                  autoFocus type="password" value={newPassword} placeholder="Min. 6 characters"
                  onChange={e => { setNewPassword(e.target.value); setPwError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13.5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f2ff', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
                />
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.40)', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>CONFIRM PASSWORD</label>
                <input
                  type="password" value={confirmPassword} placeholder="Repeat password"
                  onChange={e => { setConfirmPassword(e.target.value); setPwError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13.5, background: 'rgba(255,255,255,0.07)', border: `1px solid ${pwError ? '#f87171' : 'rgba(255,255,255,0.12)'}`, color: '#f0f2ff', outline: 'none', boxSizing: 'border-box' }}
                />
                {pwError && <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{pwError}</div>}
                <button onClick={handleSetPassword} disabled={pwLoading || !newPassword || !confirmPassword} style={{
                  width: '100%', marginTop: 16, padding: '11px', borderRadius: 9, border: 'none',
                  background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: 'white',
                  fontWeight: 700, fontSize: 14, cursor: pwLoading ? 'not-allowed' : 'pointer',
                  opacity: (pwLoading || !newPassword || !confirmPassword) ? 0.55 : 1, transition: 'opacity 0.15s',
                }}>
                  {pwLoading ? 'Saving…' : 'Save password'}
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── Tutorial overlay ── */}
      {showHelp && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.60)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
        }} onClick={() => setShowHelp(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#14172a', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: '28px 32px', maxWidth: 540, width: '90vw',
            maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 1.7,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HelpCircle size={16} color="white" />
                </div>
                <span style={{ fontSize: 17, fontWeight: 800, color: '#f0f2ff', letterSpacing: '-0.3px' }}>How to use Testra</span>
              </div>
              <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
                <X size={18} />
              </button>
            </div>
            {[
              { step: '1', title: 'Create a Project', color: '#0ea5e9', body: 'Click the + button next to PROJECTS in the sidebar. Name your project (e.g. "Mobile App v3"). A project is the top-level container for all related test plans.' },
              { step: '2', title: 'Add a Test Plan', color: '#0ea5e9', body: 'Inside a project, create a test plan to represent a release or sprint (e.g. "Release 2.4"). Each plan has its own folder structure and run history.' },
              { step: '3', title: 'Organise with Folders & Scripts', color: '#0284c7', body: 'Click the Folder button to create a folder (e.g. "Authentication"). Then use the Script button to create scripts inside that folder. Scripts are where your test cases live.' },
              { step: '4', title: 'Author Test Cases', color: '#38bdf8', body: 'Open a script and type a test case title in the input at the bottom — press Enter to add it. Double-click any row to edit. Right-click a row to insert above, add a heading, or delete. Press Shift+Enter on any selected row to insert a blank row above it.' },
              { step: '5', title: 'Execute a Test Run', color: '#22c55e', body: 'Click New Run and enter the tester name and build reference. Click a run column to activate it, then click any test row to record a result: Pass, Fail, Blocked, Query, or Exclude.' },
              { step: '6', title: 'Review Combined Results', color: '#f59e0b', body: 'The plan overview shows aggregated totals across all runs and testers for every folder and script. Expand any script row to see a per-run breakdown. The top bar shows overall plan progress.' },
              { step: '7', title: 'Export a PDF Report', color: '#ef4444', body: 'Inside any script, click the Report button to generate a combined PDF — includes a runs summary table with pass rates and a full results matrix for every test case across all runs.' },
            ].map(({ step, title, color, body }) => (
              <div key={step} style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'white' }}>{step}</span>
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#f0f2ff', marginBottom: 3 }}>{title}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.60)', lineHeight: 1.6 }}>{body}</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 8, padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, fontSize: 12.5, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
              All data is stored in Supabase · Right-click any project for delete option
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

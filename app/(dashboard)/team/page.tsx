'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  getMyTeams, createTeam, getTeamMembers, removeTeamMember,
  getTeamInvites, inviteToTeam, cancelInvite, updateTeam,
  getPendingInvitesForMe, acceptInvite, deleteTeam, getSessionUser,
  invalidateCache,
  type Team, type TeamMember, type TeamInvite,
} from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { Users, Plus, X, Mail, Crown, Trash2, Pencil, Check, UserPlus, Shield } from 'lucide-react'

// ── tiny helpers ────────────────────────────────────────────────
function Avatar({ name, size = 36, gradient = 'linear-gradient(135deg,#0ea5e9,#0284c7)' }: { name: string; size?: number; gradient?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3, flexShrink: 0,
      background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 2px 10px rgba(14,165,233,0.35)`,
      fontSize: size * 0.38, fontWeight: 800, color: 'white', letterSpacing: '-0.5px',
    }}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'var(--text-body-dim)', marginBottom: 12 }}>
      {children}
    </div>
  )
}

// ── context menu ────────────────────────────────────────────────
type CtxMenu = { x: number; y: number; type: 'team'; team: Team }

export default function TeamPage() {
  const [teams, setTeams]             = useState<Team[]>([])
  const [activeTeam, setActiveTeam]   = useState<Team | null>(null)
  const [members, setMembers]         = useState<TeamMember[]>([])
  const [invites, setInvites]         = useState<TeamInvite[]>([])
  const [myInvites, setMyInvites]     = useState<(TeamInvite & { teamName: string })[]>([])
  const [loading, setLoading]         = useState(true)
  const [creating, setCreating]       = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting]       = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [deletingTeam, setDeletingTeam] = useState(false)
  const [ctxMenu, setCtxMenu]         = useState<CtxMenu | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteInputRef = useRef<HTMLInputElement>(null)

  const loadTeam = useCallback(async (team: Team) => {
    setActiveTeam(team)
    const [m, i] = await Promise.all([getTeamMembers(team.id), getTeamInvites(team.id)])
    setMembers(m); setInvites(i)
  }, [])

  const load = useCallback(async (tid?: string): Promise<number> => {
    setLoading(true)
    try {
      const user = await getSessionUser()
      if (user) setCurrentUserId(user.id)
      const [ts, pending] = await Promise.all([getMyTeams(), getPendingInvitesForMe()])
      setTeams(ts); setMyInvites(pending)
      if (ts.length > 0) {
        const target = tid ? (ts.find(t => t.id === tid) ?? ts[0]) : ts[0]
        await loadTeam(target)
      } else { setActiveTeam(null); setMembers([]); setInvites([]) }
      return ts.length
    } catch (e) { console.error(e); return 0 }
    finally { setLoading(false) }
  }, [loadTeam])

  // Initial load — pass tid from URL so the right team is selected immediately
  useEffect(() => {
    load(searchParams.get('tid') ?? undefined)
  }, [load]) // eslint-disable-line react-hooks/exhaustive-deps

  // When user switches team via sidebar (?tid= changes), swap without full reload
  const prevTidRef = useRef<string | null>(null)
  useEffect(() => {
    const tid = searchParams.get('tid')
    if (!tid || tid === prevTidRef.current) return
    prevTidRef.current = tid
    setTeams(prev => {
      const target = prev.find(t => t.id === tid)
      if (target && target.id !== activeTeam?.id) loadTeam(target)
      return prev
    })
  }, [searchParams, loadTeam]) // eslint-disable-line react-hooks/exhaustive-deps

  // Dismiss context menu on click outside
  useEffect(() => {
    const handler = () => setCtxMenu(null)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Realtime
  useEffect(() => {
    if (!activeTeam) return
    const teamId = activeTeam.id
    const ch = supabase.channel(`team-page-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_invites', filter: `team_id=eq.${teamId}` }, async () => {
        invalidateCache(`invites:${teamId}`, `members:${teamId}`)
        const [m, i] = await Promise.all([getTeamMembers(teamId), getTeamInvites(teamId)])
        setMembers(m); setInvites(i)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members', filter: `team_id=eq.${teamId}` }, async () => {
        invalidateCache(`members:${teamId}`)
        const [m, i] = await Promise.all([getTeamMembers(teamId), getTeamInvites(teamId)])
        setMembers(m); setInvites(i)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeTeam])

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return
    setSaving(true); setError('')
    try {
      const team = await createTeam(newTeamName.trim())
      setNewTeamName(''); setCreating(false)
      const ts = await getMyTeams(); setTeams(ts)
      await loadTeam(team)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function handleInvite() {
    if (!activeTeam || !inviteEmail.trim()) return
    setInviting(true); setInviteError('')
    try {
      await inviteToTeam(activeTeam.id, inviteEmail.trim())
      setInviteEmail(''); setInviteSuccess(true)
      setTimeout(() => setInviteSuccess(false), 2500)
      const i = await getTeamInvites(activeTeam.id); setInvites(i)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send invite'
      setInviteError(msg.includes('duplicate') ? 'Already invited.' : msg)
    } finally { setInviting(false) }
  }

  async function handleRemoveMember(memberId: string) {
    if (!activeTeam || !confirm('Remove this member?')) return
    await removeTeamMember(activeTeam.id, memberId)
    const [m, i] = await Promise.all([getTeamMembers(activeTeam.id), getTeamInvites(activeTeam.id)])
    setMembers(m); setInvites(i)
  }

  async function handleCancelInvite(inviteId: string) {
    if (!activeTeam) return
    await cancelInvite(inviteId, activeTeam.id)
    const i = await getTeamInvites(activeTeam.id); setInvites(i)
  }

  async function handleRenameTeam() {
    if (!activeTeam || !editName.trim()) return
    setSaving(true)
    try {
      await updateTeam(activeTeam.id, editName.trim())
      const ts = await getMyTeams(); setTeams(ts)
      setActiveTeam({ ...activeTeam, name: editName.trim() }); setEditingName(false)
    } finally { setSaving(false) }
  }

  async function handleAcceptInvite(inv: TeamInvite & { teamName: string }) {
    setAcceptingId(inv.id)
    try { await acceptInvite(inv.id, inv.teamId); await load() }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
    finally { setAcceptingId(null) }
  }

  async function handleDeclineInvite(inv: TeamInvite & { teamName: string }) {
    if (!confirm(`Decline invitation to join "${inv.teamName}"?`)) return
    try { await cancelInvite(inv.id, inv.teamId); setMyInvites(prev => prev.filter(i => i.id !== inv.id)) }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
  }

  async function handleDeleteTeam(team: Team) {
    if (!confirm(`Delete "${team.name}"? This removes all members and cannot be undone.`)) return
    setDeletingTeam(true)
    try {
      await deleteTeam(team.id)
      setActiveTeam(null); setMembers([]); setInvites([])
      window.dispatchEvent(new Event('qaflow:change'))
      const remaining = await load(undefined)
      if (remaining === 0) router.push('/projects')
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
    finally { setDeletingTeam(false) }
  }

  function openCtx(e: React.MouseEvent, item: CtxMenu) {
    e.preventDefault(); e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 200 - 8)
    const y = Math.min(e.clientY, window.innerHeight - 120 - 8)
    setCtxMenu({ ...item, x, y })
  }

  const isOwner = currentUserId ? members.find(m => m.userId === currentUserId)?.role === 'owner' : false

  // ── Loading ─────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(14,165,233,0.35)' }}>
          <Users size={20} color="white" />
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-body-dim)' }}>Loading teams…</span>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', paddingBottom: 48 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* ── Page header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, paddingBottom: 20,
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            background: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 14px rgba(14,165,233,0.35)',
          }}>
            <Users size={18} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.4px', margin: 0, lineHeight: 1.2 }}>Teams</h1>
            <p style={{ fontSize: 12, color: 'var(--text-body-dim)', margin: '2px 0 0', lineHeight: 1 }}>Manage your teams, members and projects</p>
          </div>
        </div>
        <button onClick={() => setCreating(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 16px', borderRadius: 10,
            background: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
            border: '1px solid rgba(14,165,233,0.4)',
            color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: '0 3px 14px rgba(14,165,233,0.32)',
            transition: 'all 0.16s',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 5px 20px rgba(14,165,233,0.50)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 3px 14px rgba(14,165,233,0.32)'; e.currentTarget.style.transform = 'none' }}>
          <Plus size={14} /> New Team
        </button>
      </div>

      {/* ── Pending invites for ME ── */}
      {myInvites.length > 0 && (
        <div style={{
          borderRadius: 14, marginBottom: 24, overflow: 'hidden',
          background: 'var(--bg-surface)',
          border: '1px solid rgba(14,165,233,0.25)',
          boxShadow: '0 3px 16px rgba(14,165,233,0.10)',
        }}>
          {/* Compact header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px',
            background: 'linear-gradient(135deg,rgba(14,165,233,0.12) 0%,rgba(6,182,212,0.06) 100%)',
            borderBottom: '1px solid rgba(14,165,233,0.18)',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(14,165,233,0.35)',
            }}>
              <UserPlus size={14} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Team Invitation{myInvites.length > 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-body-dim)', marginTop: 1 }}>
                You have {myInvites.length} pending invitation{myInvites.length > 1 ? 's' : ''}
              </div>
            </div>
            <span style={{
              fontSize: 10.5, fontWeight: 700,
              background: 'rgba(14,165,233,0.14)', border: '1px solid rgba(14,165,233,0.28)',
              color: '#0284c7', borderRadius: 20, padding: '3px 9px',
            }}>{myInvites.length} new</span>
          </div>

          {/* Invite rows */}
          {myInvites.map((inv, i) => (
            <div key={inv.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '13px 18px',
              borderBottom: i < myInvites.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              transition: 'background 0.12s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-base)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 10px rgba(14,165,233,0.32)',
                  fontSize: 15, fontWeight: 900, color: 'white',
                }}>{(inv.teamName || '?')[0].toUpperCase()}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.teamName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-body-dim)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Mail size={9} /> You were invited to collaborate
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                {/* Decline */}
                <button onClick={() => handleDeclineInvite(inv)} disabled={acceptingId === inv.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 13px', borderRadius: 8,
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--text-body-dim)', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                    transition: 'all 0.13s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.30)'; e.currentTarget.style.color = '#f87171' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-body-dim)' }}>
                  <X size={12} /> Decline
                </button>
                {/* Accept */}
                <button onClick={() => handleAcceptInvite(inv)} disabled={acceptingId === inv.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 15px', borderRadius: 8, flexShrink: 0,
                    background: acceptingId === inv.id ? 'rgba(14,165,233,0.15)' : 'linear-gradient(135deg,#0ea5e9,#0284c7)',
                    border: '1px solid rgba(14,165,233,0.40)',
                    color: 'white', fontWeight: 700, fontSize: 12,
                    cursor: acceptingId === inv.id ? 'not-allowed' : 'pointer',
                    opacity: acceptingId === inv.id ? 0.7 : 1,
                    boxShadow: acceptingId === inv.id ? 'none' : '0 2px 10px rgba(14,165,233,0.30)',
                    transition: 'all 0.14s',
                  }}
                  onMouseEnter={e => { if (acceptingId !== inv.id) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(14,165,233,0.48)' } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(14,165,233,0.30)' }}>
                  {acceptingId === inv.id
                    ? <><span style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Joining…</>
                    : <><Check size={12} /> Accept</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create team inline form ── */}
      {creating && (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
          borderRadius: 14, padding: 20, marginBottom: 24,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={12} color="white" />
            </div>
            Create a new team
          </div>
          <input autoFocus value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateTeam(); if (e.key === 'Escape') { setCreating(false); setNewTeamName('') } }}
            placeholder="e.g. Design QA, Backend, Mobile…"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 9, fontSize: 14,
              background: 'var(--bg-base)', border: '2px solid var(--border)',
              color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', marginBottom: 12,
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#0ea5e9')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}><X size={12} />{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreateTeam} disabled={saving || !newTeamName.trim()} style={{
              padding: '9px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
              border: 'none', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              opacity: saving || !newTeamName.trim() ? 0.5 : 1,
            }}>{saving ? 'Creating…' : 'Create Team'}</button>
            <button onClick={() => { setCreating(false); setNewTeamName(''); setError('') }} style={{
              padding: '9px 18px', borderRadius: 8, background: 'transparent',
              border: '1px solid var(--border)', color: 'var(--text-body-dim)', fontSize: 13, cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── No teams ── */}
      {teams.length === 0 && !creating && (
        <div style={{
          borderRadius: 16, padding: '36px 28px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          {/* Icon */}
          <div style={{
            width: 52, height: 52, borderRadius: 14, marginBottom: 16,
            background: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 18px rgba(14,165,233,0.35)',
          }}>
            <Users size={22} color="white" />
          </div>

          <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.3px' }}>
            No teams yet
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-body-dim)', margin: '0 0 22px', textAlign: 'center', lineHeight: 1.6, maxWidth: 280 }}>
            Create a team to collaborate with colleagues on shared QA projects.
          </p>

          {/* Feature chips — 3 different colours */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 20, background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.20)', fontSize: 11.5, fontWeight: 600, color: '#0ea5e9' }}>
              <Users size={10} /> Invite members
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 20, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', fontSize: 11.5, fontWeight: 600, color: '#d97706' }}>
              <Shield size={10} /> Manage roles
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 20, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)', fontSize: 11.5, fontWeight: 600, color: '#16a34a' }}>
              <Mail size={10} /> Send invites
            </div>
          </div>

          <button onClick={() => setCreating(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 24px', borderRadius: 10,
              background: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
              border: '1px solid rgba(14,165,233,0.4)',
              color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              boxShadow: '0 3px 14px rgba(14,165,233,0.36)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(14,165,233,0.50)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 3px 14px rgba(14,165,233,0.36)' }}>
            <Plus size={14} /> Create your first team
          </button>
        </div>
      )}

      {/* ── Main content ── */}
      {teams.length > 0 && activeTeam && (
        <div>

          {/* ── Team detail ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Team hero card ── */}
            <div style={{
              borderRadius: 16,
              border: '1px solid rgba(14,165,233,0.22)',
              background: 'var(--bg-surface)',
              boxShadow: '0 4px 20px rgba(14,165,233,0.10)',
              overflow: 'hidden',
              isolation: 'isolate',
            }}>
              {/* Banner — avatar + name + rename all inside */}
              <div style={{
                position: 'relative',
                background: 'linear-gradient(135deg,#0369a1 0%,#0284c7 50%,#0ea5e9 100%)',
                padding: '18px 20px',
              }}>
                {/* Decorative bg */}
                <div style={{ position: 'absolute', top: -30, right: -20, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.14) 0%,transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -35, left: 30, width: 110, height: 110, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.07) 0%,transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

                {/* Content row */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    {/* Avatar — unique colour per team name */}
                    {(() => {
                      const P=[{bg:'linear-gradient(135deg,#f59e0b,#d97706)',sh:'rgba(245,158,11,0.55)'},{bg:'linear-gradient(135deg,#10b981,#059669)',sh:'rgba(16,185,129,0.55)'},{bg:'linear-gradient(135deg,#f97316,#ea580c)',sh:'rgba(249,115,22,0.55)'},{bg:'linear-gradient(135deg,#ec4899,#db2777)',sh:'rgba(236,72,153,0.55)'},{bg:'linear-gradient(135deg,#14b8a6,#0d9488)',sh:'rgba(20,184,166,0.55)'},{bg:'linear-gradient(135deg,#a78bfa,#7c3aed)',sh:'rgba(167,139,250,0.55)'},{bg:'linear-gradient(135deg,#0ea5e9,#0284c7)',sh:'rgba(14,165,233,0.55)'}]
                      let h=0; for(let i=0;i<activeTeam.name.length;i++) h=activeTeam.name.charCodeAt(i)+((h<<5)-h)
                      const p=P[Math.abs(h)%P.length]
                      return <div style={{width:42,height:42,borderRadius:12,flexShrink:0,background:p.bg,border:'2px solid rgba(255,255,255,0.35)',boxShadow:`0 3px 14px ${p.sh}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,fontWeight:900,color:'white',letterSpacing:'-0.5px'}}>{(activeTeam.name||'?')[0].toUpperCase()}</div>
                    })()}

                    {/* Name + role */}
                    <div style={{ minWidth: 0 }}>
                      {editingName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input autoFocus value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRenameTeam(); if (e.key === 'Escape') setEditingName(false) }}
                            style={{
                              padding: '5px 10px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                              background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.45)',
                              color: 'white', outline: 'none', width: 180,
                            }}
                          />
                          <button onClick={handleRenameTeam} disabled={saving}
                            style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.45)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={12} color="white" />
                          </button>
                          <button onClick={() => setEditingName(false)}
                            style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.20)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={12} color="rgba(255,255,255,0.8)" />
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'white', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeTeam.name}</div>
                      )}
                      <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.60)', marginTop: 3 }}>
                        Team workspace
                      </div>
                    </div>
                  </div>

                  {/* Rename button */}
                  {!editingName && isOwner && (
                    <button onClick={() => { setEditName(activeTeam.name); setEditingName(true) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                        borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.28)',
                        color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        backdropFilter: 'blur(10px)', transition: 'background 0.14s', flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.26)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}>
                      <Pencil size={11} /> Rename
                    </button>
                  )}
                </div>
              </div>

              {/* Stats strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
                <div style={{ padding: '12px 16px', borderRight: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--text-body-dim)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <Users size={9} /> Members
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-hover)', lineHeight: 1 }}>{members.length}</div>
                </div>
                <div style={{ padding: '12px 16px', borderRight: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--text-body-dim)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <Mail size={9} /> Pending
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{invites.length}</div>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--text-body-dim)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <Shield size={9} /> Your Role
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#16a34a', lineHeight: 1, textTransform: 'capitalize' }}>
                    {isOwner ? 'Owner' : 'Member'}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Members card ── */}
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 16, overflow: 'hidden',
              boxShadow: '0 2px 14px rgba(0,0,0,0.04)',
            }}>
              <div style={{ padding: '16px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(180deg,var(--bg-base) 0%,transparent 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,rgba(14,165,233,0.18),rgba(2,132,199,0.12))', border: '1px solid rgba(14,165,233,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={13} color="#0ea5e9" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Team Members</div>
                    <div style={{ fontSize: 11, color: 'var(--text-body-dim)', marginTop: 2 }}>People who can access this team</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(14,165,233,0.12)', color: 'var(--accent-hover)', border: '1px solid rgba(14,165,233,0.25)', borderRadius: 20, padding: '3px 10px' }}>{members.length}</span>
              </div>
              {members.map((m, i) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 22px',
                  borderBottom: i < members.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  transition: 'background 0.12s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-base)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                      background: m.role === 'owner' ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#0ea5e9,#0284c7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: m.role === 'owner' ? '0 3px 12px rgba(245,158,11,0.38)' : '0 3px 12px rgba(14,165,233,0.32)',
                      position: 'relative',
                    }}>
                      {m.role === 'owner'
                        ? <Crown size={17} color="white" />
                        : <span style={{ fontSize: 15, fontWeight: 800, color: 'white' }}>{(m.email || '?')[0].toUpperCase()}</span>}
                      {/* online dot */}
                      <div style={{ position: 'absolute', bottom: -1, right: -1, width: 11, height: 11, borderRadius: '50%', background: '#22c55e', border: '2.5px solid var(--bg-surface)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
                        {m.email || 'Unknown'}
                        {m.userId === currentUserId && (
                          <span style={{ fontSize: 10, color: 'var(--accent-hover)', background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.30)', borderRadius: 20, padding: '1px 7px', fontWeight: 700, letterSpacing: '0.03em' }}>YOU</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-body-dim)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                        {m.role === 'owner'
                          ? <><Shield size={10} color="#d97706" /> <span style={{ color: '#d97706', fontWeight: 600 }}>Owner</span> · Full access</>
                          : <><Users size={10} /> <span style={{ fontWeight: 600 }}>Member</span> · Can view & test</>}
                      </div>
                    </div>
                  </div>
                  {isOwner && m.userId !== currentUserId && (
                    <button onClick={() => handleRemoveMember(m.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
                        borderRadius: 8, border: '1px solid transparent', background: 'transparent',
                        color: 'var(--text-body-dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.13s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.30)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-body-dim)'; e.currentTarget.style.borderColor = 'transparent' }}>
                      <Trash2 size={12} /> Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* ── Invite card ── */}
            {isOwner && (
              <div style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 2px 14px rgba(0,0,0,0.04)',
              }}>
                <div style={{ padding: '16px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(180deg,var(--bg-base) 0%,transparent 100%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,rgba(34,197,94,0.18),rgba(16,185,129,0.12))', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserPlus size={13} color="#16a34a" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Invite Members</div>
                      <div style={{ fontSize: 11, color: 'var(--text-body-dim)', marginTop: 2 }}>Send an invitation email to join this team</div>
                    </div>
                  </div>
                  {invites.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.14)', color: '#d97706', border: '1px solid rgba(245,158,11,0.30)', borderRadius: 20, padding: '3px 10px' }}>
                      {invites.length} pending
                    </span>
                  )}
                </div>
                <div style={{ padding: '18px 22px' }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Mail size={14} color="var(--text-body-dim)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      <input ref={inviteInputRef} type="email" value={inviteEmail}
                        onChange={e => { setInviteEmail(e.target.value); setInviteError('') }}
                        onKeyDown={e => { if (e.key === 'Enter') handleInvite() }}
                        placeholder="colleague@example.com"
                        style={{
                          width: '100%', padding: '12px 14px 12px 38px', borderRadius: 10, fontSize: 13.5,
                          background: 'var(--bg-base)', border: '1.5px solid var(--border)',
                          color: 'var(--text-primary)', outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#0ea5e9'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12)' }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
                      />
                    </div>
                    <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                      style={{
                        padding: '12px 22px', borderRadius: 10,
                        background: inviteSuccess ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#0ea5e9,#0284c7)',
                        border: 'none', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        opacity: inviting || !inviteEmail.trim() ? 0.5 : 1, flexShrink: 0, transition: 'all 0.2s',
                        boxShadow: inviteSuccess ? '0 4px 14px rgba(34,197,94,0.35)' : '0 4px 14px rgba(14,165,233,0.30)',
                        display: 'flex', alignItems: 'center', gap: 7,
                      }}>
                      {inviteSuccess ? <><Check size={14} /> Sent!</> : inviting ? 'Sending…' : <><UserPlus size={14} /> Send Invite</>}
                    </button>
                  </div>
                  {inviteError && (
                    <div style={{ color: '#f87171', fontSize: 12, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 8 }}>
                      <X size={12} />{inviteError}
                    </div>
                  )}
                </div>

                {/* Pending invites */}
                {invites.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 22px 18px', background: 'var(--bg-base)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-body-dim)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Mail size={10} /> Pending Invitations
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {invites.map(inv => (
                        <div key={inv.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 12px', borderRadius: 10,
                          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                          transition: 'all 0.12s',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,rgba(245,158,11,0.18),rgba(217,119,6,0.10))', border: '1px solid rgba(245,158,11,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Mail size={13} color="#d97706" />
                            </div>
                            <div style={{ minWidth: 0, overflow: 'hidden' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.invitedEmail}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-body-dim)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                                Awaiting response
                              </div>
                            </div>
                          </div>
                          <button onClick={() => handleCancelInvite(inv.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid transparent', cursor: 'pointer', color: 'var(--text-body-dim)', fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 7, transition: 'all 0.12s', flexShrink: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.28)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-body-dim)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}>
                            <X size={11} /> Cancel
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Danger zone ── */}
            {isOwner && (
              <div style={{
                background: 'linear-gradient(135deg,rgba(239,68,68,0.05) 0%,rgba(239,68,68,0.02) 100%)',
                border: '1px solid rgba(239,68,68,0.22)',
                borderRadius: 16, padding: '16px 20px',
                boxShadow: '0 2px 12px rgba(239,68,68,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Trash2 size={16} color="#ef4444" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        Danger Zone
                        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 4, padding: '1px 6px' }}>Irreversible</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-body-dim)', lineHeight: 1.5 }}>Permanently delete this team, remove all members, and revoke access. This cannot be undone.</div>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteTeam(activeTeam)} disabled={deletingTeam}
                    style={{
                      padding: '9px 16px', borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                      border: '1px solid rgba(239,68,68,0.55)',
                      color: 'white', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                      opacity: deletingTeam ? 0.6 : 1,
                      boxShadow: '0 3px 12px rgba(239,68,68,0.28)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 5px 16px rgba(239,68,68,0.42)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 3px 12px rgba(239,68,68,0.28)' }}>
                    <Trash2 size={13} /> {deletingTeam ? 'Deleting…' : 'Delete Team'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Context menu (team right-click) ── */}
      {ctxMenu && typeof window !== 'undefined' && createPortal(
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999,
            background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
            borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            minWidth: 176, overflow: 'hidden', padding: '4px 0',
          }}>
          <div style={{ padding: '8px 14px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-body-dim)' }}>Team</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{ctxMenu.team.name}</div>
          </div>
          <button
            onMouseDown={() => { setCtxMenu(null); setEditName(ctxMenu.team.name); setEditingName(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-body)', fontSize: 13, transition: 'background 0.12s', textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <Pencil size={13} color="var(--text-body-dim)" /> Rename team
          </button>
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />
          <button
            onMouseDown={() => { setCtxMenu(null); handleDeleteTeam(ctxMenu.team) }}
            style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 13, transition: 'background 0.12s', textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.10)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <Trash2 size={13} color="#f87171" /> Delete team
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}

'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import {
  getProjects, getPlans, getFolders, saveFolder, deleteFolder, updateFolder,
  getScripts, saveScript, deleteScript, duplicateScript, duplicateFolder,
  getTestRuns, getRows, getResults, computeStats, sumStats, peekCache,
  type Project, type TestPlan, type Folder, type Script, type TestRun, type TestRow, type TestResult, type Stats
} from '@/lib/db'

function zeroStats(): Stats { return { pass:0, fail:0, blocked:0, query:0, exclude:0, done:0, total:0, pct:0 } }
import { Home, ChevronDown, ChevronRight, Plus, FolderOpen, FileText } from 'lucide-react'

const C = { pass:'#22c55e', fail:'#ef4444', blocked:'#f59e0b', query:'#a78bfa' }

function MiniBar({ pass,fail,blocked,query,total }: { pass:number; fail:number; blocked:number; query:number; total:number }) {
  if (!total) return <div style={{ width:120, height:5, background:'var(--border-track)', borderRadius:3 }} />
  const rest = total - pass - fail - blocked - query
  return (
    <div style={{ width:120, height:5, borderRadius:3, overflow:'hidden', display:'flex' }}>
      {pass>0    && <div style={{ flex:pass,    background:C.pass }} />}
      {fail>0    && <div style={{ flex:fail,    background:C.fail }} />}
      {blocked>0 && <div style={{ flex:blocked, background:C.blocked }} />}
      {query>0   && <div style={{ flex:query,   background:C.query }} />}
      {rest>0    && <div style={{ flex:rest,    background:'var(--border-track)' }} />}
    </div>
  )
}

function StatBlock({ pass, fail, blocked, query, done, total, pct }:
  { pass:number; fail:number; blocked:number; query:number; done:number; total:number; pct:number }) {
  const items = [
    { label:'Pass',    value:pass,    color:C.pass    },
    { label:'Fail',    value:fail,    color:C.fail    },
    { label:'Blocked', value:blocked, color:C.blocked },
    { label:'Query',   value:query,   color:C.query   },
  ]
  return (
    <div style={{ display:'flex', alignItems:'center', height:'100%', flexShrink:0 }} onClick={e=>e.stopPropagation()}>
      {items.map((s, i) => (
        <div key={s.label} style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
          {i > 0 && (
            <div style={{ width:1, height:28, background:'var(--border-strong)', margin:'0 12px', flexShrink:0 }} />
          )}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:42 }}>
            <span style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-muted)', lineHeight:1, marginBottom:3 }}>{s.label}</span>
            <span style={{ fontSize:15, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</span>
          </div>
        </div>
      ))}
      <div style={{ margin:'0 14px 0 14px', flexShrink:0 }}>
        <MiniBar pass={pass} fail={fail} blocked={blocked} query={query} total={total} />
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0, minWidth:52 }}>
        <span style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-muted)', lineHeight:1, marginBottom:3 }}>Done</span>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', lineHeight:1 }}>{done}/{total} <span style={{ fontSize:11, fontWeight:500, color:'var(--text-secondary)' }}>{pct}%</span></span>
      </div>
    </div>
  )
}

// Simple toast
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  const duration = msg.endsWith('…') ? 60_000 : 2400 // keep "working" toasts until replaced
  useEffect(() => { const t = setTimeout(onDone, duration); return () => clearTimeout(t) }, [onDone, duration])
  return createPortal(
    <div style={{
      position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
      background:'#1e2235', border:'1px solid rgba(255,255,255,0.12)',
      borderRadius:10, padding:'10px 20px', fontSize:13, fontWeight:500,
      color:'rgba(255,255,255,0.85)', zIndex:99999,
      boxShadow:'0 4px 24px rgba(0,0,0,0.45)',
      pointerEvents:'none', whiteSpace:'nowrap',
    }}>{msg}</div>,
    document.body
  )
}

export default function PlanPage() {
  const { id, planId } = useParams<{ id: string; planId: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [plan, setPlan] = useState<TestPlan | null>(null)
  const [folders, setFolders] = useState<Folder[]>(() => peekCache<Folder[]>(`folders:${planId}`) ?? [])
  const [scripts, setScripts] = useState<Script[]>(() => peekCache<Script[]>(`scripts:${planId}`) ?? [])
  const [runs, setRuns] = useState<TestRun[]>(() => peekCache<TestRun[]>(`runs:${planId}`) ?? [])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [folderStats, setFolderStats] = useState<Record<string, { pass:number; fail:number; blocked:number; query:number; done:number; total:number; pct:number }>>({})
  const [scriptStats, setScriptStats] = useState<Record<string, { pass:number; fail:number; blocked:number; query:number; done:number; total:number; pct:number }>>({})
  const [planStats, setPlanStats] = useState<{ pass:number; fail:number; blocked:number; query:number; done:number; total:number; pct:number } | null>(null)

  // context menus
  const [folderMenu, setFolderMenu] = useState<{ x:number; y:number; folderId:string } | null>(null)
  const [scriptMenu, setScriptMenu] = useState<{ x:number; y:number; scriptId:string } | null>(null)
  const [folderDropdown, setFolderDropdown] = useState(false)
  const [scriptDropdown, setScriptDropdown] = useState(false)

  // inline editing
  const [editingFolderId, setEditingFolderId] = useState<string|null>(null)
  const [editFolderName, setEditFolderName] = useState('')
  const [addingScriptInFolder, setAddingScriptInFolder] = useState<string|null>(null)
  const [newScriptName, setNewScriptName] = useState('')
  const [addingFolder, setAddingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const folderDDRef = useRef<HTMLDivElement>(null)
  const scriptDDRef = useRef<HTMLDivElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const folderMenuRef = useRef<HTMLDivElement>(null)
  const scriptMenuRef = useRef<HTMLDivElement>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
  }, [])

  // Guard against concurrent reload calls (e.g. from notify() + explicit reload)
  const reloadingRef = useRef(false)

  // Lightweight post-duplication refresh — uses cached rows, no row re-fetching
  // Called instead of full reload() after duplicateScript / duplicateFolder
  const refreshAfterDuplicate = useCallback(async (currentScriptStats: Record<string, Stats>, currentRuns: TestRun[]) => {
    const [newFolders, newScripts] = await Promise.all([getFolders(planId), getScripts(planId)])
    setFolders(newFolders)
    setScripts(newScripts)

    const newSStats: Record<string, Stats> = {}
    for (const sc of newScripts) {
      if (currentScriptStats[sc.id]) {
        // Existing script — keep its already-computed stats
        newSStats[sc.id] = currentScriptStats[sc.id]
      } else {
        // New script — rows are pre-populated in cache by _dupScript; no results yet
        const cachedRows = peekCache<TestRow[]>(`rows:${sc.id}`) ?? []
        const caseRowsSc = cachedRows.filter(rw => rw.type === 'case')
        if (currentRuns.length === 0) {
          newSStats[sc.id] = { ...zeroStats(), total: caseRowsSc.length }
        } else {
          newSStats[sc.id] = sumStats(currentRuns.map(() => computeStats(caseRowsSc, [])))
        }
      }
    }

    const fStats: Record<string, Stats> = {}
    for (const folder of newFolders) {
      const fs = newScripts.filter(sc => sc.folderId === folder.id)
      fStats[folder.id] = sumStats(fs.map(sc => newSStats[sc.id] ?? zeroStats()))
    }

    setScriptStats(newSStats)
    setFolderStats(fStats)
    setPlanStats(Object.keys(fStats).length > 0 ? sumStats(Object.values(fStats)) : null)
  }, [planId])

  const reload = useCallback(async () => {
    if (reloadingRef.current) return   // skip if already reloading
    reloadingRef.current = true
    try {
    const [f, s, r] = await Promise.all([getFolders(planId), getScripts(planId), getTestRuns(planId)])
    setFolders(f); setScripts(s); setRuns(r)

    if (r.length === 0) {
      setFolderStats({}); setScriptStats({}); setPlanStats(null)
      return
    }

    // Fetch all rows + all results in parallel — two batches instead of N*M sequential queries
    const [allRowsList, allResultsList] = await Promise.all([
      Promise.all(s.map(sc => getRows(sc.id))),
      Promise.all(r.map(run => getResults(run.id))),
    ])
    const scriptRowsMap: Record<string, TestRow[]> = {}
    s.forEach((sc, i) => { scriptRowsMap[sc.id] = allRowsList[i] })
    const runResultsMap: Record<string, TestResult[]> = {}
    r.forEach((run, i) => { runResultsMap[run.id] = allResultsList[i] })

    // Compute all script stats locally — zero extra queries
    const sStats: Record<string, Stats> = {}
    for (const sc of s) {
      const caseRowsSc = scriptRowsMap[sc.id].filter(rw => rw.type === 'case')
      sStats[sc.id] = sumStats(r.map(run => computeStats(caseRowsSc, runResultsMap[run.id])))
    }

    // Compute folder stats by summing their scripts — zero extra queries
    const fStats: Record<string, Stats> = {}
    for (const folder of f) {
      const folderScripts = s.filter(sc => sc.folderId === folder.id)
      fStats[folder.id] = sumStats(folderScripts.map(sc => sStats[sc.id] ?? zeroStats()))
    }

    setScriptStats(sStats); setFolderStats(fStats)
    setPlanStats(sumStats(Object.values(fStats)))
    } finally { reloadingRef.current = false }
  }, [planId])

  useEffect(() => {
    async function load() {
      // Fire all 5 fetches in parallel — projects/plans/folders/scripts/runs in one batch
      const [projects, plans] = await Promise.all([
        getProjects(), getPlans(id),
        reload(), // data load runs in parallel with the project check
      ])
      const proj = projects.find(p => p.id === id)
      const pl = plans.find(p => p.id === planId)
      if (!proj || !pl) { router.push('/projects'); return }
      setProject(proj); setPlan(pl)
    }
    load()
  }, [id, planId, reload])

  useEffect(() => {
    const handler = () => { reload() }
    window.addEventListener('qaflow:change', handler)
    return () => window.removeEventListener('qaflow:change', handler)
  }, [reload])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (folderMenuRef.current && !folderMenuRef.current.contains(t)) setFolderMenu(null)
      if (scriptMenuRef.current && !scriptMenuRef.current.contains(t)) setScriptMenu(null)
      if (folderDDRef.current && !folderDDRef.current.contains(t)) setFolderDropdown(false)
      if (scriptDDRef.current && !scriptDDRef.current.contains(t)) setScriptDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const ctxPos = (e: React.MouseEvent, menuW = 220, menuH = 180) => ({
    x: Math.min(e.clientX, window.innerWidth  - menuW - 8),
    y: Math.min(e.clientY, window.innerHeight - menuH - 8),
  })

  const handleFolderCtx = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault(); e.stopPropagation()
    const { x, y } = ctxPos(e, 220, 140)
    setFolderMenu({ x, y, folderId }); setScriptMenu(null)
  }
  const handleScriptCtx = (e: React.MouseEvent, scriptId: string) => {
    e.preventDefault(); e.stopPropagation()
    const { x, y } = ctxPos(e, 220, 120)
    setScriptMenu({ x, y, scriptId }); setFolderMenu(null)
  }

  const handleAddScript = (folderId: string) => {
    setAddingScriptInFolder(folderId)
    setFolderMenu(null)
    if (collapsed.has(folderId)) setCollapsed(prev => { const n=new Set(prev); n.delete(folderId); return n })
  }

  const handleSaveScript = async (e: React.FormEvent, folderId: string) => {
    e.preventDefault()
    if (!newScriptName.trim()) { setAddingScriptInFolder(null); return }
    await saveScript(planId, folderId, newScriptName.trim(), '', scripts.length)
    setNewScriptName(''); setAddingScriptInFolder(null); reload()
  }

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) { setAddingFolder(false); return }
    await saveFolder(planId, newFolderName.trim(), folders.length)
    setNewFolderName(''); setAddingFolder(false); reload()
  }

  const hasFolders = folders.length > 0

  // planStats is now computed in reload() as state

  return (
    <div style={{ width: '100%' }}>

      {/* Toast */}
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      {/* ── Top action bar ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:8, marginBottom:20,
        padding:'10px 14px',
        background:'var(--bg-surface)',
        borderRadius:12,
        border:'1px solid var(--border-strong)',
        boxShadow:'var(--shadow-sm)',
      }}>
        {/* Back to project */}
        <button onClick={() => router.push('/projects')}
          style={{
            background:'var(--bg-elevated)', border:'1px solid var(--border-strong)',
            borderRadius:8, padding:'6px 9px', cursor:'pointer',
            display:'flex', alignItems:'center', transition:'all 0.14s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background='var(--bg-hover)'; e.currentTarget.style.borderColor='var(--border-accent)' }}
          onMouseLeave={e => { e.currentTarget.style.background='var(--bg-elevated)'; e.currentTarget.style.borderColor='var(--border-strong)' }}>
          <Home size={14} color="var(--text-secondary)" />
        </button>

        {/* Overall stats pill (all runs combined) */}
        {runs.length > 0 && planStats && (
          <div style={{
            display:'flex', alignItems:'center', gap:0,
            padding:'6px 16px',
            background:'var(--bg-elevated)',
            border:'1px solid var(--border)',
            borderRadius:8,
            boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}>
            <StatBlock pass={planStats.pass} fail={planStats.fail} blocked={planStats.blocked} query={planStats.query} done={planStats.done} total={planStats.total} pct={planStats.pct} />
          </div>
        )}

        <div style={{ flex:1 }} />
        <span style={{ fontSize:13.5, fontWeight:600, color:'var(--text-secondary)', marginRight:4 }}>{plan?.name}</span>

        {/* Script button — disabled if no folders */}
        <div ref={scriptDDRef} style={{ position:'relative' }}>
          <button
            onClick={() => {
              if (!hasFolders) { showToast('Create a folder first before adding scripts'); return }
              setScriptDropdown(v => !v)
            }}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'7px 14px',
              background: hasFolders ? 'var(--bg-elevated)' : 'var(--bg-depth)',
              border:'1px solid var(--border-strong)',
              borderRadius:9, fontSize:13, color:'var(--text-body)',
              cursor: hasFolders ? 'pointer' : 'not-allowed',
              fontWeight:500, transition:'all 0.14s',
              opacity: hasFolders ? 1 : 0.5,
            }}
            onMouseEnter={e => { if (hasFolders) e.currentTarget.style.background='var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = hasFolders ? 'var(--bg-elevated)' : 'var(--bg-depth)' }}>
            <Plus size={13} color="var(--text-secondary)" /> Script <ChevronDown size={12} />
          </button>
          {scriptDropdown && (
            <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:11, padding:'6px 0', minWidth:190, zIndex:9999, boxShadow:'var(--shadow-md)' }}>
              <CtxItem label="+ New script" onClick={() => { const f = folders[0]; if (f) { handleAddScript(f.id) } setScriptDropdown(false) }} />
            </div>
          )}
        </div>

        {/* Folder button — disabled while name input is open */}
        <div ref={folderDDRef} style={{ position:'relative' }}>
          <button
            onClick={() => {
              if (addingFolder) { showToast('Finish naming the current folder first'); return }
              setFolderDropdown(v => !v)
            }}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'7px 16px',
              background: addingFolder ? 'var(--bg-depth)' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              border: addingFolder ? '1px solid var(--border-strong)' : 'none',
              borderRadius:9, fontSize:13, color: addingFolder ? 'var(--text-muted)' : 'white',
              cursor: addingFolder ? 'not-allowed' : 'pointer',
              fontWeight:600, transition:'all 0.15s',
              opacity: addingFolder ? 0.6 : 1,
              boxShadow: addingFolder ? 'none' : '0 3px 12px rgba(99,102,241,0.40)',
            }}
            onMouseEnter={e => { if (!addingFolder) { e.currentTarget.style.boxShadow='0 4px 18px rgba(99,102,241,0.60)'; e.currentTarget.style.transform='translateY(-1px)' } }}
            onMouseLeave={e => { if (!addingFolder) { e.currentTarget.style.boxShadow='0 3px 12px rgba(99,102,241,0.40)'; e.currentTarget.style.transform='none' } }}>
            <FolderOpen size={13} color={addingFolder ? 'var(--text-muted)' : 'rgba(255,255,255,0.9)'} /> Folder <ChevronDown size={12} />
          </button>
          {folderDropdown && !addingFolder && (
            <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:11, padding:'6px 0', minWidth:190, zIndex:9999, boxShadow:'var(--shadow-md)' }}>
              <CtxItem label="+ New folder" onClick={() => { setAddingFolder(true); setFolderDropdown(false); setTimeout(() => folderInputRef.current?.focus(), 30) }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Inline new-folder form ── */}
      {addingFolder && (
        <form onSubmit={handleAddFolder}
          style={{ display:'flex', gap:8, marginBottom:12 }}>
          <input ref={folderInputRef} autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setAddingFolder(false); setNewFolderName('') } }}
            placeholder="Folder name (e.g. V.1.17.0)"
            style={{ flex:1, padding:'8px 12px', background:'var(--bg-elevated)', border:'1px solid var(--accent)', borderRadius:8, fontSize:13, color:'var(--text-primary)', outline:'none' }} />
          <button type="submit" disabled={!newFolderName.trim()} style={{ ...btnSm, opacity: newFolderName.trim() ? 1 : 0.55, cursor: newFolderName.trim() ? 'pointer' : 'not-allowed' }}>Create</button>
          <button type="button" onClick={() => { setAddingFolder(false); setNewFolderName('') }} style={btnGSm}>Cancel</button>
        </form>
      )}

      {/* ── Empty state ── */}
      {folders.length === 0 && !addingFolder && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-muted)', fontSize:13, border:'1px dashed var(--border)', borderRadius:10 }}>
          No folders yet — click <strong style={{ color:'var(--text-secondary)' }}>Folder</strong> above to create your first one
        </div>
      )}

      {/* ── Folders ── */}
      {folders.map(folder => {
        const folderScripts = scripts.filter(s => s.folderId === folder.id)
        const isCollapsed = collapsed.has(folder.id)
        const folderSt = folderStats[folder.id] ?? { pass:0, fail:0, blocked:0, query:0, done:0, total:0, pct:0 }
        const isFolderDuplicating = folder.id.startsWith('dup_f_')

        return (
          <div key={folder.id} style={{ marginBottom:14, opacity: isFolderDuplicating ? 0.6 : 1 }}>
            {/* Folder header */}
            <div
              onContextMenu={e => { if (!isFolderDuplicating) handleFolderCtx(e, folder.id) }}
              style={{
                display:'flex', alignItems:'center', gap:10, padding:'12px 18px',
                background:'linear-gradient(90deg, var(--bg-elevated) 0%, var(--bg-depth) 100%)',
                border:'1px solid var(--border-strong)',
                borderRadius: isCollapsed ? 11 : '11px 11px 0 0',
                cursor: isFolderDuplicating ? 'wait' : 'pointer', userSelect:'none',
                boxShadow:'inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
              onClick={() => { if (!isFolderDuplicating) setCollapsed(prev => { const n=new Set(prev); n.has(folder.id)?n.delete(folder.id):n.add(folder.id); return n }) }}>
              <span style={{ fontSize:12, color:'var(--text-secondary)', flexShrink:0 }}>{isCollapsed ? '▶' : '▼'}</span>
              <FolderOpen size={15} color="var(--text-body-dim)" style={{ flexShrink:0 }} />
              {editingFolderId === folder.id ? (
                <input autoFocus value={editFolderName}
                  onChange={e => setEditFolderName(e.target.value)}
                  onBlur={() => { if (editFolderName.trim()) { setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, name: editFolderName.trim() } : f)); updateFolder(planId, folder.id, editFolderName.trim()).catch(console.error) } setEditingFolderId(null) }}
                  onKeyDown={e => { if (e.key==='Enter') { if (editFolderName.trim()) { setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, name: editFolderName.trim() } : f)); updateFolder(planId, folder.id, editFolderName.trim()).catch(console.error) } setEditingFolderId(null) } if (e.key==='Escape') setEditingFolderId(null) }}
                  onClick={e => e.stopPropagation()}
                  style={{ background:'var(--bg-surface)', border:'1px solid var(--accent)', borderRadius:5, padding:'2px 7px', fontSize:13, fontWeight:600, color:'var(--text-primary)', outline:'none' }} />
              ) : (
                <span style={{ fontSize:14.5, fontWeight:700, color:'var(--text-primary)', flex:1, letterSpacing:'-0.2px' }}>{folder.name}</span>
              )}

              {/* All-runs stats for folder */}
              {runs.length > 0 && (
                <StatBlock pass={folderSt.pass} fail={folderSt.fail} blocked={folderSt.blocked} query={folderSt.query} done={folderSt.done} total={folderSt.total} pct={folderSt.pct} />
              )}
            </div>

            {/* Scripts list */}
            {!isCollapsed && (
              <div style={{ border:'1px solid var(--border-strong)', borderTop:'none', borderRadius:'0 0 11px 11px', overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
                {folderScripts.map((script, idx) => {
                  const scriptSt = scriptStats[script.id] ?? { pass:0, fail:0, blocked:0, query:0, done:0, total:0, pct:0 }
                  const isDuplicating = script.id.startsWith('dup_')
                  return (
                    <div key={script.id}>
                      <div
                        onContextMenu={e => { if (!isDuplicating) handleScriptCtx(e, script.id) }}
                        onClick={() => { if (!isDuplicating) router.push(`/projects/${id}/plan/${planId}/script/${script.id}`) }}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px 11px 46px', background:'var(--bg-surface)', borderBottom: idx < folderScripts.length-1 || addingScriptInFolder===folder.id ? '1px solid var(--border)' : 'none', cursor: isDuplicating ? 'wait' : 'pointer', transition:'background 0.1s', opacity: isDuplicating ? 0.55 : 1 }}
                        onMouseEnter={e => { if (!isDuplicating) e.currentTarget.style.background='var(--bg-hover)' }}
                        onMouseLeave={e => (e.currentTarget.style.background='var(--bg-surface)')}
                      >
                        {isDuplicating
                          ? <span style={{ fontSize:12, animation:'spin 1s linear infinite', display:'inline-block', flexShrink:0 }}>⟳</span>
                          : <FileText size={14} color="var(--text-secondary)" strokeWidth={1.5} style={{ flexShrink:0 }} />
                        }
                        <span style={{ fontSize:14, color: isDuplicating ? 'var(--text-muted)' : 'var(--text-body)', fontWeight:500, flex:1, transition:'color 0.1s', fontStyle: isDuplicating ? 'italic' : 'normal' }}
                          onMouseEnter={e => { if (!isDuplicating) e.currentTarget.style.color = 'var(--text-primary)' }}
                          onMouseLeave={e => { if (!isDuplicating) e.currentTarget.style.color = 'var(--text-body)' }}>
                          {script.name}{isDuplicating ? '' : ''}
                        </span>

                        {/* All-runs stats for script */}
                        {runs.length > 0 && !isDuplicating && (
                          <StatBlock pass={scriptSt.pass} fail={scriptSt.fail} blocked={scriptSt.blocked} query={scriptSt.query} done={scriptSt.done} total={scriptSt.total} pct={scriptSt.pct} />
                        )}
                        {isDuplicating && <span style={{ fontSize:11, color:'var(--text-muted)', flexShrink:0 }}>copying…</span>}
                      </div>
                    </div>
                  )
                })}

                {/* Add script inline form */}
                {addingScriptInFolder === folder.id && (
                  <form onSubmit={e => handleSaveScript(e, folder.id)}
                    style={{ padding:'8px 14px 8px 60px', background:'var(--bg-elevated)', display:'flex', gap:8 }}>
                    <input autoFocus value={newScriptName} onChange={e => setNewScriptName(e.target.value)}
                      onKeyDown={e => { if (e.key==='Escape') { setAddingScriptInFolder(null); setNewScriptName('') } }}
                      placeholder="Script name (e.g. Feature Tests)..."
                      style={{ flex:1, padding:'6px 10px', background:'var(--bg-surface)', border:'1px solid var(--accent)', borderRadius:7, fontSize:13, color:'var(--text-primary)', outline:'none' }} />
                    <button type="submit" disabled={!newScriptName.trim()} style={{ ...btnSm, opacity: newScriptName.trim() ? 1 : 0.55, cursor: newScriptName.trim() ? 'pointer' : 'not-allowed' }}>Add</button>
                    <button type="button" onClick={() => { setAddingScriptInFolder(null); setNewScriptName('') }} style={btnGSm}>Cancel</button>
                  </form>
                )}

                {addingScriptInFolder !== folder.id && (
                  <button onClick={() => handleAddScript(folder.id)}
                    style={{ width:'100%', padding:'9px 16px 9px 64px', background:'none', border:'none', textAlign:'left', fontSize:13, color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
                    onMouseEnter={e => { e.currentTarget.style.color='var(--accent)'; e.currentTarget.style.background='rgba(99,102,241,0.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.background='none' }}>
                    <Plus size={11} /> new script
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Right-click context menus ── */}
      {folderMenu && createPortal(
        <div ref={folderMenuRef} style={{ position:'fixed', left:folderMenu.x, top:folderMenu.y, background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:10, padding:'6px 0', minWidth:200, zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)' }}>
          <CtxItem label="+ new script" onClick={() => { handleAddScript(folderMenu.folderId); setFolderMenu(null) }} />
          <CtxItem label="Edit name" onClick={() => { setEditingFolderId(folderMenu.folderId); setEditFolderName(folders.find(f=>f.id===folderMenu.folderId)?.name||''); setFolderMenu(null) }} />
          <CtxItem label="Duplicate folder" onClick={async () => {
            const srcFolder = folders.find(f => f.id === folderMenu.folderId)
            setFolderMenu(null)
            if (!srcFolder) return
            // Optimistic: show folder + its scripts immediately
            const placeholderFolderId = 'dup_f_' + Date.now()
            const folderScriptsCopy = scripts
              .filter(s => s.folderId === folderMenu.folderId)
              .map((s, i) => ({ ...s, id: 'dup_s_' + i + '_' + Date.now(), folderId: placeholderFolderId }))
            setFolders(prev => [...prev, { ...srcFolder, id: placeholderFolderId, name: srcFolder.name + ' (Copy)', order: prev.length }])
            setScripts(prev => [...prev, ...folderScriptsCopy])
            // Capture current stats BEFORE the async op (closure would be stale otherwise)
            const snapStats = scriptStats
            const snapRuns = runs
            showToast('Duplicating folder…')
            try {
              await duplicateFolder(planId, folderMenu.folderId)
              // Lightweight refresh — uses cached rows, no full row re-fetch
              await refreshAfterDuplicate(snapStats, snapRuns)
              showToast('Folder duplicated ✓')
            } catch (err) {
              console.error('Folder dup failed:', err)
              setFolders(prev => prev.filter(f => f.id !== placeholderFolderId))
              setScripts(prev => prev.filter(s => !s.id.startsWith('dup_s_')))
              showToast('Duplication failed ✗')
            }
          }} />
          <div style={{ height:1, background:'var(--border)', margin:'5px 0' }} />
          <CtxItem label="Delete folder" danger onClick={async () => { if (confirm('Delete this folder and all scripts inside?')) { await deleteFolder(planId, folderMenu.folderId); reload() } setFolderMenu(null) }} />
        </div>,
        document.body
      )}

      {scriptMenu && createPortal(
        <div ref={scriptMenuRef} style={{ position:'fixed', left:scriptMenu.x, top:scriptMenu.y, background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:10, padding:'6px 0', minWidth:200, zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)' }}>
          <CtxItem label="Open script" onClick={() => { const s=scripts.find(x=>x.id===scriptMenu.scriptId); if(s) router.push(`/projects/${id}/plan/${planId}/script/${s.id}`); setScriptMenu(null) }} />
          <CtxItem label="Duplicate script" onClick={async () => {
            const src = scripts.find(s => s.id === scriptMenu.scriptId)
            setScriptMenu(null)
            if (!src) return
            // Optimistic: show placeholder immediately so UI feels instant
            const placeholderId = 'dup_' + Date.now()
            setScripts(prev => [...prev, { ...src, id: placeholderId, name: src.name + ' (Copy)', order: prev.length }])
            // Capture current stats BEFORE the async op
            const snapStats = scriptStats
            const snapRuns = runs
            showToast('Duplicating script…')
            try {
              await duplicateScript(planId, scriptMenu.scriptId)
              // Lightweight refresh — uses cached rows, skips full row re-fetch
              await refreshAfterDuplicate(snapStats, snapRuns)
              showToast('Script duplicated ✓')
            } catch (err) {
              console.error('Script dup failed:', err)
              setScripts(prev => prev.filter(s => s.id !== placeholderId))
              showToast('Duplication failed ✗')
            }
          }} />
          <div style={{ height:1, background:'var(--border)', margin:'5px 0' }} />
          <CtxItem label="Delete script" danger onClick={async () => { if (confirm('Delete this script?')) { await deleteScript(planId, scriptMenu.scriptId); reload() } setScriptMenu(null) }} />
        </div>,
        document.body
      )}

    </div>
  )
}

function CtxItem({ label, onClick, danger }: { label:string; onClick:()=>void; danger?:boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onMouseDown={e => e.stopPropagation()}
      onClick={onClick}
      style={{
        padding:'9px 18px', fontSize:13.5, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap',
        color: danger ? (hov ? '#fff' : '#ef4444') : 'var(--text-primary)',
        background: hov ? (danger ? '#ef4444' : 'var(--bg-elevated)') : 'transparent',
        transition:'all 0.1s',
      }}>
      {label}
    </div>
  )
}

const btnSm: React.CSSProperties = { display:'inline-flex',alignItems:'center',gap:4,padding:'7px 16px',background:'var(--accent)',color:'white',border:'none',borderRadius:7,fontSize:13,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap' }
const btnGSm: React.CSSProperties = { ...btnSm, background:'transparent',color:'var(--text-secondary)',border:'1px solid var(--border-strong)' }

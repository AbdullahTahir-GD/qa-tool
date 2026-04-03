'use client'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import {
  getProjects, getPlans, getFolders, saveFolder, deleteFolder, updateFolder,
  getScripts, saveScript, deleteScript, duplicateScript, duplicateFolder, getTestRuns,
  getFolderStats, getScriptStats,
  type Project, type TestPlan, type Folder, type Script, type TestRun
} from '@/lib/store'
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

/* Premium stat block — each stat stacked vertically: label on top, count below */
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
      {/* Progress bar */}
      <div style={{ margin:'0 14px 0 14px', flexShrink:0 }}>
        <MiniBar pass={pass} fail={fail} blocked={blocked} query={query} total={total} />
      </div>
      {/* Total */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0, minWidth:52 }}>
        <span style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-muted)', lineHeight:1, marginBottom:3 }}>Done</span>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', lineHeight:1 }}>{done}/{total} <span style={{ fontSize:11, fontWeight:500, color:'var(--text-secondary)' }}>{pct}%</span></span>
      </div>
    </div>
  )
}

export default function PlanPage() {
  const { id, planId } = useParams<{ id: string; planId: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [plan, setPlan] = useState<TestPlan | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [scripts, setScripts] = useState<Script[]>([])
  const [runs, setRuns] = useState<TestRun[]>([])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [expandedScripts, setExpandedScripts] = useState<Set<string>>(new Set())

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

  const reload = useCallback(() => {
    setFolders(getFolders(planId))
    setScripts(getScripts(planId))
    setRuns(getTestRuns(planId))
  }, [planId])

  useEffect(() => {
    const proj = getProjects().find(p => p.id === id)
    const pl = getPlans(id).find(p => p.id === planId)
    if (!proj || !pl) { router.push('/projects'); return }
    setProject(proj); setPlan(pl)
    reload()
  }, [id, planId, reload])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      // Only close context menus when clicking OUTSIDE them
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
    setFolderMenu({ x, y, folderId })
    setScriptMenu(null)
  }
  const handleScriptCtx = (e: React.MouseEvent, scriptId: string) => {
    e.preventDefault(); e.stopPropagation()
    const { x, y } = ctxPos(e, 220, 120)
    setScriptMenu({ x, y, scriptId })
    setFolderMenu(null)
  }

  const handleAddScript = (folderId: string) => {
    setAddingScriptInFolder(folderId)
    setFolderMenu(null)
    if (collapsed.has(folderId)) setCollapsed(prev => { const n=new Set(prev); n.delete(folderId); return n })
  }

  const handleSaveScript = (e: React.FormEvent, folderId: string) => {
    e.preventDefault()
    if (!newScriptName.trim()) { setAddingScriptInFolder(null); return }
    saveScript(planId, folderId, newScriptName.trim())
    setNewScriptName(''); setAddingScriptInFolder(null); reload()
  }

  const handleAddFolder = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) { setAddingFolder(false); return }
    saveFolder(planId, newFolderName.trim())
    setNewFolderName(''); setAddingFolder(false); reload()
  }

  const activeRun = runs.length > 0 ? runs[runs.length-1] : null

  const planStats = useMemo(() => {
    if (!activeRun) return null
    let pass=0,fail=0,blocked=0,query=0,done=0,total=0
    folders.forEach(f => { const st=getFolderStats(planId,f.id,activeRun.id); pass+=st.pass;fail+=st.fail;blocked+=st.blocked;query+=st.query;done+=st.done;total+=st.total })
    const pct = total>0?Math.round((pass/total)*100):0
    return {pass,fail,blocked,query,done,total,pct}
  }, [activeRun, folders, planId])

  return (
    <div style={{ width: '100%' }}>

      {/* ── Top action bar ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:8, marginBottom:20,
        padding:'10px 14px',
        background:'var(--bg-surface)',
        borderRadius:12,
        border:'1px solid var(--border-strong)',
        boxShadow:'var(--shadow-sm)',
      }}>
        {/* Home button */}
        <button onClick={() => router.push('/projects/'+id)}
          style={{
            background:'var(--bg-elevated)', border:'1px solid var(--border-strong)',
            borderRadius:8, padding:'6px 9px', cursor:'pointer',
            display:'flex', alignItems:'center', transition:'all 0.14s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background='var(--bg-hover)'; e.currentTarget.style.borderColor='var(--border-accent)' }}
          onMouseLeave={e => { e.currentTarget.style.background='var(--bg-elevated)'; e.currentTarget.style.borderColor='var(--border-strong)' }}>
          <Home size={14} color="var(--text-secondary)" />
        </button>

        {/* Stats pill */}
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

        {/* Script button */}
        <div ref={scriptDDRef} style={{ position:'relative' }}>
          <button onClick={() => setScriptDropdown(v=>!v)}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'7px 14px',
              background:'var(--bg-elevated)',
              border:'1px solid var(--border-strong)',
              borderRadius:9, fontSize:13, color:'var(--text-body)',
              cursor:'pointer', fontWeight:500, transition:'all 0.14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background='var(--bg-elevated)' }}>
            <Plus size={13} color="var(--text-secondary)" /> Script <ChevronDown size={12} />
          </button>
          {scriptDropdown && (
            <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:11, padding:'6px 0', minWidth:190, zIndex:9999, boxShadow:'var(--shadow-md)' }}>
              <CtxItem label="+ New script" onClick={() => { const f = folders[0]; if (f) { handleAddScript(f.id) } setScriptDropdown(false) }} />
            </div>
          )}
        </div>

        {/* Folder button */}
        <div ref={folderDDRef} style={{ position:'relative' }}>
          <button onClick={() => setFolderDropdown(v=>!v)}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'7px 16px',
              background:'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              border:'none',
              borderRadius:9, fontSize:13, color:'white',
              cursor:'pointer', fontWeight:600, transition:'all 0.15s',
              boxShadow:'0 3px 12px rgba(99,102,241,0.40)',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 18px rgba(99,102,241,0.60)'; e.currentTarget.style.transform='translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow='0 3px 12px rgba(99,102,241,0.40)'; e.currentTarget.style.transform='none' }}>
            <FolderOpen size={13} color="rgba(255,255,255,0.9)" /> Folder <ChevronDown size={12} />
          </button>
          {folderDropdown && (
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
          <button type="submit" style={btnSm}>Create</button>
          <button type="button" onClick={() => { setAddingFolder(false); setNewFolderName('') }} style={btnGSm}>Cancel</button>
        </form>
      )}

      {/* ── Folders ── */}
      {folders.length === 0 && !addingFolder && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-muted)', fontSize:13, border:'1px dashed var(--border)', borderRadius:10 }}>
          Click <strong style={{ color:'var(--text-secondary)' }}>folder → + new folder</strong> to create your first folder (e.g. V.1.17.0)
        </div>
      )}

      {folders.map(folder => {
        const folderScripts = scripts.filter(s => s.folderId === folder.id)
        const isCollapsed = collapsed.has(folder.id)

        return (
          <div key={folder.id} style={{ marginBottom:14 }}>
            {/* Folder header */}
            <div
              onContextMenu={e => handleFolderCtx(e, folder.id)}
              style={{
                display:'flex', alignItems:'center', gap:10, padding:'12px 18px',
                background:'linear-gradient(90deg, var(--bg-elevated) 0%, var(--bg-depth) 100%)',
                border:'1px solid var(--border-strong)',
                borderRadius: isCollapsed ? 11 : '11px 11px 0 0',
                cursor:'pointer', userSelect:'none',
                boxShadow:'inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
              onClick={() => setCollapsed(prev => { const n=new Set(prev); n.has(folder.id)?n.delete(folder.id):n.add(folder.id); return n })}>
              <span style={{ fontSize:12, color:'var(--text-secondary)', flexShrink:0 }}>{isCollapsed ? '▶' : '▼'}</span>
              <FolderOpen size={15} color="var(--text-body-dim)" style={{ flexShrink:0 }} />
              {editingFolderId === folder.id ? (
                <input autoFocus value={editFolderName}
                  onChange={e => setEditFolderName(e.target.value)}
                  onBlur={() => { if (editFolderName.trim()) updateFolder(planId, folder.id, editFolderName.trim()); setEditingFolderId(null); reload() }}
                  onKeyDown={e => { if (e.key==='Enter') { if (editFolderName.trim()) updateFolder(planId, folder.id, editFolderName.trim()); setEditingFolderId(null); reload() } if (e.key==='Escape') setEditingFolderId(null) }}
                  onClick={e => e.stopPropagation()}
                  style={{ background:'var(--bg-surface)', border:'1px solid var(--accent)', borderRadius:5, padding:'2px 7px', fontSize:13, fontWeight:600, color:'var(--text-primary)', outline:'none' }} />
              ) : (
                <span style={{ fontSize:14.5, fontWeight:700, color:'var(--text-primary)', flex:1, letterSpacing:'-0.2px' }}>{folder.name}</span>
              )}

              {/* Stats */}
              {activeRun && (() => {
                const st = getFolderStats(planId, folder.id, activeRun.id)
                return <StatBlock pass={st.pass} fail={st.fail} blocked={st.blocked} query={st.query} done={st.done} total={st.total} pct={st.pct} />
              })()}
            </div>

            {/* Scripts list */}
            {!isCollapsed && (
              <div style={{ border:'1px solid var(--border-strong)', borderTop:'none', borderRadius:'0 0 11px 11px', overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
                {folderScripts.map((script, idx) => {
                  const isExpScr = expandedScripts.has(script.id)
                  return (
                    <div key={script.id}>
                      <div
                        onContextMenu={e => handleScriptCtx(e, script.id)}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px 11px 36px', background:'var(--bg-surface)', borderBottom: idx < folderScripts.length-1 || addingScriptInFolder===folder.id ? '1px solid var(--border)' : 'none', cursor:'pointer', transition:'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background='var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background='var(--bg-surface)')}
                      >
                        {/* expand runs toggle */}
                        <button onClick={e => { e.stopPropagation(); setExpandedScripts(prev => { const n=new Set(prev); n.has(script.id)?n.delete(script.id):n.add(script.id); return n }) }}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', padding:2, flexShrink:0 }}>
                          {isExpScr ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                        <FileText size={14} color="var(--text-secondary)" strokeWidth={1.5} style={{ flexShrink:0 }} />
                        <span
                          onClick={() => router.push(`/projects/${id}/plan/${planId}/script/${script.id}`)}
                          style={{ fontSize:14, color:'var(--text-body)', fontWeight:500, flex:1, cursor:'pointer', transition:'color 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-body)')}>
                          {script.name}
                        </span>

                        {/* Stats */}
                        {activeRun && (() => {
                          const st = getScriptStats(script.id, activeRun.id)
                          return <StatBlock pass={st.pass} fail={st.fail} blocked={st.blocked} query={st.query} done={st.done} total={st.total} pct={st.pct} />
                        })()}
                      </div>

                      {/* Expanded run rows */}
                      {isExpScr && runs.map(run => {
                        const st = getScriptStats(script.id, run.id)
                        return (
                          <div key={run.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 14px 6px 60px', background:'rgba(0,0,0,0.15)', borderBottom:'1px solid var(--border)', fontSize:11, color:'var(--text-secondary)' }}>
                            <span style={{ minWidth:20, color:'var(--text-body-dim)' }}>{run.number}</span>
                            <span style={{ color:'var(--text-dim)' }}>·</span>
                            <span style={{ color:'var(--text-body)' }}>{run.tester}</span>
                            <span style={{ color:'var(--text-dim)' }}>·</span>
                            <span>{run.date}</span>
                            <span style={{ color:'var(--text-dim)' }}>·</span>
                            <span>{run.time}</span>
                            <span style={{ color:'var(--text-dim)' }}>·</span>
                            <span style={{ color:'var(--accent-hover)' }}>{run.build}</span>
                            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                              <span style={{ color:C.pass }}>●{st.pass}</span>
                              <span style={{ color:C.fail }}>●{st.fail}</span>
                              <span style={{ color:C.blocked }}>●{st.blocked}</span>
                              <span style={{ color:C.query }}>●{st.query}</span>
                              <MiniBar pass={st.pass} fail={st.fail} blocked={st.blocked} query={st.query} total={st.total} />
                              <span style={{ fontWeight:600, minWidth:60, textAlign:'right' }}>{st.done}/{st.total} {st.pct}%</span>
                            </div>
                          </div>
                        )
                      })}
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
                    <button type="submit" style={btnSm}>Add</button>
                    <button type="button" onClick={() => { setAddingScriptInFolder(null); setNewScriptName('') }} style={btnGSm}>Cancel</button>
                  </form>
                )}

                {/* Add script hint button */}
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

      {/* ── Right-click context menus (portalled to body so position:fixed is always viewport-relative) ── */}
      {folderMenu && createPortal(
        <div ref={folderMenuRef} style={{ position:'fixed', left:folderMenu.x, top:folderMenu.y, background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:10, padding:'6px 0', minWidth:200, zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)' }}>
          <CtxItem label="+ new script" onClick={() => { handleAddScript(folderMenu.folderId); setFolderMenu(null) }} />
          <CtxItem label="Edit name" onClick={() => { setEditingFolderId(folderMenu.folderId); setEditFolderName(folders.find(f=>f.id===folderMenu.folderId)?.name||''); setFolderMenu(null) }} />
          <CtxItem label="Duplicate folder" onClick={() => { duplicateFolder(planId, folderMenu.folderId); reload(); setFolderMenu(null) }} />
          <div style={{ height:1, background:'var(--border)', margin:'5px 0' }} />
          <CtxItem label="Delete folder" danger onClick={() => { if (confirm('Delete this folder and all scripts inside?')) { deleteFolder(planId, folderMenu.folderId); reload() } setFolderMenu(null) }} />
        </div>,
        document.body
      )}

      {scriptMenu && createPortal(
        <div ref={scriptMenuRef} style={{ position:'fixed', left:scriptMenu.x, top:scriptMenu.y, background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:10, padding:'6px 0', minWidth:200, zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)' }}>
          <CtxItem label="Open script" onClick={() => { const s=scripts.find(x=>x.id===scriptMenu.scriptId); if(s) router.push(`/projects/${id}/plan/${planId}/script/${s.id}`); setScriptMenu(null) }} />
          <CtxItem label="Duplicate script" onClick={() => { duplicateScript(planId, scriptMenu.scriptId); reload(); setScriptMenu(null) }} />
          <div style={{ height:1, background:'var(--border)', margin:'5px 0' }} />
          <CtxItem label="Delete script" danger onClick={() => { if (confirm('Delete this script?')) { deleteScript(planId, scriptMenu.scriptId); reload() } setScriptMenu(null) }} />
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

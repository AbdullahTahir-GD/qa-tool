'use client'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  getProjects, getPlans, getFolders, saveFolder, deleteFolder, updateFolder,
  getScripts, saveScript, deleteScript, getTestRuns,
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

/* Premium stat block — label · bold-coloured-number | divider | … | bar | total */
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
        <div key={s.label} style={{ display:'flex', alignItems:'center' }}>
          {i > 0 && (
            <div style={{ width:1, height:14, background:'var(--border-strong)', margin:'0 14px', flexShrink:0 }} />
          )}
          <span style={{ fontSize:12, color:'var(--text-secondary)', letterSpacing:'0.01em' }}>{s.label}&nbsp;</span>
          <span style={{ fontSize:13, fontWeight:700, color:s.color, minWidth:16, textAlign:'left' }}>{s.value}</span>
        </div>
      ))}
      {/* Progress bar */}
      <div style={{ margin:'0 18px 0 20px', flexShrink:0 }}>
        <MiniBar pass={pass} fail={fail} blocked={blocked} query={query} total={total} />
      </div>
      {/* Total */}
      <div style={{ display:'flex', alignItems:'baseline', gap:4, flexShrink:0 }}>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{done}/{total}</span>
        <span style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary)' }}>{pct}%</span>
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
      setFolderMenu(null); setScriptMenu(null)
      if (folderDDRef.current && !folderDDRef.current.contains(e.target as Node)) setFolderDropdown(false)
      if (scriptDDRef.current && !scriptDDRef.current.contains(e.target as Node)) setScriptDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleFolderCtx = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault(); e.stopPropagation()
    setFolderMenu({ x: e.clientX, y: e.clientY, folderId })
    setScriptMenu(null)
  }
  const handleScriptCtx = (e: React.MouseEvent, scriptId: string) => {
    e.preventDefault(); e.stopPropagation()
    setScriptMenu({ x: e.clientX, y: e.clientY, scriptId })
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

      {/* ── Top breadcrumb + action bar ── */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, padding:'8px 12px', background:'var(--bg-elevated)', borderRadius:9, border:'1px solid var(--border)' }}>
        <button onClick={() => router.push('/projects/'+id)}
          style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 8px', cursor:'pointer', display:'flex', alignItems:'center' }}>
          <Home size={13} color="var(--text-muted)" />
        </button>
        {runs.length > 0 && planStats && (
          <div style={{ display:'flex', alignItems:'center', gap:0, padding:'5px 14px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:7 }}>
            <StatBlock pass={planStats.pass} fail={planStats.fail} blocked={planStats.blocked} query={planStats.query} done={planStats.done} total={planStats.total} pct={planStats.pct} />
          </div>
        )}
        <div style={{ flex:1 }} />
        <span style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)' }}>{plan?.name}</span>

        {/* Script button */}
        <div ref={scriptDDRef} style={{ position:'relative' }}>
          <button onClick={() => setScriptDropdown(v=>!v)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:7, fontSize:12, color:'var(--text-secondary)', cursor:'pointer' }}>
            script <ChevronDown size={11} />
          </button>
          {scriptDropdown && (
            <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, background:'var(--bg-depth)', border:'1px solid var(--border-strong)', borderRadius:8, padding:'4px 0', minWidth:180, zIndex:100, boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>
              <div style={menuItem} onClick={() => {
                const f = folders[0]; if (f) { handleAddScript(f.id) } setScriptDropdown(false)
              }}>+ new script</div>
            </div>
          )}
        </div>

        {/* Folder button */}
        <div ref={folderDDRef} style={{ position:'relative' }}>
          <button onClick={() => setFolderDropdown(v=>!v)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:'var(--accent)', border:'none', borderRadius:7, fontSize:12, color:'white', cursor:'pointer', fontWeight:500 }}>
            folder <ChevronDown size={11} />
          </button>
          {folderDropdown && (
            <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, background:'var(--bg-depth)', border:'1px solid var(--border-strong)', borderRadius:8, padding:'4px 0', minWidth:180, zIndex:100, boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>
              <div style={menuItem} onClick={() => { setAddingFolder(true); setFolderDropdown(false); setTimeout(() => folderInputRef.current?.focus(), 30) }}>+ new folder</div>
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
          <div key={folder.id} style={{ marginBottom:12 }}>
            {/* Folder header */}
            <div
              onContextMenu={e => handleFolderCtx(e, folder.id)}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius: isCollapsed ? 9 : '9px 9px 0 0', cursor:'pointer', userSelect:'none' }}
              onClick={() => setCollapsed(prev => { const n=new Set(prev); n.has(folder.id)?n.delete(folder.id):n.add(folder.id); return n })}>
              <span style={{ fontSize:11, color:'var(--text-secondary)', flexShrink:0 }}>{isCollapsed ? '▶' : '▼'}</span>
              <FolderOpen size={14} color="var(--text-body-dim)" style={{ flexShrink:0 }} />
              {editingFolderId === folder.id ? (
                <input autoFocus value={editFolderName}
                  onChange={e => setEditFolderName(e.target.value)}
                  onBlur={() => { if (editFolderName.trim()) updateFolder(planId, folder.id, editFolderName.trim()); setEditingFolderId(null); reload() }}
                  onKeyDown={e => { if (e.key==='Enter') { if (editFolderName.trim()) updateFolder(planId, folder.id, editFolderName.trim()); setEditingFolderId(null); reload() } if (e.key==='Escape') setEditingFolderId(null) }}
                  onClick={e => e.stopPropagation()}
                  style={{ background:'var(--bg-surface)', border:'1px solid var(--accent)', borderRadius:5, padding:'2px 7px', fontSize:13, fontWeight:600, color:'var(--text-primary)', outline:'none' }} />
              ) : (
                <span style={{ fontSize:13.5, fontWeight:600, color:'var(--text-primary)', flex:1, letterSpacing:'-0.1px' }}>{folder.name}</span>
              )}

              {/* Stats */}
              {activeRun && (() => {
                const st = getFolderStats(planId, folder.id, activeRun.id)
                return <StatBlock pass={st.pass} fail={st.fail} blocked={st.blocked} query={st.query} done={st.done} total={st.total} pct={st.pct} />
              })()}
            </div>

            {/* Scripts list */}
            {!isCollapsed && (
              <div style={{ border:'1px solid var(--border)', borderTop:'none', borderRadius:'0 0 9px 9px', overflow:'hidden' }}>
                {folderScripts.map((script, idx) => {
                  const isExpScr = expandedScripts.has(script.id)
                  return (
                    <div key={script.id}>
                      <div
                        onContextMenu={e => handleScriptCtx(e, script.id)}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px 9px 32px', background:'var(--bg-surface)', borderBottom: idx < folderScripts.length-1 || addingScriptInFolder===folder.id ? '1px solid var(--border)' : 'none', cursor:'pointer', transition:'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background='var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background='var(--bg-surface)')}
                      >
                        {/* expand runs toggle */}
                        <button onClick={e => { e.stopPropagation(); setExpandedScripts(prev => { const n=new Set(prev); n.has(script.id)?n.delete(script.id):n.add(script.id); return n }) }}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', padding:2, flexShrink:0 }}>
                          {isExpScr ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        </button>
                        <FileText size={13} color="var(--text-secondary)" strokeWidth={1.5} style={{ flexShrink:0 }} />
                        <span
                          onClick={() => router.push(`/projects/${id}/plan/${planId}/script/${script.id}`)}
                          style={{ fontSize:13, color:'var(--text-body)', fontWeight:500, flex:1, cursor:'pointer', transition:'color 0.1s' }}
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
                    style={{ width:'100%', padding:'7px 14px 7px 60px', background:'none', border:'none', textAlign:'left', fontSize:12, color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}
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
      {folderMenu && (
        <div style={{ position:'fixed', left:folderMenu.x, top:folderMenu.y, background:'var(--bg-depth)', border:'1px solid var(--border-strong)', borderRadius:8, padding:'4px 0', minWidth:200, zIndex:200, boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
          <div style={menuItem} onClick={() => { handleAddScript(folderMenu.folderId); setFolderMenu(null) }}>+ new script</div>
          <div style={{ ...menuItem, borderTop:'1px solid var(--border)', marginTop:4, paddingTop:8 }}
            onClick={() => { setEditingFolderId(folderMenu.folderId); setEditFolderName(folders.find(f=>f.id===folderMenu.folderId)?.name||''); setFolderMenu(null) }}>edit name</div>
          <div style={{ ...menuItem, color:'#f87171' }}
            onClick={() => { if (confirm('Delete this folder and all scripts inside?')) { deleteFolder(planId, folderMenu.folderId); reload() } setFolderMenu(null) }}>delete folder</div>
        </div>
      )}

      {scriptMenu && (
        <div style={{ position:'fixed', left:scriptMenu.x, top:scriptMenu.y, background:'var(--bg-depth)', border:'1px solid var(--border-strong)', borderRadius:8, padding:'4px 0', minWidth:200, zIndex:200, boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
          <div style={menuItem} onClick={() => { const s=scripts.find(x=>x.id===scriptMenu.scriptId); if(s) router.push(`/projects/${id}/plan/${planId}/script/${s.id}`); setScriptMenu(null) }}>open script</div>
          <div style={{ ...menuItem, color:'#f87171', borderTop:'1px solid var(--border)', marginTop:4, paddingTop:8 }}
            onClick={() => { if (confirm('Delete this script?')) { deleteScript(planId, scriptMenu.scriptId); reload() } setScriptMenu(null) }}>delete script</div>
        </div>
      )}

    </div>
  )
}

const menuItem: React.CSSProperties = { padding:'8px 16px', fontSize:12.5, color:'var(--text-primary)', cursor:'pointer', whiteSpace:'nowrap', transition:'background 0.1s' }
const btnSm: React.CSSProperties = { display:'inline-flex',alignItems:'center',gap:4,padding:'6px 14px',background:'var(--accent)',color:'white',border:'none',borderRadius:7,fontSize:12,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap' }
const btnGSm: React.CSSProperties = { ...btnSm, background:'transparent',color:'var(--text-secondary)',border:'1px solid var(--border-strong)' }

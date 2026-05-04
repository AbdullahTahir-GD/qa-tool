'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import {
  getProjects, getProjectById, getPlans, getFolders, saveFolder, deleteFolder, updateFolder,
  getScripts, saveScript, deleteScript, updateScript, duplicateScript, duplicateFolder,
  getTestRuns, getRows, getResults, computeStats, sumStats, peekCache, invalidateCache,
  saveRow, generateId,
  type Project, type TestPlan, type Folder, type Script, type TestRun, type TestRow, type TestResult, type Stats
} from '@/lib/db'
import { supabase } from '@/lib/supabase'

function zeroStats(): Stats { return { pass:0, fail:0, blocked:0, query:0, exclude:0, done:0, total:0, pct:0 } }
import { Home, ChevronDown, ChevronRight, Plus, FolderOpen, FileText, Upload } from 'lucide-react'

const C = { pass:'#22c55e', fail:'#ef4444', blocked:'#f59e0b', query:'#38bdf8' }

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
      background:'var(--bg-elevated)', border:'1px solid rgba(14,165,233,0.30)',
      borderRadius:10, padding:'10px 20px', fontSize:13, fontWeight:500,
      color:'var(--text-body)', zIndex:99999,
      boxShadow:'0 4px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(14,165,233,0.12)',
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
  const [folderStats, setFolderStats] = useState<Record<string, Stats>>({})
  const [scriptStats, setScriptStats] = useState<Record<string, Stats>>({})
  const [planStats, setPlanStats] = useState<Stats | null>(null)

  // context menus
  const [folderMenu, setFolderMenu] = useState<{ x:number; y:number; folderId:string } | null>(null)
  const [scriptMenu, setScriptMenu] = useState<{ x:number; y:number; scriptId:string } | null>(null)
  const [folderDropdown, setFolderDropdown] = useState(false)
  const [scriptDropdown, setScriptDropdown] = useState(false)

  // inline editing
  const [editingFolderId, setEditingFolderId] = useState<string|null>(null)
  const [editFolderName, setEditFolderName] = useState('')
  const [editingScriptId, setEditingScriptId] = useState<string|null>(null)
  const [editScriptName, setEditScriptName] = useState('')
  const [addingScriptInFolder, setAddingScriptInFolder] = useState<string|null>(null)
  const [newScriptName, setNewScriptName] = useState('')
  const [addingFolder, setAddingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Import modal state
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importFolderId, setImportFolderId] = useState('')
  const [importScriptName, setImportScriptName] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)

  const folderDDRef = useRef<HTMLDivElement>(null)
  const scriptDDRef = useRef<HTMLDivElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const folderMenuRef = useRef<HTMLDivElement>(null)
  const scriptMenuRef = useRef<HTMLDivElement>(null)

  // Refs to latest state — lets Realtime handlers read current values without stale closures
  const foldersRef     = useRef<Folder[]>([])
  const scriptsRef     = useRef<Script[]>([])
  const scriptStatsRef = useRef<Record<string, Stats>>({})
  useEffect(() => { foldersRef.current     = folders },     [folders])
  useEffect(() => { scriptsRef.current     = scripts },     [scripts])
  useEffect(() => { scriptStatsRef.current = scriptStats }, [scriptStats])

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
      const pl = plans.find(p => p.id === planId)
      if (!pl) { router.push('/projects'); return }
      // Personal projects are in `projects`; team projects are fetched by ID as fallback
      const proj = projects.find(p => p.id === id) ?? await getProjectById(id)
      if (!proj) { router.push('/projects'); return }
      setProject(proj); setPlan(pl)
    }
    load()
  }, [id, planId, reload])

  useEffect(() => {
    const handler = () => { reload() }
    window.addEventListener('qaflow:change', handler)
    return () => window.removeEventListener('qaflow:change', handler)
  }, [reload])

  // Polling + visibility-based refresh — guarantees changes from other team members
  // appear within a few seconds, even if Supabase Realtime is misconfigured/blocked
  const scriptsRefForPoll = useRef<Script[]>([])
  const runsRefForPoll = useRef<TestRun[]>([])
  useEffect(() => { scriptsRefForPoll.current = scripts }, [scripts])
  useEffect(() => { runsRefForPoll.current = runs }, [runs])

  const forceReload = useCallback(async () => {
    invalidateCache(`folders:${planId}`, `scripts:${planId}`, `runs:${planId}`)
    scriptsRefForPoll.current.forEach(s => invalidateCache(`rows:${s.id}`))
    runsRefForPoll.current.forEach(r => invalidateCache(`results:${r.id}`))
    await reload()
  }, [planId, reload])

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

  // Supabase Realtime — sync changes from other team members instantly
  // Each event type is handled directly from the payload — zero extra queries for INSERT/UPDATE
  useEffect(() => {
    type FR = { id: string; plan_id: string; name: string; sort_order: number }
    type SR = { id: string; plan_id: string; folder_id: string; name: string; description: string; sort_order: number }

    const channel = supabase
      .channel(`plan-${planId}`)

      // ── folders ──
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'folders',
        filter: `plan_id=eq.${planId}` }, ({ new: r }) => {
        const f: Folder = { id:(r as FR).id, planId:(r as FR).plan_id, name:(r as FR).name, order:(r as FR).sort_order }
        setFolders(prev => prev.some(x=>x.id===f.id) ? prev : [...prev, f].sort((a,b)=>a.order-b.order))
        setFolderStats(prev => ({ ...prev, [f.id]: prev[f.id] ?? zeroStats() }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'folders',
        filter: `plan_id=eq.${planId}` }, ({ new: r }) => {
        const f: Folder = { id:(r as FR).id, planId:(r as FR).plan_id, name:(r as FR).name, order:(r as FR).sort_order }
        setFolders(prev => prev.map(x => x.id===f.id ? f : x))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'folders',
        filter: `plan_id=eq.${planId}` }, ({ old: r }) => {
        const id = (r as { id: string }).id
        setFolders(prev => prev.filter(f=>f.id!==id))
        setFolderStats(prev => { const n={...prev}; delete n[id]; return n })
      })

      // ── scripts ──
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scripts',
        filter: `plan_id=eq.${planId}` }, ({ new: r }) => {
        const sc: Script = { id:(r as SR).id, planId:(r as SR).plan_id, folderId:(r as SR).folder_id, name:(r as SR).name, description:(r as SR).description||'', order:(r as SR).sort_order }
        setScripts(prev => prev.some(x=>x.id===sc.id) ? prev : [...prev, sc].sort((a,b)=>a.order-b.order))
        // New script has no rows yet — zero stats; folder total unchanged (no case rows added)
        setScriptStats(prev => ({ ...prev, [sc.id]: prev[sc.id] ?? zeroStats() }))
        // Keep folder stats — new empty script contributes nothing to pass/fail/total
        setFolderStats(prev => ({ ...prev, [sc.folderId]: prev[sc.folderId] ?? zeroStats() }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scripts',
        filter: `plan_id=eq.${planId}` }, ({ new: r }) => {
        const sc: Script = { id:(r as SR).id, planId:(r as SR).plan_id, folderId:(r as SR).folder_id, name:(r as SR).name, description:(r as SR).description||'', order:(r as SR).sort_order }
        setScripts(prev => prev.map(x => x.id===sc.id ? sc : x))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'scripts',
        filter: `plan_id=eq.${planId}` }, ({ old: r }) => {
        const id = (r as { id: string }).id
        setScripts(prev => prev.filter(s=>s.id!==id))
        setScriptStats(prev => { const n={...prev}; delete n[id]; return n })
        // Recompute folder stats from refs (no stale closure) — pure local computation
        const remaining = scriptsRef.current.filter(s=>s.id!==id)
        const curStats  = scriptStatsRef.current
        const fStats: Record<string, Stats> = {}
        for (const folder of foldersRef.current) {
          const fs = remaining.filter(sc=>sc.folderId===folder.id)
          fStats[folder.id] = sumStats(fs.map(sc => curStats[sc.id] ?? zeroStats()))
        }
        setFolderStats(fStats)
        setPlanStats(Object.keys(fStats).length>0 ? sumStats(Object.values(fStats)) : null)
      })

      // ── runs — full reload needed (affects all stats) ──
      .on('postgres_changes', { event: '*', schema: 'public', table: 'runs',
        filter: `plan_id=eq.${planId}` }, () => reload())

      // ── This plan deleted by another user → redirect to project ──
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'plans',
        filter: `id=eq.${planId}` }, () => {
        setToast('This test plan was deleted by another team member.')
        setTimeout(() => router.push(`/projects/${id}`), 2500)
      })

      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [planId, id, reload, router])

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

  const commitScriptRename = (scriptId: string, newName: string) => {
    const trimmed = newName.trim()
    if (trimmed) {
      setScripts(prev => prev.map(s => s.id === scriptId ? { ...s, name: trimmed } : s))
      updateScript(planId, scriptId, { name: trimmed }).catch(console.error)
    }
    setEditingScriptId(null)
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

  // ── Import: parse Testpad CSV or plain text into test case rows ──
  // Testpad CSV format:
  //   Lines 1–N: metadata (version, script info, stats) — skip these
  //   Header row: "number,indent,text,tags,notes,result,issue,comment"
  //   Data rows: number, indent (1=heading, 2+=case), text (title), ...
  //   Multi-line notes are enclosed in quotes and can span many lines
  const parseImportText = (raw: string): { type: 'case' | 'heading'; title: string }[] => {
    const fullText = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    // ── Detect Testpad CSV: look for the header row ──
    // Flexible match: some CSVs have 5 cols (number,indent,text,tags,notes),
    // others have 8+ (…,result,issue,comment,result,issue,comment)
    const headerMatch = fullText.match(/^number,indent,text,tags,notes/m)
    if (headerMatch) {
      // Everything after the header row is data — skip to the end of the full header line
      const headerLineStart = fullText.indexOf(headerMatch[0])
      const headerLineEnd = fullText.indexOf('\n', headerLineStart)
      const dataText = headerLineEnd === -1 ? '' : fullText.slice(headerLineEnd + 1)

      // Parse CSV rows properly handling quoted multi-line fields
      const rows: string[][] = []
      let cur: string[] = []
      let cell = ''
      let inQuote = false

      for (let i = 0; i < dataText.length; i++) {
        const ch = dataText[i]
        if (inQuote) {
          if (ch === '"' && dataText[i + 1] === '"') {
            cell += '"'; i++ // escaped quote
          } else if (ch === '"') {
            inQuote = false
          } else {
            cell += ch
          }
        } else {
          if (ch === '"') {
            inQuote = true
          } else if (ch === ',') {
            cur.push(cell); cell = ''
          } else if (ch === '\n') {
            cur.push(cell); cell = ''
            rows.push(cur); cur = []
          } else {
            cell += ch
          }
        }
      }
      // Flush last row
      if (cell || cur.length > 0) { cur.push(cell); rows.push(cur) }

      // Columns: 0=number, 1=indent, 2=text, 3=tags, 4=notes, 5=result, 6=issue, 7=comment
      return rows
        .filter(cols => {
          const num = (cols[0] ?? '').trim()
          const text = (cols[2] ?? '').trim()
          return /^\d+$/.test(num) && text.length > 0 // skip metadata/blank rows
        })
        .map(cols => {
          const indent = parseInt(cols[1] ?? '2', 10)
          let text = (cols[2] ?? '').trim()
          // Strip Testpad "TC-XX:" / "TC - XX:" / "TC-XXX:" prefixes —
          // Testra already adds its own row numbering (1:, 2:, 3:…)
          text = text.replace(/^TC[\s-]*\w+\s*:\s*/i, '').trim()
          return {
            type: indent <= 1 ? 'heading' as const : 'case' as const,
            title: text,
          }
        })
    }

    // ── Fallback: plain text — one test case per line ──
    return fullText.split('\n')
      .filter(l => l.trim().length > 0)
      .map(l => {
        const trimmed = l.trim()
        if (trimmed.startsWith('# ')) return { type: 'heading' as const, title: trimmed.slice(2).trim() }
        if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !/^\d/.test(trimmed))
          return { type: 'heading' as const, title: trimmed }
        const cleaned = trimmed.replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, '')
        return { type: 'case' as const, title: cleaned }
      })
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      setImportText(text)
      if (!importScriptName) setImportScriptName(file.name.replace(/\.(csv|txt|tsv)$/i, ''))
    }
    reader.readAsText(file)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  const handleImport = async () => {
    if (!importText.trim() || !importFolderId || !importScriptName.trim()) return
    setImportLoading(true)
    try {
      const parsed = parseImportText(importText)
      if (parsed.length === 0) { showToast('No test cases found in the imported text'); setImportLoading(false); return }

      // Create the script
      const script = await saveScript(planId, importFolderId, importScriptName.trim(), '', scripts.length)

      // ── Bulk insert — ONE DB call instead of N sequential requests ──
      const bulkRows = parsed.map((item, i) => ({
        id: generateId(),
        script_id: script.id,
        type: item.type,
        number: '',
        title: item.title,
        sort_order: i,
      }))

      // Supabase supports bulk insert — split into chunks of 500 to stay under payload limits
      const CHUNK = 500
      for (let i = 0; i < bulkRows.length; i += CHUNK) {
        const chunk = bulkRows.slice(i, i + CHUNK)
        const { error } = await supabase.from('rows').insert(chunk)
        if (error) throw error
      }

      showToast(`Imported ${parsed.length} items into "${importScriptName.trim()}"`)
      setImportOpen(false)
      setImportText('')
      setImportScriptName('')
      setImportFolderId('')
      reload()
    } catch (err) {
      console.error('Import error:', err)
      showToast('Import failed — check console for details')
    }
    setImportLoading(false)
  }

  const openImportModal = () => {
    if (!hasFolders) { showToast('Create a folder first before importing'); return }
    setImportFolderId(folders[0]?.id ?? '')
    setImportOpen(true)
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
        borderTop:'3px solid #0ea5e9',
        boxShadow:'0 2px 16px rgba(14,165,233,0.10)',
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
              background: hasFolders ? 'rgba(14,165,233,0.08)' : 'var(--bg-depth)',
              border: hasFolders ? '1px solid rgba(14,165,233,0.30)' : '1px solid var(--border-strong)',
              borderRadius:9, fontSize:13, color: hasFolders ? '#0284c7' : 'var(--text-body)',
              cursor: hasFolders ? 'pointer' : 'not-allowed',
              fontWeight:600, transition:'all 0.14s',
              opacity: hasFolders ? 1 : 0.5,
            }}
            onMouseEnter={e => { if (hasFolders) { e.currentTarget.style.background='rgba(14,165,233,0.16)'; e.currentTarget.style.borderColor='rgba(14,165,233,0.55)' } }}
            onMouseLeave={e => { if (hasFolders) { e.currentTarget.style.background='rgba(14,165,233,0.08)'; e.currentTarget.style.borderColor='rgba(14,165,233,0.30)' } }}>
            <Plus size={13} color={hasFolders ? '#0ea5e9' : 'var(--text-secondary)'} /> Script <ChevronDown size={12} />
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
              background: addingFolder ? 'var(--bg-depth)' : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              border: addingFolder ? '1px solid var(--border-strong)' : 'none',
              borderRadius:9, fontSize:13, color: addingFolder ? 'var(--text-muted)' : 'white',
              cursor: addingFolder ? 'not-allowed' : 'pointer',
              fontWeight:600, transition:'all 0.15s',
              opacity: addingFolder ? 0.6 : 1,
              boxShadow: addingFolder ? 'none' : '0 3px 12px rgba(14,165,233,0.40)',
            }}
            onMouseEnter={e => { if (!addingFolder) { e.currentTarget.style.boxShadow='0 4px 18px rgba(14,165,233,0.60)'; e.currentTarget.style.transform='translateY(-1px)' } }}
            onMouseLeave={e => { if (!addingFolder) { e.currentTarget.style.boxShadow='0 3px 12px rgba(14,165,233,0.40)'; e.currentTarget.style.transform='none' } }}>
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
        <div style={{
          textAlign:'center', padding:'56px 24px',
          background:'linear-gradient(135deg, rgba(14,165,233,0.04) 0%, rgba(14,165,233,0.01) 100%)',
          border:'1px dashed rgba(14,165,233,0.30)',
          borderRadius:14,
        }}>
          <div style={{
            width:48, height:48, borderRadius:14, margin:'0 auto 16px',
            background:'linear-gradient(135deg, rgba(14,165,233,0.15) 0%, rgba(2,132,199,0.08) 100%)',
            border:'1px solid rgba(14,165,233,0.25)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <FolderOpen size={22} color="#0ea5e9" strokeWidth={1.5} />
          </div>
          <p style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', marginBottom:6 }}>No folders yet</p>
          <p style={{ fontSize:13, color:'var(--text-secondary)' }}>
            Click <strong style={{ color:'#0ea5e9', fontWeight:700 }}>+ Folder</strong> above to create your first one
          </p>
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
                background:'linear-gradient(90deg, rgba(14,165,233,0.10) 0%, rgba(14,165,233,0.04) 100%)',
                border:'1px solid rgba(14,165,233,0.22)',
                borderLeft:'3px solid #0ea5e9',
                borderRadius: isCollapsed ? 11 : '11px 11px 0 0',
                cursor: isFolderDuplicating ? 'wait' : 'pointer', userSelect:'none',
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
              <div style={{ border:'1px solid rgba(14,165,233,0.18)', borderTop:'none', borderRadius:'0 0 11px 11px', overflow:'hidden', boxShadow:'0 3px 12px rgba(14,165,233,0.06)' }}>
                {folderScripts.map((script, idx) => {
                  const scriptSt = scriptStats[script.id] ?? { pass:0, fail:0, blocked:0, query:0, done:0, total:0, pct:0 }
                  const isDuplicating = script.id.startsWith('dup_')
                  return (
                    <div key={script.id}>
                      <div
                        onContextMenu={e => { if (!isDuplicating) handleScriptCtx(e, script.id) }}
                        onClick={() => { if (!isDuplicating) router.push(`/projects/${id}/plan/${planId}/script/${script.id}`) }}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px 11px 46px', background:'var(--bg-surface)', borderBottom: idx < folderScripts.length-1 || addingScriptInFolder===folder.id ? '1px solid var(--border)' : 'none', cursor: isDuplicating ? 'wait' : 'pointer', transition:'background 0.1s', opacity: isDuplicating ? 0.55 : 1 }}
                        onMouseEnter={e => { if (!isDuplicating) e.currentTarget.style.background='rgba(14,165,233,0.05)' }}
                        onMouseLeave={e => (e.currentTarget.style.background='var(--bg-surface)')}
                      >
                        {isDuplicating
                          ? <span style={{ fontSize:12, animation:'spin 1s linear infinite', display:'inline-block', flexShrink:0 }}>⟳</span>
                          : <FileText size={14} color="#0ea5e9" strokeWidth={1.5} style={{ flexShrink:0, opacity:0.75 }} />
                        }
                        {editingScriptId === script.id ? (
                          <input
                            autoFocus
                            value={editScriptName}
                            onChange={e => setEditScriptName(e.target.value)}
                            onBlur={() => commitScriptRename(script.id, editScriptName)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); commitScriptRename(script.id, editScriptName) }
                              if (e.key === 'Escape') setEditingScriptId(null)
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{ flex:1, background:'var(--bg-surface)', border:'1px solid var(--accent)', borderRadius:5, padding:'2px 8px', fontSize:14, fontWeight:500, color:'var(--text-primary)', outline:'none' }}
                          />
                        ) : (
                          <span style={{ fontSize:14, color: isDuplicating ? 'var(--text-muted)' : 'var(--text-body)', fontWeight:500, flex:1, transition:'color 0.1s', fontStyle: isDuplicating ? 'italic' : 'normal' }}
                            onMouseEnter={e => { if (!isDuplicating) e.currentTarget.style.color = 'var(--text-primary)' }}
                            onMouseLeave={e => { if (!isDuplicating) e.currentTarget.style.color = 'var(--text-body)' }}>
                            {script.name}{isDuplicating ? '' : ''}
                          </span>
                        )}

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
                    onMouseEnter={e => { e.currentTarget.style.color='var(--accent)'; e.currentTarget.style.background='rgba(14,165,233,0.04)' }}
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
          <CtxItem label="+ New script" onClick={() => { handleAddScript(folderMenu.folderId); setFolderMenu(null) }} />
          <CtxItem label="📥 Import script" onClick={() => { setImportFolderId(folderMenu.folderId); setImportOpen(true); setFolderMenu(null) }} />
          <div style={{ height:1, background:'var(--border)', margin:'5px 0' }} />
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
          <CtxItem label="Rename script" onClick={() => { const s=scripts.find(x=>x.id===scriptMenu.scriptId); if(s){ setEditingScriptId(s.id); setEditScriptName(s.name) } setScriptMenu(null) }} />
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

      {/* ── Import Modal ── */}
      {importOpen && createPortal(
        <div
          onClick={() => { if (!importLoading) setImportOpen(false) }}
          style={{
            position:'fixed', inset:0, zIndex:99999,
            background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)',
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:20,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width:'100%', maxWidth:560,
              background:'var(--bg-surface)',
              border:'1px solid rgba(14,165,233,0.25)',
              borderTop:'3px solid #0ea5e9',
              borderRadius:16, padding:'28px 32px',
              boxShadow:'0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(14,165,233,0.08)',
            }}>
            {/* Header with icon */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
              <div style={{
                width:36, height:36, borderRadius:10, flexShrink:0,
                background:'linear-gradient(135deg, rgba(14,165,233,0.15) 0%, rgba(2,132,199,0.08) 100%)',
                border:'1px solid rgba(14,165,233,0.25)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Upload size={16} color="#0ea5e9" />
              </div>
              <div>
                <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text-primary)', margin:0, letterSpacing:'-0.5px' }}>
                  Import Test Cases
                </h2>
                <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>
                  Upload a Testpad CSV or paste test cases
                </p>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height:1, background:'linear-gradient(90deg, rgba(14,165,233,0.20), transparent)', margin:'16px 0' }} />

            {/* File upload */}
            <input ref={importFileRef} type="file" accept=".csv,.txt,.tsv" onChange={handleFileUpload} style={{ display:'none' }} />
            <button onClick={() => importFileRef.current?.click()} style={{
              display:'flex', alignItems:'center', gap:8, padding:'10px 18px', marginBottom:14, width:'100%',
              background:'rgba(14,165,233,0.04)', border:'1px dashed rgba(14,165,233,0.35)',
              borderRadius:10, fontSize:13, color:'#0ea5e9', cursor:'pointer', fontWeight:600,
              transition:'all 0.14s', justifyContent:'center',
            }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(14,165,233,0.10)'; e.currentTarget.style.borderColor='rgba(14,165,233,0.55)' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(14,165,233,0.04)'; e.currentTarget.style.borderColor='rgba(14,165,233,0.35)' }}>
              <Upload size={15} /> Upload CSV / TXT file
            </button>

            {/* Textarea */}
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder={"Paste test cases here...\n\n# Login Tests\nVerify user can login with valid credentials\nVerify error shown with invalid password\n# Registration\nVerify user can create new account"}
              rows={8}
              style={{
                width:'100%', boxSizing:'border-box', padding:'12px 14px', borderRadius:10,
                fontSize:12.5, fontFamily:'monospace', lineHeight:1.6,
                background:'var(--bg-base)', border:'1px solid var(--border)',
                color:'var(--text-primary)', outline:'none', resize:'vertical',
              }}
              onFocus={e => (e.target.style.borderColor='#0ea5e9')}
              onBlur={e => (e.target.style.borderColor='var(--border)')}
            />

            {/* Preview count */}
            {importText.trim() && (
              <div style={{
                fontSize:12, fontWeight:600, margin:'10px 0 0',
                color:'#0ea5e9',
                display:'flex', alignItems:'center', gap:6,
              }}>
                <div style={{ width:6, height:6, borderRadius:3, background:'#0ea5e9' }} />
                {(() => {
                  const items = parseImportText(importText)
                  const cases = items.filter(i => i.type === 'case').length
                  const headings = items.filter(i => i.type === 'heading').length
                  return `${cases} test case${cases !== 1 ? 's' : ''}${headings ? ` + ${headings} heading${headings !== 1 ? 's' : ''}` : ''} detected`
                })()}
              </div>
            )}

            {/* Folder + Script name */}
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', display:'block', marginBottom:6, textTransform:'uppercase' }}>Folder</label>
                <select
                  value={importFolderId}
                  onChange={e => setImportFolderId(e.target.value)}
                  style={{
                    width:'100%', padding:'9px 12px', borderRadius:8, fontSize:13,
                    background:'var(--bg-base)', border:'1px solid var(--border)',
                    color:'var(--text-primary)', outline:'none',
                  }}>
                  <option value="">Select folder…</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', display:'block', marginBottom:6, textTransform:'uppercase' }}>Script Name</label>
                <input
                  value={importScriptName}
                  onChange={e => setImportScriptName(e.target.value)}
                  placeholder="e.g. Build Deployment Checks"
                  style={{
                    width:'100%', padding:'9px 12px', borderRadius:8, fontSize:13,
                    background:'var(--bg-base)', border:'1px solid var(--border)',
                    color:'var(--text-primary)', outline:'none', boxSizing:'border-box',
                  }}
                  onFocus={e => (e.target.style.borderColor='#0ea5e9')}
                  onBlur={e => (e.target.style.borderColor='var(--border)')}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:22 }}>
              <button
                onClick={() => { setImportOpen(false); setImportText(''); setImportScriptName('') }}
                disabled={importLoading}
                style={{
                  padding:'8px 18px', fontSize:13, fontWeight:500,
                  background:'transparent', border:'1px solid var(--border-strong)',
                  borderRadius:8, color:'var(--text-secondary)', cursor:'pointer',
                  opacity: importLoading ? 0.5 : 1,
                }}>
                Cancel
              </button>
              {(() => {
                const ready = !!(importText.trim() && importFolderId && importScriptName.trim())
                const count = ready ? parseImportText(importText).length : 0
                return (
                  <button
                    onClick={handleImport}
                    disabled={importLoading || !ready}
                    style={{
                      display:'inline-flex', alignItems:'center', gap:6,
                      padding:'8px 22px', fontSize:13, fontWeight:700,
                      background: ready ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' : 'var(--bg-depth)',
                      color: ready ? 'white' : 'var(--text-muted)',
                      border:'none', borderRadius:8, cursor: importLoading ? 'not-allowed' : 'pointer',
                      boxShadow: ready ? '0 3px 14px rgba(14,165,233,0.40)' : 'none',
                      transition:'all 0.15s',
                      opacity: importLoading ? 0.7 : 1,
                    }}
                    onMouseEnter={e => { if (ready && !importLoading) e.currentTarget.style.boxShadow='0 4px 20px rgba(14,165,233,0.55)' }}
                    onMouseLeave={e => { if (ready) e.currentTarget.style.boxShadow='0 3px 14px rgba(14,165,233,0.40)' }}>
                    {importLoading ? 'Importing…' : `Import ${count || ''} items`}
                  </button>
                )
              })()}
            </div>
          </div>
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

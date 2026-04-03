'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import {
  getScripts, getRows, saveRow, updateRow, deleteRow,
  getTestRuns, saveTestRun, deleteTestRun, updateTestRun,
  getResult, setResult, getResults, getScriptStats,
  getDetail, saveDetail,
  type Script, type TestRow, type TestRun, type TestStatus, type TestResult, type TestCaseDetail
} from '@/lib/store'

const STATUS_ICONS: Record<TestStatus, { icon: string; color: string }> = {
  pass:    { icon: '✓', color: '#22c55e' },
  fail:    { icon: '✗', color: '#ef4444' },
  blocked: { icon: '⊘', color: '#f59e0b' },
  query:   { icon: '?', color: '#3b82f6' },
  exclude: { icon: '–', color: '#475569' },
  not_run: { icon: '',  color: 'transparent' },
}

export default function ScriptPage() {
  const { id, planId, scriptId } = useParams<{ id: string; planId: string; scriptId: string }>()
  const router = useRouter()

  const [script, setScript] = useState<Script | null>(null)
  const [rows, setRows] = useState<TestRow[]>([])
  const [runs, setRuns] = useState<TestRun[]>([])
  const [resultsMap, setResultsMap] = useState<Record<string, Record<string, TestResult>>>({})

  // Panel state
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [panelVisible, setPanelVisible] = useState(true)   // can hide/show without losing active run
  const [panelComment, setPanelComment] = useState('')
  const [panelBugId, setPanelBugId] = useState('')

  // Detail panel state
  const [detailRowId, setDetailRowId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TestCaseDetail>({ preConditions: '', steps: '', expected: '', actual: '', notes: '' })

  // Add run modal
  const [addingRun, setAddingRun] = useState(false)
  const [runTester, setRunTester] = useState('')
  const [runBuild, setRunBuild] = useState('')

  // Row editing
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; rowId: string } | null>(null)

  const addInputRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(() => {
    const allScripts = getScripts(planId)
    setScript(allScripts.find(s => s.id === scriptId) || null)
    setRows(getRows(scriptId))
    const rns = getTestRuns(planId)
    setRuns(rns)
    const map: Record<string, Record<string, TestResult>> = {}
    rns.forEach(run => {
      map[run.id] = {}
      getResults(run.id).forEach(r => { map[run.id][r.rowId] = r })
    })
    setResultsMap(map)
  }, [scriptId, planId])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    window.addEventListener('qaflow:change', reload)
    return () => window.removeEventListener('qaflow:change', reload)
  }, [reload])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-rowmenu]')) setRowMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const caseRows = rows.filter(r => r.type === 'case')

  const topStats = activeRunId ? getScriptStats(scriptId, activeRunId) : null

  // ── Add row ──
  const handleAddRow = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!newTitle.trim()) return
    saveRow(scriptId, newTitle.trim(), '', 'case')
    setNewTitle('')
    reload()
    setTimeout(() => addInputRef.current?.focus(), 30)
  }

  // ── Add run ──
  const handleAddRun = (e: React.FormEvent) => {
    e.preventDefault()
    const run = saveTestRun(planId, runTester.trim() || 'anyone', '')
    setRunTester(''); setAddingRun(false)
    reload()
    // auto-select the new run
    setActiveRunId(run.id)
  }

  // ── Click run column header → select it + open panel on first untested case ──
  const handleSelectRun = (runId: string) => {
    if (activeRunId === runId) {
      // same run clicked — toggle panel visibility instead of deselecting
      setPanelVisible(v => !v)
      return
    }
    setActiveRunId(runId)
    setPanelVisible(true)
    // find first not-run case
    const first = caseRows.find(r => {
      const res = resultsMap[runId]?.[r.id]
      return !res || res.status === 'not_run'
    }) || caseRows[0]
    if (first) {
      setActiveRowId(first.id)
      const res = resultsMap[runId]?.[first.id]
      setPanelComment(res?.comment || '')
      setPanelBugId(res?.bugId || '')
    }
  }

  // ── Click a cell in the grid ──
  const handleCellClick = (runId: string, rowId: string) => {
    setActiveRunId(runId)
    setActiveRowId(rowId)
    const res = resultsMap[runId]?.[rowId]
    setPanelComment(res?.comment || '')
    setPanelBugId(res?.bugId || '')
    if (detailRowId) {
      setDetailRowId(rowId)
      setDetail(getDetail(rowId))
    }
  }

  // ── Panel: set status + auto-advance ──
  const handlePanelStatus = (status: TestStatus) => {
    if (!activeRunId || !activeRowId) return
    setResult(activeRunId, activeRowId, status, panelComment, panelBugId)
    reload()
    // advance to next case
    const idx = caseRows.findIndex(r => r.id === activeRowId)
    const next = caseRows[idx + 1]
    if (next) {
      setActiveRowId(next.id)
      const res = resultsMap[activeRunId]?.[next.id]
      setPanelComment(res?.comment || '')
      setPanelBugId(res?.bugId || '')
      if (detailRowId) {
        setDetailRowId(next.id)
        setDetail(getDetail(next.id))
      }
    }
  }

  const handlePanelNav = (dir: 'prev' | 'next') => {
    if (!activeRunId || !activeRowId) return
    const idx = caseRows.findIndex(r => r.id === activeRowId)
    const next = dir === 'next' ? caseRows[idx + 1] : caseRows[idx - 1]
    if (!next) return
    setActiveRowId(next.id)
    const res = resultsMap[activeRunId]?.[next.id]
    setPanelComment(res?.comment || '')
    setPanelBugId(res?.bugId || '')
    if (detailRowId) {
      setDetailRowId(next.id)
      setDetail(getDetail(next.id))
    }
  }

  const savePanelNote = () => {
    if (!activeRunId || !activeRowId) return
    const existing = resultsMap[activeRunId]?.[activeRowId]
    if (existing) setResult(activeRunId, activeRowId, existing.status, panelComment, panelBugId)
    reload()
  }

  // ── Detail panel ──
  const openDetail = (rowId: string) => {
    if (detailRowId === rowId) { setDetailRowId(null); return }
    setDetailRowId(rowId)
    setDetail(getDetail(rowId))
  }
  const closeDetail = () => setDetailRowId(null)
  const updateDetailField = (field: keyof TestCaseDetail, value: string) => {
    const next = { ...detail, [field]: value }
    setDetail(next)
    if (detailRowId) saveDetail(detailRowId, next)
  }

  // D key shortcut — opens detail for the active row (or closes it)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'd' || e.key === 'D') {
        const rowId = activeRowId || rows.find(r => r.type === 'case')?.id
        if (rowId) openDetail(rowId)
      }
      if (e.key === 'Escape') { if (detailRowId) closeDetail(); else setPanelVisible(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeRowId, detailRowId, rows, detail])

  // ── Row right-click menu ──
  const handleRowCtx = (e: React.MouseEvent, rowId: string) => {
    e.preventDefault(); e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth  - 200 - 8)
    const y = Math.min(e.clientY, window.innerHeight - 200 - 8)
    setRowMenu({ x, y, rowId })
  }

  const makeHeading = (rowId: string) => {
    updateRow(scriptId, rowId, { type: 'heading', number: '' })
    setRowMenu(null); reload()
  }
  const makeCase = (rowId: string) => {
    updateRow(scriptId, rowId, { type: 'case' })
    setRowMenu(null); reload()
  }

  const activeRow = rows.find(r => r.id === activeRowId)
  const activeResult = activeRunId && activeRowId ? resultsMap[activeRunId]?.[activeRowId] : undefined
  const panelOpen = !!activeRunId && panelVisible
  const activeRun = runs.find(r => r.id === activeRunId) ?? null
  const runIsCompleted = activeRun?.status === 'completed'

  const markRunCompleted = () => {
    if (!activeRunId) return
    updateTestRun(planId, activeRunId, { status: 'completed' })
    reload()
  }
  const markRunInProgress = () => {
    if (!activeRunId) return
    updateTestRun(planId, activeRunId, { status: 'in_progress' })
    reload()
  }

  const generatePDF = async () => {
    if (runs.length === 0) return
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 40
    let y = margin

    const statusColors: Record<string, [number, number, number]> = {
      pass:    [22, 163, 74],
      fail:    [220, 38, 38],
      blocked: [245, 158, 11],
      query:   [59, 130, 246],
      exclude: [100, 116, 139],
      not_run: [150, 150, 150],
    }
    const statusLabels: Record<string, string> = {
      pass: 'PASS', fail: 'FAIL', blocked: 'BLOCKED',
      query: 'QUERY', exclude: 'EXCL', not_run: '-',
    }

    // ── HEADER ──
    doc.setFillColor(22, 163, 74)
    doc.rect(0, 0, pageW, 72, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text('QAFlow — Combined Test Report', margin, 30)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(`Script: ${script?.name || ''}   ·   ${runs.length} Run${runs.length > 1 ? 's' : ''}   ·   Generated: ${new Date().toLocaleString()}`, margin, 54)
    y = 90

    // ── RUNS SUMMARY TABLE ──
    doc.setTextColor(30, 30, 40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Runs Summary', margin, y)
    y += 12

    // Summary table header
    const summaryColW = (pageW - margin * 2) / 7
    const summaryHeaders = ['Run', 'Tester', 'Build', 'Date', 'Pass', 'Fail', 'Pass Rate']
    doc.setFillColor(30, 30, 40)
    doc.rect(margin, y, pageW - margin * 2, 20, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    summaryHeaders.forEach((h, i) => {
      doc.text(h, margin + summaryColW * i + 5, y + 14)
    })
    y += 20

    // Summary table rows
    runs.forEach((run, idx) => {
      const st = getScriptStats(scriptId, run.id)
      const bg: [number, number, number] = idx % 2 === 0 ? [255, 255, 255] : [248, 250, 252]
      doc.setFillColor(...bg)
      doc.rect(margin, y, pageW - margin * 2, 18, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      const cells = [
        `#${run.number}`, run.tester, run.build || '-', run.date,
        String(st.pass), String(st.fail), `${st.pct}%`
      ]
      cells.forEach((cell, i) => {
        if (i === 4) doc.setTextColor(...statusColors.pass)
        else if (i === 5) doc.setTextColor(...statusColors.fail)
        else if (i === 6) doc.setTextColor(22, 163, 74)
        else doc.setTextColor(30, 30, 40)
        doc.text(cell, margin + summaryColW * i + 5, y + 13)
      })
      y += 18
    })
    y += 20

    // ── COMBINED TEST CASE TABLE ──
    doc.setTextColor(30, 30, 40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Detailed Results — All Runs', margin, y)
    y += 12

    // Calculate column widths: # col + title col + one col per run
    const caseRowsOnly = rows.filter(r => r.type === 'case')
    const numCol = 28
    const runColW = 52
    const titleColW = pageW - margin * 2 - numCol - runColW * runs.length

    // Table header
    doc.setFillColor(30, 30, 40)
    doc.rect(margin, y, pageW - margin * 2, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('#', margin + 4, y + 15)
    doc.text('Test Case', margin + numCol + 4, y + 15)
    runs.forEach((run, i) => {
      const cx = margin + numCol + titleColW + runColW * i + runColW / 2
      doc.text(`R${run.number}`, cx, y + 10, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.text(run.tester.split(' ')[0], cx, y + 19, { align: 'center' })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
    })
    y += 22

    // Table rows
    caseRowsOnly.forEach((row, idx) => {
      if (y > pageH - 50) {
        doc.addPage()
        y = margin
      }
      const bg: [number, number, number] = idx % 2 === 0 ? [255, 255, 255] : [248, 250, 252]
      doc.setFillColor(...bg)
      doc.rect(margin, y, pageW - margin * 2, 20, 'F')

      // Row number
      doc.setTextColor(150, 150, 150)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text(String(idx + 1), margin + 4, y + 14)

      // Title
      doc.setTextColor(30, 30, 40)
      doc.setFontSize(8.5)
      const title = row.number ? `${row.number}: ${row.title}` : row.title
      doc.text(doc.splitTextToSize(title, titleColW - 8)[0], margin + numCol + 4, y + 14)

      // Status per run
      runs.forEach((run, i) => {
        const res = resultsMap[run.id]?.[row.id]
        const status = res?.status || 'not_run'
        const cx = margin + numCol + titleColW + runColW * i + runColW / 2
        doc.setTextColor(...statusColors[status])
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.text(statusLabels[status], cx, y + 14, { align: 'center' })
      })

      y += 20
    })

    // ── FOOTER ──
    doc.setTextColor(150, 150, 150)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(`QAFlow Combined Report  ·  ${script?.name || ''}  ·  ${new Date().toLocaleString()}`, margin, pageH - 18)

    doc.save(`QAFlow-Combined-Report-${script?.name || 'script'}-${runs.length}runs.pdf`)
  }

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - var(--topnav-height) - 48px)',
      overflow: 'hidden',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-strong)',
      borderRadius: 14,
      boxShadow: 'var(--shadow-md)',
    }}>

      {/* ══ MAIN ══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 18px',
          background: 'linear-gradient(90deg, var(--bg-elevated) 0%, var(--bg-depth) 100%)',
          borderBottom: '1px solid var(--border-strong)',
          flexShrink: 0, borderRadius: '14px 14px 0 0',
          boxShadow: 'inset 0 -1px 0 var(--border)',
        }}>
          <button onClick={() => router.push(`/projects/${id}/plan/${planId}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: 'var(--text-secondary)',
              background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
              borderRadius: 7, cursor: 'pointer', padding: '5px 11px',
              fontWeight: 500, transition: 'all 0.14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.borderColor='var(--border-accent)' }}
            onMouseLeave={e => { e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.borderColor='var(--border-strong)' }}>
            ← Plan
          </button>
          <div style={{ width:1, height:16, background:'var(--border-strong)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>{script?.name}</span>
          {topStats && activeRunId && (
            <>
              <div style={{ width:1, height:16, background:'var(--border-strong)' }} />
              <span style={{ fontSize:12, color:'var(--color-pass)', fontWeight:700 }}>✓ {topStats.pass}</span>
              <span style={{ fontSize:12, color:'var(--color-fail)', fontWeight:700 }}>✗ {topStats.fail}</span>
              <span style={{ fontSize:12, color:'var(--color-blocked)', fontWeight:700 }}>⊘ {topStats.blocked}</span>
              <span style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:500 }}>{topStats.done}/{topStats.total} ({topStats.pct}%)</span>
            </>
          )}
          <div style={{ flex: 1 }} />
          {runs.length > 0 && (
            <button onClick={generatePDF}
              style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'6px 14px',
                background:'var(--bg-depth)', color:'var(--text-body)',
                border:'1px solid var(--border-strong)', borderRadius:8,
                fontSize:12.5, fontWeight:600, cursor:'pointer', transition:'all 0.14s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-accent)'; e.currentTarget.style.color='var(--accent-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-strong)'; e.currentTarget.style.color='var(--text-body)' }}>
              ↓ Report
            </button>
          )}
          <button onClick={() => setAddingRun(true)}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'6px 16px',
              background:'linear-gradient(135deg,#16a34a 0%,#15803d 100%)',
              color:'white', border:'none', borderRadius:8,
              fontSize:13, fontWeight:700, cursor:'pointer',
              boxShadow:'0 3px 12px rgba(22,163,74,0.40)', transition:'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 18px rgba(22,163,74,0.55)'; e.currentTarget.style.transform='translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow='0 3px 12px rgba(22,163,74,0.40)'; e.currentTarget.style.transform='none' }}>
            ▶ New Run
          </button>
        </div>

        {/* Script title + run column headers */}
        <div style={{ display: 'flex', flexShrink: 0, borderBottom: '2px solid var(--border-strong)', background: 'var(--bg-base-alt)' }}>
          {/* Script info */}
          <div style={{ flex: 1, padding: '18px 28px', minWidth: 0, display: 'flex', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.4px' }}>{script?.name}</h2>
              {script?.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{script.description}</p>}
            </div>
          </div>

          {/* Run columns */}
          <div style={{ display: 'flex', flexShrink: 0 }}>
            {runs.map(run => {
              const isActive = activeRunId === run.id
              const isCompleted = run.status === 'completed'
              const st = getScriptStats(scriptId, run.id)
              return (
                <div key={run.id}
                  onClick={() => handleSelectRun(run.id)}
                  style={{
                    width: 136, padding: '12px 14px 10px', borderLeft: '1px solid var(--border)',
                    cursor: 'pointer', userSelect: 'none', position: 'relative', overflow: 'hidden',
                    background: isActive ? 'var(--accent-muted)' : 'transparent',
                    borderTop: isActive ? '3px solid var(--accent)' : isCompleted ? '3px solid #16a34a' : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                  {/* Completed watermark */}
                  {isCompleted && (
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:1 }}>
                      <span style={{ fontSize:9.5, fontWeight:900, color:'rgba(34,197,94,0.18)', letterSpacing:'0.15em', textTransform:'uppercase', transform:'rotate(-30deg)', whiteSpace:'nowrap' }}>
                        COMPLETE
                      </span>
                    </div>
                  )}

                  {/* Run number badge */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ background: isActive ? 'var(--accent)' : 'var(--bg-depth)', borderRadius:6, padding:'2px 9px' }}>
                      <span style={{ fontSize:12, fontWeight:700, color: isActive ? 'white' : 'var(--text-secondary)', letterSpacing:'0.04em' }}>RUN {run.number}</span>
                    </div>
                  </div>

                  {/* Tester */}
                  <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-muted)', marginBottom:2 }}>Tester</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:8 }}>{run.tester}</div>

                  {/* Date + Build in a row */}
                  <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-muted)', marginBottom:2 }}>Date</div>
                      <div style={{ fontSize:12, color:'var(--text-body)', whiteSpace:'nowrap' }}>{run.date}</div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, color:'var(--accent-hover)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:14 }}>{run.build || '—'}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height:5, background:'var(--border-track)', borderRadius:3, overflow:'hidden', display:'flex', marginBottom:5 }}>
                    {st.pass > 0    && <div style={{ flex: st.pass,    background: '#22c55e' }} />}
                    {st.fail > 0    && <div style={{ flex: st.fail,    background: '#ef4444' }} />}
                    {st.blocked > 0 && <div style={{ flex: st.blocked, background: '#f59e0b' }} />}
                    {st.total - st.pass - st.fail - st.blocked > 0 && <div style={{ flex: st.total - st.pass - st.fail - st.blocked, background:'var(--border-track)' }} />}
                  </div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:8 }}>{st.done}/{st.total} &nbsp;<span style={{ color:'var(--text-muted)', fontWeight:400 }}>{st.pct}%</span></div>

                  {/* Toggle panel button — always visible when run is active */}
                  {isActive && (
                    <button onClick={e => { e.stopPropagation(); setPanelVisible(v => !v) }}
                      style={{
                        background: panelVisible ? 'var(--bg-depth)' : 'var(--accent-muted)',
                        border: panelVisible ? '1px solid var(--border)' : '1px solid var(--border-accent)',
                        borderRadius:6, cursor:'pointer',
                        color: panelVisible ? 'var(--text-muted)' : 'var(--accent-hover)',
                        fontSize:11, fontWeight:600, padding:'4px 8px', marginBottom:6,
                        display:'block', width:'100%', textAlign:'center', transition:'all 0.12s',
                      }}>
                      {panelVisible ? '× Close Panel' : '▶ Open Panel'}
                    </button>
                  )}

                  {/* Remove button */}
                  <button onClick={e => { e.stopPropagation(); if (confirm('Delete run?')) { deleteTestRun(planId, run.id); if (activeRunId === run.id) { setActiveRunId(null); setActiveRowId(null) } reload() } }}
                    style={{ background:'none', border:'1px solid var(--border)', borderRadius:5, cursor:'pointer', color:'var(--text-muted)', fontSize:11, padding:'3px 8px', display:'block', width:'100%', textAlign:'center', transition:'all 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.1)'; e.currentTarget.style.color='#f87171'; e.currentTarget.style.borderColor='rgba(239,68,68,0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.borderColor='var(--border)' }}>
                    ✕ Remove
                  </button>
                </div>
              )
            })}

            {/* + add run button */}
            <div style={{ width: 52, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 16, borderLeft: '1px solid var(--border)' }}>
              <button onClick={() => setAddingRun(true)}
                style={{ width:32, height:32, borderRadius:8, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.3)', cursor:'pointer', color:'#22c55e', fontSize:22, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.14s' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(34,197,94,0.22)' }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(34,197,94,0.12)' }}
                title="Add test run">+</button>
            </div>
          </div>
        </div>

        {/* ── Rows ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* Hint when no runs */}
          {runs.length === 0 && (
            <div style={{ margin: '16px 24px', padding: '12px 16px', background: 'var(--accent-soft)', border: '1px solid var(--accent-glow)', borderRadius: 8, fontSize: 12, color: 'var(--accent-hover)' }}>
              💡 Click <strong>▶ New Run</strong> at the top to add a test run, then click the run column to start marking results.
            </div>
          )}

          {rows.map((row, idx) => {
            const isHeading = row.type === 'heading'
            const isActiveRow = activeRowId === row.id
            const num = String(idx + 1).padStart(4, '0')

            return (
              <div key={row.id}
                onContextMenu={e => handleRowCtx(e, row.id)}
                onClick={() => { if (!isHeading) { if (activeRunId) handleCellClick(activeRunId, row.id); else setActiveRowId(row.id) } }}
                style={{
                  display: 'flex', alignItems: 'center',
                  borderBottom: '1px solid var(--border)',
                  minHeight: isHeading ? 44 : 40,
                  cursor: isHeading ? 'default' : 'pointer',
                  background: isHeading
                    ? 'var(--bg-elevated)'
                    : isActiveRow ? 'rgba(99,102,241,0.18)' : 'transparent',
                  borderLeft: !isHeading && isActiveRow ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'background 0.1s, border-color 0.1s',
                }}
                onMouseEnter={e => { if (!isActiveRow && !isHeading) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (!isActiveRow && !isHeading) e.currentTarget.style.background = 'transparent'; else if (isActiveRow) e.currentTarget.style.background = 'rgba(99,102,241,0.18)' }}>

                {/* Row number */}
                <div style={{ width: 58, padding: '0 10px 0 16px', fontSize: 11.5, color: 'var(--text-dim)', fontFamily: 'monospace', flexShrink: 0, textAlign: 'right' }}>
                  {num}
                </div>

                {/* Test case icon — left click opens menu */}
                <div style={{ width: 26, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {!isHeading && (
                    <div
                      onClick={e => { e.stopPropagation(); const x=Math.min(e.clientX,window.innerWidth-200-8); const y=Math.min(e.clientY,window.innerHeight-200-8); setRowMenu({ x, y, rowId: row.id }) }}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3, borderRadius: 4 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-depth)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <FileText size={14} color="var(--text-secondary)" strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                {/* Title + detail trigger */}
                <div style={{ flex: 1, padding: '0 14px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editingRowId === row.id ? (
                    <input autoFocus value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => { if (editTitle.trim()) updateRow(scriptId, row.id, { title: editTitle.trim() }); setEditingRowId(null); reload() }}
                      onKeyDown={e => { if (e.key === 'Enter') { if (editTitle.trim()) updateRow(scriptId, row.id, { title: editTitle.trim() }); setEditingRowId(null); reload() } if (e.key === 'Escape') setEditingRowId(null) }}
                      style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '2px solid var(--accent)', outline: 'none', fontSize: 14, color: 'var(--text-primary)', padding: '2px 0' }} />
                  ) : (
                    <>
                      <span
                        onDoubleClick={() => { setEditingRowId(row.id); setEditTitle(row.title) }}
                        style={{
                          fontSize: isHeading ? 14 : 14,
                          fontWeight: isHeading ? 700 : 400,
                          color: isHeading ? 'var(--text-primary)' : 'var(--text-body)',
                          flex: 1, lineHeight: 1.5,
                          letterSpacing: isHeading ? '0.01em' : 'normal',
                        }}>
                        {isHeading ? row.title : (row.number ? `${row.number}: ${row.title}` : row.title)}
                      </span>
                      {!isHeading && (
                        <button
                          onClick={e => { e.stopPropagation(); openDetail(row.id) }}
                          title="Test case details (D)"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 16, lineHeight: 1, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                            color: detailRowId === row.id ? 'var(--accent)' : 'var(--text-secondary)',
                            transition: 'color 0.15s',
                          }}
                          onMouseEnter={e => { if (detailRowId !== row.id) e.currentTarget.style.color = 'var(--text-primary)' }}
                          onMouseLeave={e => { if (detailRowId !== row.id) e.currentTarget.style.color = 'var(--text-secondary)' }}>
                          ≡
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Result cells per run */}
                {runs.map(run => {
                  if (isHeading) {
                    return <div key={run.id} style={{ width: 136, height: 44, borderLeft: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-elevated)' }} />
                  }
                  const res = resultsMap[run.id]?.[row.id]
                  const st = res?.status && res.status !== 'not_run' ? STATUS_ICONS[res.status] : null
                  const isCellActive = activeRunId === run.id && activeRowId === row.id
                  return (
                    <div key={run.id}
                      onClick={e => { e.stopPropagation(); handleCellClick(run.id, row.id) }}
                      style={{
                        width: 136, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderLeft: '1px solid var(--border-subtle)', cursor: 'pointer', flexShrink: 0,
                        background: isCellActive ? 'var(--accent-muted)' : activeRunId === run.id ? 'var(--accent-subtle)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isCellActive) e.currentTarget.style.background = 'var(--border-mid)' }}
                      onMouseLeave={e => { if (!isCellActive) e.currentTarget.style.background = isCellActive ? 'var(--accent-muted)' : activeRunId === run.id ? 'var(--accent-subtle)' : 'transparent' }}>
                      {st && <span style={{ fontSize: 18, color: st.color, fontWeight: 700, lineHeight: 1 }}>{st.icon}</span>}
                    </div>
                  )
                })}

                {/* Spacer for + column */}
                <div style={{ width: 52, flexShrink: 0 }} />
              </div>
            )
          })}

          {/* Add new row input */}
          <div style={{ display: 'flex', alignItems: 'center', minHeight: 42, borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ width: 58, padding: '0 10px 0 16px', fontSize: 11.5, color: 'var(--text-dim)', fontFamily: 'monospace', flexShrink: 0, textAlign: 'right' }}>
              {String(rows.length + 1).padStart(4, '0')}
            </div>
            <div style={{ width: 26, flexShrink: 0 }} />
            <input ref={addInputRef} value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={handleAddRow}
              placeholder="Type test case title and press Enter..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-secondary)', padding: '8px 14px' }} />
          </div>

          {/* Tip */}
          <div style={{ padding: '14px 28px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 2 }}>
            <div>• Press <strong style={{ color: 'var(--text-body)' }}>Enter</strong> to add a new row</div>
            <div>• <strong style={{ color: 'var(--text-body)' }}>Double-click</strong> any row to edit text</div>
            <div>• <strong style={{ color: 'var(--text-body)' }}>Right-click</strong> any row → <strong style={{ color: 'var(--text-body)' }}>"Make Heading"</strong> to turn it into a section heading</div>
            <div>• Click a <strong style={{ color: 'var(--text-muted)' }}>run column</strong> to select it, then click any row to mark result</div>
            <div>• Click the <strong style={{ color: 'var(--text-muted)' }}>▭ icon</strong> or press <strong style={{ color: 'var(--text-muted)' }}>D</strong> to open the detail panel for a test case</div>
          </div>
        </div>
      </div>

      {/* ══ RIGHT PANEL (TestPad-style floating) ══ */}
      {panelOpen && (
        <div style={{
          width: 365,
          flexShrink: 0,
          alignSelf: 'flex-start',
          position: 'relative',
          zIndex: 91,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--bg-elevated)',
          borderLeft: '2px solid var(--border-strong)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.22)',
          maxHeight: '100%',
        }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', borderBottom:'1px solid var(--border)', flexShrink:0, background:'var(--bg-depth)' }}>
            <span style={{ fontSize:12, fontWeight:800, color:'var(--text-primary)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
              Testing Run {activeRun?.number}
            </span>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <button onClick={() => setPanelVisible(false)}
                style={{ background:'var(--bg-surface)', border:'1px solid var(--border-mid)', borderRadius:5, cursor:'pointer', color:'var(--text-secondary)', fontSize:11, fontWeight:600, padding:'4px 10px', transition:'all 0.13s' }}
                onMouseEnter={e => { e.currentTarget.style.background='#ef4444'; e.currentTarget.style.color='white'; e.currentTarget.style.borderColor='#ef4444' }}
                onMouseLeave={e => { e.currentTarget.style.background='var(--bg-surface)'; e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.borderColor='var(--border-mid)' }}>
                close
              </button>
              <span style={{ fontSize:10.5, color:'var(--text-muted)', background:'var(--bg-surface)', border:'1px solid var(--border-mid)', borderRadius:4, padding:'4px 7px', fontWeight:600, letterSpacing:'0.04em' }}>ESC</span>
            </div>
          </div>

          {/* Stats + progress bar */}
          {topStats && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px 5px', flexShrink:0 }}>
                <span style={{ fontSize:12, color:'#22c55e', fontWeight:700 }}>● {topStats.pass}</span>
                <span style={{ fontSize:12, color:'#ef4444', fontWeight:700 }}>● {topStats.fail}</span>
                <span style={{ fontSize:12, color:'#f59e0b', fontWeight:700 }}>● {topStats.blocked}</span>
                <span style={{ fontSize:12, color:'#3b82f6', fontWeight:700 }}>● {topStats.query}</span>
                <span style={{ flex:1 }} />
                <span style={{ fontSize:12, color:'var(--text-body)', fontWeight:600 }}>{topStats.done}/{topStats.total}</span>
                <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:500 }}>{topStats.pct}%</span>
              </div>
              <div style={{ height:4, background:'var(--border-track)', margin:'0 14px 10px', borderRadius:2, overflow:'hidden', display:'flex', flexShrink:0 }}>
                {topStats.pass > 0    && <div style={{ flex:topStats.pass,    background:'#22c55e' }} />}
                {topStats.fail > 0    && <div style={{ flex:topStats.fail,    background:'#ef4444' }} />}
                {topStats.blocked > 0 && <div style={{ flex:topStats.blocked, background:'#f59e0b' }} />}
                {(topStats.total - topStats.pass - topStats.fail - topStats.blocked) > 0 && <div style={{ flex:topStats.total - topStats.pass - topStats.fail - topStats.blocked, background:'var(--border-track)' }} />}
              </div>
            </>
          )}

          {/* IN PROGRESS / COMPLETED tabs */}
          <div style={{ display:'flex', margin:'0 14px 10px', borderRadius:7, overflow:'hidden', border:'1px solid var(--border-mid)', flexShrink:0 }}>
            <button onClick={markRunInProgress}
              style={{ flex:1, padding:'8px', fontSize:11, fontWeight:700, cursor:'pointer', border:'none', transition:'all 0.15s',
                background: !runIsCompleted ? '#16a34a' : 'var(--bg-depth)',
                color: !runIsCompleted ? 'white' : 'var(--text-secondary)',
              }}>
              IN PROGRESS
            </button>
            <button onClick={markRunCompleted}
              style={{ flex:1, padding:'8px', fontSize:11, fontWeight:700, cursor:'pointer', border:'none', borderLeft:'1px solid var(--border-mid)', transition:'all 0.15s',
                background: runIsCompleted ? '#16a34a' : 'var(--bg-depth)',
                color: runIsCompleted ? 'white' : 'var(--text-secondary)',
              }}>
              COMPLETED
            </button>
          </div>

          {/* Scrollable content */}
          <div style={{ overflowY:'auto', display:'flex', flexDirection:'column' }}>
            {runIsCompleted ? (
              /* ── COMPLETED view ── */
              <div style={{ padding:'0 14px 16px', display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ background:'var(--bg-depth)', borderRadius:8, padding:'14px', border:'1px solid var(--border-mid)' }}>
                  <p style={{ fontSize:13, color:'var(--text-body)', margin:'0 0 12px', lineHeight:1.65, fontStyle:'italic' }}>
                    This test run has been marked &apos;completed&apos;, finalising the results.
                  </p>
                  <button onClick={generatePDF}
                    style={{ width:'100%', padding:'9px', background:'var(--bg-surface)', color:'var(--text-primary)', border:'1px solid var(--border-strong)', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:'pointer', transition:'all 0.13s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-accent)'; e.currentTarget.style.color='var(--accent-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-strong)'; e.currentTarget.style.color='var(--text-primary)' }}>
                    view the test report
                  </button>
                </div>
                <div style={{ background:'var(--bg-depth)', borderRadius:8, padding:'14px', border:'1px solid var(--border-mid)' }}>
                  <p style={{ fontSize:13, color:'var(--text-body)', margin:'0 0 12px', lineHeight:1.65, fontStyle:'italic' }}>
                    If further testing is required, or a change needs to be recorded, please put it back into &apos;in progress&apos;.
                  </p>
                  <button onClick={markRunInProgress}
                    style={{ width:'100%', padding:'9px', background:'var(--bg-surface)', color:'var(--text-primary)', border:'1px solid var(--border-strong)', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:'pointer', transition:'all 0.13s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-accent)'; e.currentTarget.style.color='var(--accent-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-strong)'; e.currentTarget.style.color='var(--text-primary)' }}>
                    go back to in-progress
                  </button>
                </div>
                <div style={{ background:'var(--bg-depth)', borderRadius:8, padding:'14px', border:'1px solid var(--border-mid)' }}>
                  <p style={{ fontSize:13, color:'var(--text-body)', margin:'0 0 12px', lineHeight:1.65, fontStyle:'italic' }}>
                    Alternatively, use the Retest option if you want to prepare for a re-run of this test run, for example on a new build.
                  </p>
                  <button onClick={() => setAddingRun(true)}
                    style={{ width:'100%', padding:'9px', background:'var(--bg-surface)', color:'var(--text-primary)', border:'1px solid var(--border-strong)', borderRadius:7, fontSize:12.5, fontWeight:600, cursor:'pointer', transition:'all 0.13s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-accent)'; e.currentTarget.style.color='var(--accent-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-strong)'; e.currentTarget.style.color='var(--text-primary)' }}>
                    start a retest
                  </button>
                </div>
              </div>
            ) : (
              /* ── IN PROGRESS view ── */
              <>
                {activeRow && activeRow.type === 'case' && (
                  <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
                    <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:4, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Testing:</div>
                    <p style={{ fontSize:12.5, color:'var(--text-body)', margin:0, lineHeight:1.5 }}>
                      {activeRow.number ? `${activeRow.number}: ` : ''}{activeRow.title}
                    </p>
                    {activeResult && activeResult.status !== 'not_run' && (
                      <div style={{ marginTop:6, fontSize:10, padding:'3px 8px', borderRadius:5, display:'inline-block', fontWeight:700, textTransform:'uppercase',
                        background: activeResult.status==='pass' ? 'rgba(34,197,94,0.15)' : activeResult.status==='fail' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: activeResult.status==='pass' ? '#22c55e' : activeResult.status==='fail' ? '#ef4444' : '#f59e0b',
                      }}>
                        Current: {activeResult.status}
                      </div>
                    )}
                  </div>
                )}
                {!activeRow && (
                  <div style={{ padding:'16px 14px', fontSize:12, color:'var(--text-muted)', fontStyle:'italic' }}>
                    Click a test case row to start marking results.
                  </div>
                )}

                {/* Comments */}
                <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
                  <label style={{ fontSize:10, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6, display:'block' }}>COMMENTS</label>
                  <textarea value={panelComment} onChange={e => setPanelComment(e.target.value)} onBlur={savePanelNote}
                    placeholder="enter any comments here"
                    rows={3}
                    style={{ width:'100%', padding:'7px 10px', background:'var(--bg-depth)', border:'1px solid var(--border-mid)', borderRadius:6, fontSize:12, color:'var(--text-body)', resize:'none', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                </div>

                {/* Bug tracking */}
                <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>BUG TRACKING</label>
                  <input value={panelBugId} onChange={e => setPanelBugId(e.target.value)} onBlur={savePanelNote}
                    placeholder="enter a bug number here"
                    style={{ width:'100%', padding:'7px 10px', background:'var(--bg-depth)', border:'1px solid var(--border-mid)', borderRadius:6, fontSize:12, color:'var(--text-body)', outline:'none', boxSizing:'border-box' }} />
                </div>

                {/* Action buttons */}
                <div style={{ padding:'12px 14px', flexShrink:0 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                    <button onClick={() => handlePanelStatus('pass')}
                      style={{ padding:'11px', background:'#16a34a', color:'white', border:'none', borderRadius:7, fontSize:14, fontWeight:700, cursor:'pointer', letterSpacing:'0.03em' }}>
                      PASS ✓
                    </button>
                    <button onClick={() => handlePanelStatus('fail')}
                      style={{ padding:'11px', background:'#dc2626', color:'white', border:'none', borderRadius:7, fontSize:14, fontWeight:700, cursor:'pointer', letterSpacing:'0.03em' }}>
                      FAIL ✗
                    </button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8 }}>
                    {([
                      { s:'blocked' as TestStatus, label:'BLOCKED', color:'#f59e0b', border:'rgba(245,158,11,0.3)' },
                      { s:'query'   as TestStatus, label:'QUERY',   color:'#3b82f6', border:'rgba(59,130,246,0.3)' },
                      { s:'exclude' as TestStatus, label:'EXCLUDE', color:'#64748b', border:'rgba(100,116,139,0.3)' },
                    ] as const).map(({ s, label, color, border }) => (
                      <button key={s} onClick={() => handlePanelStatus(s)}
                        style={{ padding:'7px 4px', background:'var(--bg-depth)', color, border:`1px solid ${border}`, borderRadius:6, fontSize:10.5, fontWeight:700, cursor:'pointer', textTransform:'uppercase' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <button onClick={() => handlePanelNav('prev')}
                      style={{ padding:'9px', background:'var(--bg-depth)', color:'var(--text-secondary)', border:'1px solid var(--border-mid)', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.13s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-accent)'; e.currentTarget.style.color='var(--text-primary)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-mid)'; e.currentTarget.style.color='var(--text-secondary)' }}>
                      ◀ PREV
                    </button>
                    <button onClick={() => handlePanelNav('next')}
                      style={{ padding:'9px', background:'var(--bg-depth)', color:'var(--text-secondary)', border:'1px solid var(--border-mid)', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.13s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-accent)'; e.currentTarget.style.color='var(--text-primary)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-mid)'; e.currentTarget.style.color='var(--text-secondary)' }}>
                      NEXT ▶
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ DETAIL PANEL ══ */}
      {detailRowId && (() => {
        const detailRow = rows.find(r => r.id === detailRowId)
        const fields: { key: keyof TestCaseDetail; label: string; rows: number; placeholder: string }[] = [
          { key: 'preConditions', label: 'Pre-Conditions',  rows: 3, placeholder: 'e.g. User must be logged in, feature flag enabled...' },
          { key: 'steps',         label: 'Test Steps',      rows: 5, placeholder: 'e.g. 1. Navigate to...\n2. Click...\n3. Verify...' },
          { key: 'expected',      label: 'Expected Result', rows: 3, placeholder: 'e.g. The page should show a success message...' },
          { key: 'actual',        label: 'Actual Result',   rows: 3, placeholder: 'e.g. The page shows an error instead...' },
          { key: 'notes',         label: 'Notes',           rows: 2, placeholder: 'e.g. Only reproducible on Safari...' },
        ]
        return (
          <>
          {/* Backdrop */}
          <div onClick={closeDetail} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
          <div style={{
            position: 'fixed', top: 'var(--topnav-height)', right: panelOpen ? 365 : 0,
            width: 340, height: 'calc(100vh - var(--topnav-height))',
            borderLeft: '1px solid var(--border-mid)',
            background: 'var(--bg-base-alt)',
            display: 'flex', flexDirection: 'column',
            zIndex: 110,
            boxShadow: '-4px 0 24px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            transition: 'right 0.2s ease',
          }}>
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexShrink: 0, background: 'var(--bg-surface)' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Test Case Details
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-body)', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {detailRow?.number ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{detailRow.number}: </span> : ''}{detailRow?.title}
                </p>
              </div>
              <button onClick={closeDetail}
                style={{ background: 'var(--bg-depth)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14, padding: '4px 9px', flexShrink: 0, lineHeight: 1.4, fontWeight: 600 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#ef4444' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-depth)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}>
                ✕
              </button>
            </div>

            {/* Fields */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {fields.map(({ key, label, rows: numRows, placeholder }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                    {label}
                  </label>
                  <textarea
                    value={detail[key]}
                    onChange={e => updateDetailField(key, e.target.value)}
                    placeholder={placeholder}
                    rows={numRows}
                    style={{
                      width: '100%', padding: '8px 10px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 7,
                      fontSize: 12, color: 'var(--text-body)',
                      resize: 'vertical', outline: 'none',
                      fontFamily: 'inherit', lineHeight: 1.55,
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  />
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-subtle)', fontSize: 10, color: 'var(--text-dimmer)', display: 'flex', justifyContent: 'space-between' }}>
              <span>auto-saved</span>
              <span>Esc to close</span>
            </div>
          </div>
          </>
        )
      })()}

      {/* Right-click menu (portalled to body so position:fixed is always viewport-relative) */}
      {rowMenu && createPortal(
        <>
          <div onClick={() => setRowMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 9490 }} />
          <div
            data-rowmenu
            style={{
              position: 'fixed',
              left: rowMenu.x,
              top: rowMenu.y,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 10,
              padding: '5px 0',
              minWidth: 200,
              zIndex: 9500,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)',
            }}>
            {/* Only show TC number if available */}
            {rows.find(r => r.id === rowMenu.rowId)?.number && (
              <div style={{ padding: '5px 14px 8px', fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                {rows.find(r => r.id === rowMenu.rowId)?.number}
              </div>
            )}

            {rows.find(r => r.id === rowMenu.rowId)?.type === 'case' ? (
              <>
                <MenuItem icon="⊡" label="Open details" onClick={() => { openDetail(rowMenu.rowId); setRowMenu(null) }} />
                <MenuItem icon="≡" label="Make Heading" onClick={() => makeHeading(rowMenu.rowId)} />
              </>
            ) : (
              <MenuItem icon="☐" label="Make Test Case" onClick={() => makeCase(rowMenu.rowId)} />
            )}
            <MenuItem
              icon="✎"
              label="Edit text"
              onClick={() => { const r = rows.find(x => x.id === rowMenu.rowId); if (r) { setEditingRowId(r.id); setEditTitle(r.title) } setRowMenu(null) }}
            />

            {/* Separator before danger zone */}
            <div style={{ height: 1, background: 'var(--border)', margin: '5px 0' }} />
            <MenuItem icon="✕" label="Delete row" onClick={() => { deleteRow(scriptId, rowMenu.rowId); setRowMenu(null); reload() }} danger />
          </div>
        </>,
        document.body
      )}

      {/* New Run modal */}
      {addingRun && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 24, width: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 18px' }}>Start New Test Run</h3>
            <form onSubmit={handleAddRun} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Tester Name</label>
                <input autoFocus value={runTester} onChange={e => setRunTester(e.target.value)}
                  placeholder="e.g. Hamdan - QA"
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setAddingRun(false)}
                  style={{ padding: '8px 16px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit"
                  style={{ padding: '8px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Start Run
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const mi: React.CSSProperties = { padding: '8px 16px', fontSize: 13, color: 'var(--text-body)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.1s' }

function MenuItem({ icon, label, onClick, danger = false }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px',
        cursor: 'pointer',
        borderRadius: 6,
        margin: '0 4px',
        background: hovered ? (danger ? 'rgba(239,68,68,0.1)' : 'var(--bg-hover)') : 'transparent',
        color: danger ? (hovered ? '#f87171' : '#ef4444') : (hovered ? 'var(--text-primary)' : 'var(--text-body)'),
        fontSize: 13,
        fontWeight: 500,
        transition: 'background 0.12s, color 0.12s',
        userSelect: 'none',
      }}>
      <span style={{ fontSize: 14, width: 18, textAlign: 'center', opacity: 0.8 }}>{icon}</span>
      {label}
    </div>
  )
}

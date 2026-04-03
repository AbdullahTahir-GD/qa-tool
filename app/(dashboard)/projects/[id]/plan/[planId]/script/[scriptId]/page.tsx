'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import {
  getScripts, getRows, saveRow, updateRow, deleteRow,
  getTestRuns, saveTestRun, deleteTestRun,
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
    const run = saveTestRun(planId, runTester.trim() || 'anyone', runBuild.trim() || '-')
    setRunTester(''); setRunBuild(''); setAddingRun(false)
    reload()
    // auto-select the new run
    setActiveRunId(run.id)
  }

  // ── Click run column header → select it + open panel on first untested case ──
  const handleSelectRun = (runId: string) => {
    if (activeRunId === runId) {
      setActiveRunId(null); setActiveRowId(null)
      return
    }
    setActiveRunId(runId)
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
      if (e.key === 'Escape' && detailRowId) closeDetail()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeRowId, detailRowId, rows, detail])

  // ── Row right-click menu ──
  const handleRowCtx = (e: React.MouseEvent, rowId: string) => {
    e.preventDefault(); e.stopPropagation()
    setRowMenu({ x: e.clientX, y: e.clientY, rowId })
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
  const panelOpen = !!activeRunId && !!activeRowId && activeRow?.type === 'case'

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
      height: 'calc(100vh - 56px - 40px)',
      overflow: 'hidden',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-strong)',
      borderRadius: 12,
      boxShadow: '0 2px 20px rgba(0,0,0,0.10)',
    }}>

      {/* ══ MAIN ══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'var(--bg-base-alt)', borderBottom: '1px solid var(--border-strong)', flexShrink: 0, borderRadius: '12px 12px 0 0' }}>
          <button onClick={() => router.push(`/projects/${id}/plan/${planId}`)}
            style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 0' }}>
            ← Back to plan
          </button>
          <div style={{ width: 1, height: 14, background: 'var(--border-strong)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{script?.name}</span>
          {topStats && activeRunId && (
            <>
              <div style={{ width: 1, height: 14, background: 'var(--border-strong)' }} />
              <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>● {topStats.pass}</span>
              <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>● {topStats.fail}</span>
              <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>● {topStats.blocked}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{topStats.done}/{topStats.total} ({topStats.pct}%)</span>
            </>
          )}
          <div style={{ flex: 1 }} />
          {runs.length > 0 && (
            <button onClick={generatePDF}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: 'var(--bg-depth)', color: 'var(--text-secondary)', border: '1px solid var(--border-mid)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ↓ Download Report
            </button>
          )}
          <button onClick={() => setAddingRun(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ▶ New Run
          </button>
        </div>

        {/* Script title + run column headers */}
        <div style={{ display: 'flex', flexShrink: 0, borderBottom: '2px solid var(--border-strong)', background: 'var(--bg-base-alt)' }}>
          {/* Script info */}
          <div style={{ flex: 1, padding: '16px 24px', minWidth: 0 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{script?.name}</h2>
            {script?.description && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{script.description}</p>}
          </div>

          {/* Run columns */}
          <div style={{ display: 'flex', flexShrink: 0 }}>
            {runs.map(run => {
              const isActive = activeRunId === run.id
              const st = getScriptStats(scriptId, run.id)
              return (
                <div key={run.id}
                  onClick={() => handleSelectRun(run.id)}
                  style={{
                    width: 110, padding: '10px 12px', borderLeft: '1px solid var(--border)',
                    cursor: 'pointer', userSelect: 'none',
                    background: isActive ? 'var(--accent-muted)' : 'transparent',
                    borderTop: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginBottom: 1 }}>number</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{run.number}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 4 }}>tester</div>
                  <div style={{ fontSize: 11, color: 'var(--text-body-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.tester}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3 }}>date</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-body-dim)' }}>{run.date}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3 }}>build</div>
                  <div style={{ fontSize: 10.5, color: 'var(--accent-hover)' }}>{run.build}</div>
                  {/* mini progress */}
                  <div style={{ marginTop: 8, height: 3, background: 'var(--border-track)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                    {st.pass > 0 && <div style={{ flex: st.pass, background: '#22c55e' }} />}
                    {st.fail > 0 && <div style={{ flex: st.fail, background: '#ef4444' }} />}
                    {st.blocked > 0 && <div style={{ flex: st.blocked, background: '#f59e0b' }} />}
                    {st.total - st.pass - st.fail - st.blocked > 0 && <div style={{ flex: st.total - st.pass - st.fail - st.blocked, background: 'var(--border-track)' }} />}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, textAlign: 'center' }}>{st.done}/{st.total} {st.pct}%</div>
                  <button onClick={e => { e.stopPropagation(); if (confirm('Delete run?')) { deleteTestRun(planId, run.id); if (activeRunId === run.id) { setActiveRunId(null); setActiveRowId(null) } reload() } }}
                    style={{ marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10, padding: 0, display: 'block', width: '100%', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                    ✕ remove
                  </button>
                </div>
              )
            })}

            {/* + add run button */}
            <div style={{ width: 44, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 16, borderLeft: '1px solid var(--border)' }}>
              <button onClick={() => setAddingRun(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', fontSize: 22, lineHeight: 1, padding: 4 }}
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
            const isActiveRow = activeRowId === row.id && activeRunId
            const num = String(idx + 1).padStart(4, '0')

            return (
              <div key={row.id}
                onContextMenu={e => handleRowCtx(e, row.id)}
                style={{
                  display: 'flex', alignItems: 'center',
                  borderBottom: '1px solid var(--border)',
                  minHeight: isHeading ? 38 : 34,
                  background: isHeading
                    ? 'var(--bg-row-heading)'
                    : isActiveRow ? 'var(--accent-subtle)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isActiveRow && !isHeading) e.currentTarget.style.background = 'var(--border-subtle)' }}
                onMouseLeave={e => { if (!isActiveRow && !isHeading) e.currentTarget.style.background = 'transparent' }}>

                {/* Row number */}
                <div style={{ width: 52, padding: '0 10px 0 16px', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace', flexShrink: 0, textAlign: 'right' }}>
                  {num}
                </div>

                {/* Test case icon — left click opens menu */}
                <div style={{ width: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {!isHeading && (
                    <div
                      onClick={e => { e.stopPropagation(); setRowMenu({ x: e.clientX, y: e.clientY, rowId: row.id }) }}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2, borderRadius: 3 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <FileText size={13} color="var(--text-muted)" strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                {/* Title + detail trigger */}
                <div style={{ flex: 1, padding: '0 12px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: isHeading ? 'default' : activeRunId ? 'pointer' : 'default' }}
                  onClick={() => { if (!isHeading && activeRunId) handleCellClick(activeRunId, row.id) }}>
                  {editingRowId === row.id ? (
                    <input autoFocus value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => { if (editTitle.trim()) updateRow(scriptId, row.id, { title: editTitle.trim() }); setEditingRowId(null); reload() }}
                      onKeyDown={e => { if (e.key === 'Enter') { if (editTitle.trim()) updateRow(scriptId, row.id, { title: editTitle.trim() }); setEditingRowId(null); reload() } if (e.key === 'Escape') setEditingRowId(null) }}
                      style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', outline: 'none', fontSize: 13, color: 'var(--text-primary)', padding: '2px 0' }} />
                  ) : (
                    <>
                      <span
                        onDoubleClick={() => { setEditingRowId(row.id); setEditTitle(row.title) }}
                        style={{
                          fontSize: 13,
                          fontWeight: isHeading ? 700 : 400,
                          color: isHeading ? 'var(--text-primary)' : 'var(--text-body)',
                          flex: 1, lineHeight: 1.5,
                        }}>
                        {isHeading ? row.title : (row.number ? `${row.number}: ${row.title}` : row.title)}
                      </span>
                      {!isHeading && (
                        <button
                          onClick={e => { e.stopPropagation(); openDetail(row.id) }}
                          title="Test case details (D)"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 13, lineHeight: 1, padding: '2px 4px', borderRadius: 3, flexShrink: 0,
                            color: detailRowId === row.id ? 'var(--accent)' : 'var(--text-dimmer)',
                            transition: 'color 0.15s',
                          }}
                          onMouseEnter={e => { if (detailRowId !== row.id) e.currentTarget.style.color = 'var(--text-muted)' }}
                          onMouseLeave={e => { if (detailRowId !== row.id) e.currentTarget.style.color = 'var(--text-dimmer)' }}>
                          ≡
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Result cells per run */}
                {runs.map(run => {
                  if (isHeading) {
                    return <div key={run.id} style={{ width: 110, height: 34, borderLeft: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--border-subtle)' }} />
                  }
                  const res = resultsMap[run.id]?.[row.id]
                  const st = res?.status && res.status !== 'not_run' ? STATUS_ICONS[res.status] : null
                  const isCellActive = activeRunId === run.id && activeRowId === row.id
                  return (
                    <div key={run.id}
                      onClick={() => handleCellClick(run.id, row.id)}
                      style={{
                        width: 110, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderLeft: '1px solid var(--border-subtle)', cursor: 'pointer', flexShrink: 0,
                        background: isCellActive ? 'var(--accent-muted)' : activeRunId === run.id ? 'var(--accent-subtle)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isCellActive) e.currentTarget.style.background = 'var(--border-mid)' }}
                      onMouseLeave={e => { if (!isCellActive) e.currentTarget.style.background = isCellActive ? 'var(--accent-muted)' : activeRunId === run.id ? 'var(--accent-subtle)' : 'transparent' }}>
                      {st && <span style={{ fontSize: 16, color: st.color, fontWeight: 700, lineHeight: 1 }}>{st.icon}</span>}
                    </div>
                  )
                })}

                {/* Spacer for + column */}
                <div style={{ width: 44, flexShrink: 0 }} />
              </div>
            )
          })}

          {/* Add new row input */}
          <div style={{ display: 'flex', alignItems: 'center', minHeight: 36, borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ width: 52, padding: '0 10px 0 16px', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace', flexShrink: 0, textAlign: 'right' }}>
              {String(rows.length + 1).padStart(4, '0')}
            </div>
            <div style={{ width: 22, flexShrink: 0 }} />
            <input ref={addInputRef} value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={handleAddRow}
              placeholder="Type test case title and press Enter..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-secondary)', padding: '6px 12px' }} />
          </div>

          {/* Tip */}
          <div style={{ padding: '14px 24px', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.8 }}>
            <div>• Press <strong style={{ color: 'var(--text-muted)' }}>Enter</strong> to add a new row</div>
            <div>• <strong style={{ color: 'var(--text-muted)' }}>Double-click</strong> any row to edit text</div>
            <div>• <strong style={{ color: 'var(--text-muted)' }}>Right-click</strong> any row → <strong style={{ color: 'var(--text-muted)' }}>"Make Heading"</strong> to turn it into a section heading</div>
            <div>• Click a <strong style={{ color: 'var(--text-muted)' }}>run column</strong> to select it, then click any row to mark result</div>
            <div>• Click the <strong style={{ color: 'var(--text-muted)' }}>▭ icon</strong> or press <strong style={{ color: 'var(--text-muted)' }}>D</strong> to open the detail panel for a test case</div>
          </div>
        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      {panelOpen && (
        <div style={{ width: 290, borderLeft: '1px solid var(--border-strong)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Panel header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-base-alt)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: topStats ? 10 : 0 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)', letterSpacing:'-0.2px' }}>
                Testing Run <span style={{ color:'var(--accent)' }}>#{runs.find(r => r.id === activeRunId)?.number}</span>
              </div>
              <button onClick={() => { setActiveRunId(null); setActiveRowId(null) }}
                style={{ background:'var(--bg-depth)', border:'1px solid var(--border-strong)', borderRadius:7,
                  cursor:'pointer', color:'var(--text-secondary)', fontSize:12, fontWeight:600,
                  padding:'5px 12px', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background='#ef4444'; e.currentTarget.style.color='white'; e.currentTarget.style.borderColor='#ef4444' }}
                onMouseLeave={e => { e.currentTarget.style.background='var(--bg-depth)'; e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.borderColor='var(--border-strong)' }}>
                ✕ Close
              </button>
            </div>
            {topStats && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
                {[
                  { label:'Pass',    value: topStats.pass,    color:'#22c55e', bg:'rgba(34,197,94,0.1)' },
                  { label:'Fail',    value: topStats.fail,    color:'#ef4444', bg:'rgba(239,68,68,0.1)' },
                  { label:'Blocked', value: topStats.blocked, color:'#f59e0b', bg:'rgba(245,158,11,0.1)' },
                  { label:`${topStats.pct}%`, value: `${topStats.done}/${topStats.total}`, color:'var(--text-secondary)', bg:'var(--bg-depth)' },
                ].map(({label, value, color, bg}) => (
                  <div key={label} style={{ background:bg, borderRadius:7, padding:'6px 4px', textAlign:'center' }}>
                    <div style={{ fontSize:16, fontWeight:800, color, lineHeight:1 }}>{value}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3, fontWeight:500 }}>{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* IN PROGRESS / COMPLETED toggle */}
          <div style={{ display: 'flex', gap: 0, padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <button style={{ flex: 1, padding: '7px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px 0 0 6px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              IN PROGRESS
            </button>
            <button style={{ flex: 1, padding: '7px', background: 'var(--bg-depth)', color: 'var(--text-secondary)', border: '1px solid var(--border-mid)', borderLeft: 'none', borderRadius: '0 6px 6px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              COMPLETED
            </button>
          </div>

          {/* Active row title */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Testing:</div>
            <p style={{ fontSize: 12, color: 'var(--text-body)', margin: 0, lineHeight: 1.5 }}>
              {activeRow?.number ? `${activeRow.number}: ` : ''}{activeRow?.title}
            </p>
            {activeResult && activeResult.status !== 'not_run' && (
              <div style={{ marginTop: 6, fontSize: 10, padding: '3px 8px', borderRadius: 5, display: 'inline-block', background: activeResult.status === 'pass' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: activeResult.status === 'pass' ? '#22c55e' : '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>
                Current: {activeResult.status}
              </div>
            )}
          </div>

          {/* Comments */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>COMMENTS</label>
            </div>
            <textarea value={panelComment} onChange={e => setPanelComment(e.target.value)} onBlur={savePanelNote}
              placeholder="enter any comments here"
              rows={3}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-depth)', border: '1px solid var(--border-mid)', borderRadius: 6, fontSize: 12, color: 'var(--text-body)', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          {/* Bug tracking */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>BUG TRACKING</label>
            <input value={panelBugId} onChange={e => setPanelBugId(e.target.value)} onBlur={savePanelNote}
              placeholder="enter a bug number here"
              style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-depth)', border: '1px solid var(--border-mid)', borderRadius: 6, fontSize: 12, color: 'var(--text-body)', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* PASS / FAIL buttons */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <button onClick={() => handlePanelStatus('pass')}
                style={{ padding: '11px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.03em' }}>
                PASS ✓
              </button>
              <button onClick={() => handlePanelStatus('fail')}
                style={{ padding: '11px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.03em' }}>
                FAIL ✗
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[
                { s: 'blocked' as TestStatus, label: 'BLOCKED', bg: 'var(--bg-depth)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
                { s: 'query' as TestStatus,   label: 'QUERY',   bg: 'var(--bg-depth)', color: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
                { s: 'exclude' as TestStatus, label: 'EXCLUDE', bg: 'var(--bg-depth)', color: '#64748b', border: 'rgba(100,116,139,0.3)' },
              ].map(({ s, label, bg, color, border }) => (
                <button key={s} onClick={() => handlePanelStatus(s)}
                  style={{ padding: '7px 4px', background: bg, color, border: `1px solid ${border}`, borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* PREV / NEXT */}
          <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flexShrink: 0, marginTop: 'auto' }}>
            <button onClick={() => handlePanelNav('prev')}
              style={{ padding: '9px', background: 'var(--bg-depth)', color: 'var(--text-secondary)', border: '1px solid var(--border-mid)', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ◀ PREV
            </button>
            <button onClick={() => handlePanelNav('next')}
              style={{ padding: '9px', background: 'var(--bg-depth)', color: 'var(--text-secondary)', border: '1px solid var(--border-mid)', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              NEXT ▶
            </button>
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
            position: 'fixed', top: 'var(--topnav-height)', right: 0,
            width: 340, height: 'calc(100vh - var(--topnav-height))',
            borderLeft: '1px solid var(--border-mid)',
            background: 'var(--bg-base-alt)',
            display: 'flex', flexDirection: 'column',
            zIndex: 110,
            boxShadow: '-4px 0 24px rgba(0,0,0,0.25)',
            overflow: 'hidden',
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

      {/* Right-click menu */}
      {rowMenu && (
        <>
          <div onClick={() => setRowMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 490 }} />
          <div
            data-rowmenu
            style={{
              position: 'fixed',
              left: rowMenu.x + 2,
              top: rowMenu.y + 2,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 10,
              padding: '5px 0',
              minWidth: 200,
              zIndex: 500,
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
        </>
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
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Build / Version</label>
                <input value={runBuild} onChange={e => setRunBuild(e.target.value)}
                  placeholder="e.g. v1.17.0"
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

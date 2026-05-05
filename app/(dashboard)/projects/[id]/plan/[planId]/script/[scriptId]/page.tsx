'use client'
import React, { useEffect, useState, useRef, useCallback, memo, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import {
  getScripts, getRows, saveRow, insertRowBefore, updateRow, deleteRow,
  getTestRuns, saveTestRun, deleteTestRun, updateTestRun,
  getResult, setResult, getResults,
  getDetail, saveDetail, generateId, computeStats, sumStats, peekCache, invalidateCache,
  type Stats, type Script, type TestRow, type TestRun, type TestStatus, type TestResult, type TestCaseDetail
} from '@/lib/db'
import { supabase } from '@/lib/supabase'

// ── DetailPanel ─────────────────────────────────────────────────────────────
// Extracted into its own memo'd component so that typing inside it only
// re-renders THIS component (not the 1000-row parent). This is the primary
// fix for "detail panel typing lag".
const DETAIL_FIELDS: { key: keyof TestCaseDetail; label: string; rows: number; placeholder: string }[] = [
  { key: 'preConditions', label: 'Pre-Conditions',  rows: 2, placeholder: 'e.g. User must be logged in...' },
  { key: 'steps',         label: 'Test Steps',      rows: 3, placeholder: 'e.g. 1. Navigate to...\n2. Click...\n3. Verify...' },
  { key: 'expected',      label: 'Expected Result', rows: 2, placeholder: 'e.g. Success message shown...' },
  { key: 'actual',        label: 'Actual Result',   rows: 2, placeholder: 'e.g. Error shown instead...' },
  { key: 'notes',         label: 'Notes',           rows: 1, placeholder: 'e.g. Only on Safari...' },
]
const DetailPanel = memo(function DetailPanel({
  rowId, row, panelOpen, cacheRef, onClose,
}: {
  rowId: string
  row: TestRow | undefined
  panelOpen: boolean
  cacheRef: React.MutableRefObject<Record<string, TestCaseDetail>>
  onClose: () => void
}) {
  const [detail, setDetail] = useState<TestCaseDetail>(
    () => cacheRef.current[rowId] ?? { preConditions: '', steps: '', expected: '', actual: '', notes: '' }
  )
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rowIdRef = useRef(rowId)
  rowIdRef.current = rowId

  useEffect(() => {
    // Load from cache or fetch
    if (cacheRef.current[rowId]) {
      setDetail(cacheRef.current[rowId])
    } else {
      getDetail(rowId).then(d => { cacheRef.current[rowId] = d; setDetail(d) }).catch(console.error)
    }
    return () => {
      // Flush debounced save on unmount / row change
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        const d = cacheRef.current[rowIdRef.current]
        if (d) saveDetail(rowIdRef.current, d).catch(console.error)
      }
    }
  }, [rowId])   // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = useCallback((field: keyof TestCaseDetail, value: string) => {
    setDetail(prev => {
      const next = { ...prev, [field]: value }
      cacheRef.current[rowIdRef.current] = next
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        saveDetail(rowIdRef.current, next).catch(console.error)
      }, 500)
      return next
    })
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
      <div style={{
        position: 'fixed',
        top: 'calc(var(--topnav-height) + 60px)',
        right: panelOpen ? 370 : 16,
        width: 320,
        maxHeight: 'calc(100vh - var(--topnav-height) - 80px)',
        border: '1px solid var(--border-strong)',
        borderRadius: 12,
        background: 'var(--bg-surface)',
        display: 'flex', flexDirection: 'column',
        zIndex: 110,
        boxShadow: '0 8px 40px rgba(0,0,0,0.30)',
        overflow: 'hidden',
        transition: 'right 0.2s ease',
      }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0, background: 'var(--bg-surface)' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Test Case Details</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-body)', margin: 0, lineHeight: 1.4, wordBreak: 'break-word', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {row?.number ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{row.number}: </span> : ''}{row?.title}
            </p>
          </div>
          <button onClick={onClose}
            style={{ background: 'var(--bg-depth)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, padding: '3px 8px', flexShrink: 0, lineHeight: 1.4, fontWeight: 600 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#ef4444' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-depth)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}>
            ✕
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DETAIL_FIELDS.map(({ key, label, rows: numRows, placeholder }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{label}</label>
              <textarea
                value={detail[key]}
                onChange={e => updateField(key, e.target.value)}
                placeholder={placeholder}
                rows={numRows}
                style={{ width: '100%', padding: '6px 9px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--text-body)', resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(14,165,233,0.5)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>
          ))}
        </div>
        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border-subtle)', fontSize: 10, color: 'var(--text-dimmer)', display: 'flex', justifyContent: 'space-between' }}>
          <span>auto-saved</span><span>Esc to close</span>
        </div>
      </div>
    </>
  )
})

// Adjust stats when a single result changes — no network needed
function applyStatusChange(s: Stats, prev: TestStatus | undefined, next: TestStatus): Stats {
  const p = prev ?? 'not_run'
  if (p === next) return s
  let { pass, fail, blocked, query, exclude, done, total } = s
  if (p === 'pass') pass--; else if (p === 'fail') fail--; else if (p === 'blocked') blocked--; else if (p === 'query') query--; else if (p === 'exclude') { exclude--; total++ }
  if (next === 'pass') pass++; else if (next === 'fail') fail++; else if (next === 'blocked') blocked++; else if (next === 'query') query++; else if (next === 'exclude') { exclude++; total-- }
  done = pass + fail + blocked + query
  const pct = total > 0 ? Math.round((pass / total) * 100) : 0
  return { pass, fail, blocked, query, exclude, done, total, pct }
}

const STATUS_ICONS: Record<TestStatus, { icon: string; color: string }> = {
  pass:    { icon: '✓', color: '#22c55e' },
  fail:    { icon: '✗', color: '#ef4444' },
  blocked: { icon: '⊘', color: '#f59e0b' },
  query:   { icon: '?', color: '#3b82f6' },
  exclude: { icon: '–', color: '#475569' },
  not_run: { icon: '',  color: 'transparent' },
}

// ── RowItem ──────────────────────────────────────────────────────────────────
// Memoized row component — when activeRowId changes, only the 2 affected rows
// re-render (old active + new active). All other 998 rows skip entirely.
type RowItemProps = {
  row: TestRow
  idx: number
  runs: TestRun[]
  isActiveRow: boolean
  activeRunId: string | null
  resultsMap: Record<string, Record<string, TestResult>>
  editingRowId: string | null
  editTitle: string
  detailRowId: string | null
  onContextMenu: (e: React.MouseEvent, rowId: string) => void
  onRowSelectOnly: (rowId: string) => void
  onCellClick: (runId: string, rowId: string) => void
  onOpenDetail: (rowId: string) => void
  onStartEditing: (rowId: string, title: string) => void
  onEditTitleChange: (v: string) => void
  onEditSave: (rowId: string, title: string, advance?: boolean) => void
  onEditInsertAbove: (rowId: string, title: string) => void
  onEditCancel: () => void
  onMenuIcon: (e: React.MouseEvent, rowId: string) => void
}

const RowItem = memo(function RowItem({ row, idx, runs, isActiveRow, activeRunId, resultsMap, editingRowId, editTitle, detailRowId, onContextMenu, onRowSelectOnly, onCellClick, onOpenDetail, onStartEditing, onEditTitleChange, onEditSave, onEditInsertAbove, onEditCancel, onMenuIcon }: RowItemProps) {
  const isHeading = row.type === 'heading'
  const num = String(idx + 1).padStart(4, '0')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isEditing = editingRowId === row.id
  const isDetailOpen = detailRowId === row.id

  return (
    <div
      data-row-id={row.id}
      onContextMenu={e => onContextMenu(e, row.id)}
      onClick={e => { e.stopPropagation(); if (!isHeading) { if (activeRunId) onCellClick(activeRunId, row.id); else onRowSelectOnly(row.id) } }}
      style={{
        display: 'flex', alignItems: 'flex-start',
        borderBottom: '1px solid var(--border)',
        minHeight: isHeading ? 44 : 40,
        minWidth: 'max-content',
        cursor: isHeading ? 'default' : 'pointer',
        background: isHeading
          ? 'linear-gradient(90deg, rgba(14,165,233,0.13) 0%, rgba(14,165,233,0.04) 100%)'
          : isActiveRow ? 'rgba(14,165,233,0.10)' : 'transparent',
        borderLeft: isHeading ? '3px solid var(--accent)' : isActiveRow ? '3px solid var(--accent)' : '3px solid transparent',
        transition: 'none',
      }}
      >

      {/* Left spacer — matches run header */}
      <div style={{ width: 28, flexShrink: 0 }} />

      {/* Row number */}
      <div style={{ width: 58, padding: '10px 10px 10px 4px', fontSize: 11.5, color: 'var(--text-dim)', fontFamily: 'monospace', flexShrink: 0, textAlign: 'right' }}>
        {num}
      </div>

      {/* Test case icon — left click opens menu */}
      <div style={{ width: 26, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 11 }}>
        {!isHeading && (
          <div
            onClick={e => onMenuIcon(e, row.id)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3, borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-depth)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <FileText size={14} color="var(--text-secondary)" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* Title + detail trigger */}
      <div style={{ flex: 1, padding: '10px 14px 10px', minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {isEditing ? (
          <input autoFocus value={editTitle}
            onChange={e => onEditTitleChange(e.target.value)}
            onBlur={() => { onEditSave(row.id, editTitle.trim(), false) }}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); onEditInsertAbove(row.id, editTitle.trim()); return }
              if (e.key === 'Enter') { e.preventDefault(); onEditSave(row.id, editTitle.trim(), true) }
              if (e.key === 'Escape') { onEditCancel() }
            }}
            style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '2px solid var(--accent)', outline: 'none', fontSize: 14, color: 'var(--text-primary)', padding: '2px 0' }} />
        ) : (
          <>
            <span
              onDoubleClick={() => onStartEditing(row.id, row.title)}
              style={{
                fontSize: isHeading ? 15 : 14,
                fontWeight: isHeading ? 700 : 400,
                color: isHeading ? 'var(--accent-hover)' : 'var(--text-body)',
                flex: 1, lineHeight: 1.55,
                letterSpacing: isHeading ? '0.04em' : 'normal',
                textTransform: isHeading ? 'uppercase' : 'none',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                whiteSpace: 'normal',
              }}>
              {row.title
                ? (isHeading ? row.title : (row.number ? `${row.number}: ${row.title}` : row.title))
                : <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Double-click to edit</span>}
            </span>
            {!isHeading && (
              <button
                onClick={e => { e.stopPropagation(); onOpenDetail(row.id) }}
                title="Test case details (D)"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 16, lineHeight: 1, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                  color: isDetailOpen ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { if (!isDetailOpen) e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { if (!isDetailOpen) e.currentTarget.style.color = 'var(--text-secondary)' }}>
                ≡
              </button>
            )}
          </>
        )}
      </div>

      {/* Result cells per run */}
      {runs.map(run => {
        if (isHeading) {
          return <div key={run.id} style={{ width: 136, alignSelf: 'stretch', borderLeft: '1px solid var(--border-subtle)', flexShrink: 0, background: 'linear-gradient(90deg,rgba(14,165,233,0.06) 0%,transparent 100%)' }} />
        }
        const res = resultsMap[run.id]?.[row.id]
        const st = res?.status && res.status !== 'not_run' ? STATUS_ICONS[res.status] : null
        const isCellActive = activeRunId === run.id && isActiveRow
        return (
          <div key={run.id}
            onClick={e => { e.stopPropagation(); onCellClick(run.id, row.id) }}
            style={{
              width: 136, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderLeft: '1px solid var(--border-subtle)',
              cursor: 'pointer', flexShrink: 0,
              background: isCellActive ? 'var(--accent-muted)' : activeRunId === run.id ? 'var(--accent-subtle)' : 'transparent',
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
})

export default function ScriptPage() {
  const { id, planId, scriptId } = useParams<{ id: string; planId: string; scriptId: string }>()
  const router = useRouter()

  const [script, setScript] = useState<Script | null>(null)
  const [rows, setRows] = useState<TestRow[]>(() => peekCache<TestRow[]>(`rows:${scriptId}`) ?? [])
  const [runs, setRuns] = useState<TestRun[]>(() => peekCache<TestRun[]>(`runs:${scriptId}`) ?? [])
  const [resultsMap, setResultsMap] = useState<Record<string, Record<string, TestResult>>>(() => {
    // Initialize resultsMap from cache — eliminates blank flash on back-navigation
    const cachedRuns = peekCache<TestRun[]>(`runs:${scriptId}`) ?? []
    const map: Record<string, Record<string, TestResult>> = {}
    for (const run of cachedRuns) {
      const cachedResults = peekCache<TestResult[]>(`results:${run.id}`)
      if (cachedResults) {
        map[run.id] = {}
        cachedResults.forEach(r => { map[run.id][r.rowId] = r })
      }
    }
    return map
  })

  // Deletion notice — shown when another user deletes this script or plan
  const [deletedNotice, setDeletedNotice] = useState<string | null>(null)

  // Panel state
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [panelVisible, setPanelVisible] = useState(true)   // can hide/show without losing active run
  // Uncontrolled refs for comment/bugId — typing does NOT cause any React re-render (zero lag)
  const panelCommentRef = useRef<HTMLTextAreaElement>(null)
  const panelBugIdRef = useRef<HTMLInputElement>(null)
  const setPanelComment = (v: string) => { if (panelCommentRef.current) panelCommentRef.current.value = v }
  const setPanelBugId   = (v: string) => { if (panelBugIdRef.current)   panelBugIdRef.current.value   = v }
  const getPanelComment = () => panelCommentRef.current?.value ?? ''
  const getPanelBugId   = () => panelBugIdRef.current?.value   ?? ''

  // Detail panel state — detail content is managed INSIDE <DetailPanel> to prevent row re-renders on typing
  const [detailRowId, setDetailRowId] = useState<string | null>(null)

  // Stats state — initialized from cache so first render shows real data
  const [topStats, setTopStats] = useState<Stats | null>(() => {
    const cachedRows = peekCache<TestRow[]>(`rows:${scriptId}`) ?? []
    const caseRowsCached = cachedRows.filter(r => r.type === 'case')
    const cachedRuns = peekCache<TestRun[]>(`runs:${scriptId}`) ?? []
    if (cachedRuns.length === 0 || caseRowsCached.length === 0) return null
    return null // topStats needs activeRunId which isn't known yet
  })
  const [allRunsStats, setAllRunsStats] = useState<Stats | null>(() => {
    const cachedRows = peekCache<TestRow[]>(`rows:${scriptId}`) ?? []
    const caseRowsCached = cachedRows.filter(r => r.type === 'case')
    const cachedRuns = peekCache<TestRun[]>(`runs:${scriptId}`) ?? []
    if (cachedRuns.length === 0 || caseRowsCached.length === 0) return null
    const cachedMap: Record<string, TestResult[]> = {}
    for (const run of cachedRuns) {
      cachedMap[run.id] = peekCache<TestResult[]>(`results:${run.id}`) ?? []
    }
    if (cachedRuns.every(run => !peekCache(`results:${run.id}`))) return null
    return sumStats(cachedRuns.map(run => computeStats(caseRowsCached, cachedMap[run.id])))
  })
  // Per-run stats — lets us update allRunsStats in O(1) using applyStatusChange instead of O(runs×rows)
  const [perRunStats, setPerRunStats] = useState<Record<string, Stats>>({})

  // Add run modal
  const [addingRun, setAddingRun] = useState(false)
  const [runTester, setRunTester] = useState('')
  const [runBuild, setRunBuild] = useState('')

  // Row editing
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; rowId: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const addInputRef = useRef<HTMLInputElement>(null)
  const runHeaderRef = useRef<HTMLDivElement>(null)
  const detailCacheRef = useRef<Record<string, TestCaseDetail>>({})
  // Stable refs so callbacks don't need to be recreated on every render
  const resultsMapRef = useRef(resultsMap)
  resultsMapRef.current = resultsMap
  const detailRowIdRef = useRef(detailRowId)
  detailRowIdRef.current = detailRowId
  // Refs for surgical stats updates from Realtime
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const perRunStatsRef = useRef(perRunStats)
  perRunStatsRef.current = perRunStats
  const allRunsStatsRef = useRef(allRunsStats)
  allRunsStatsRef.current = allRunsStats
  const topStatsRef = useRef(topStats)
  topStatsRef.current = topStats

  // reload() — two modes:
  //   skipResults=false (default): full reload including results (initial load, explicit refreshes)
  //   skipResults=true: reload rows/runs only, recompute stats from current resultsMap in memory —
  //     used by polling and Realtime row events so resultsMap is NEVER wiped mid-session
  const reload = useCallback(async (currentActiveRunId?: string | null, skipResults = false) => {
    const [allScripts, rws, rns] = await Promise.all([getScripts(planId), getRows(scriptId), getTestRuns(planId, scriptId)])
    setScript(allScripts.find(s => s.id === scriptId) || null)
    // Only replace rows array if it ACTUALLY differs — prevents flash when the
    // 5-second poll fires and nothing has changed.
    setRows(prev => {
      if (prev.length === rws.length) {
        let identical = true
        for (let i = 0; i < prev.length; i++) {
          const a = prev[i], b = rws[i]
          if (a.id !== b.id || a.title !== b.title || a.number !== b.number
              || a.type !== b.type || a.order !== b.order) { identical = false; break }
        }
        if (identical) return prev
      }
      return rws
    })
    setRuns(prev => {
      if (prev.length === rns.length) {
        let identical = true
        for (let i = 0; i < prev.length; i++) {
          const a = prev[i], b = rns[i]
          if (a.id !== b.id || a.tester !== b.tester || a.build !== b.build
              || a.status !== b.status || a.number !== b.number) { identical = false; break }
        }
        if (identical) return prev
      }
      return rns
    })

    const runStillExists = currentActiveRunId ? rns.some(r => r.id === currentActiveRunId) : false
    if (currentActiveRunId && !runStillExists) {
      setActiveRunId(null)
      setActiveRowId(null)
    }
    const aRunId = (currentActiveRunId && runStillExists) ? currentActiveRunId : null
    const caseRowsLoaded = rws.filter(r => r.type === 'case')

    if (skipResults) {
      // Recompute stats from the in-memory resultsMap — no DB fetch, no flash
      const currentMap = resultsMapRef.current
      if (rns.length > 0) {
        const prs: Record<string, Stats> = {}
        rns.forEach(run => { prs[run.id] = computeStats(caseRowsLoaded, Object.values(currentMap[run.id] || {})) })
        setPerRunStats(prs)
        setAllRunsStats(sumStats(Object.values(prs)))
        if (aRunId) setTopStats(computeStats(caseRowsLoaded, Object.values(currentMap[aRunId] || {})))
        else setTopStats(null)
      } else {
        setPerRunStats({}); setAllRunsStats(null); setTopStats(null)
      }
      return
    }

    // Full results fetch — only on initial load or explicit full reload
    const map: Record<string, Record<string, TestResult>> = {}
    if (rns.length > 0) {
      const allResults = await Promise.all(rns.map(r => getResults(r.id)))
      rns.forEach((run, i) => {
        map[run.id] = {}
        allResults[i].forEach(r => { map[run.id][r.rowId] = r })
      })
    }
    setResultsMap(map)
    if (aRunId && map[aRunId] !== undefined) {
      setTopStats(computeStats(caseRowsLoaded, Object.values(map[aRunId])))
    } else if (aRunId) {
      setTopStats(computeStats(caseRowsLoaded, []))
    } else {
      setTopStats(null)
    }
    if (rns.length > 0) {
      const prs: Record<string, Stats> = {}
      rns.forEach(run => { prs[run.id] = computeStats(caseRowsLoaded, Object.values(map[run.id] || {})) })
      setPerRunStats(prs)
      setAllRunsStats(sumStats(Object.values(prs)))
    } else {
      setPerRunStats({})
      setAllRunsStats(null)
    }
  }, [scriptId, planId])

  useEffect(() => { reload(null) }, [reload])

  useEffect(() => {
    const handler = () => { reload(activeRunId) }
    window.addEventListener('qaflow:change', handler)
    return () => window.removeEventListener('qaflow:change', handler)
  }, [reload, activeRunId])

  // Supabase Realtime — sync changes from other team members
  useEffect(() => {
    const channel = supabase
      .channel(`script-${scriptId}`)
      // Rows — SURGICAL: patch one row at a time, never a full reload. This is
      // critical because a) every saveRow we issue locally echoes back as a
      // realtime event, and b) a full reload replaces the rows array, which
      // would flash all just-spawned blanks out then back in. Optimistic state
      // is already correct; we only merge the DB version when it differs.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rows',
        filter: `script_id=eq.${scriptId}` },
        ({ eventType, new: newRow, old: oldRow }: { eventType: string; new: Record<string,unknown>; old: Record<string,unknown> }) => {
          if (eventType === 'DELETE') {
            const r = oldRow as { id: string }
            if (!r.id) return
            setRows(prev => prev.filter(x => x.id !== r.id))
            return
          }
          const r = newRow as { id: string; script_id: string; type: 'case'|'heading'; number: string; title: string; order: number }
          if (!r.id) return
          const incoming: TestRow = {
            id: r.id, scriptId: r.script_id, type: r.type,
            number: r.number ?? '', title: r.title ?? '', order: r.order ?? 0,
          }
          setRows(prev => {
            const idx = prev.findIndex(x => x.id === incoming.id)
            if (idx >= 0) {
              // Existing row — patch in place only if something actually changed
              const cur = prev[idx]
              if (cur.title === incoming.title && cur.number === incoming.number
                  && cur.type === incoming.type && cur.order === incoming.order) return prev
              const next = prev.slice()
              next[idx] = { ...cur, ...incoming }
              return next
            }
            // New row from another user — append; resort by order to keep layout right
            const next = [...prev, incoming]
            next.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            return next
          })
        })
      // Results — SURGICAL update: patch exactly the one cell that changed, zero reload, zero flash
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' },
        ({ eventType, new: newRow, old: oldRow }: { eventType: string; new: Record<string,unknown>; old: Record<string,unknown> }) => {
          if (eventType === 'DELETE') {
            const r = oldRow as { run_id: string; row_id: string }
            if (!r.run_id || !r.row_id) return
            setResultsMap(prev => {
              const runMap = { ...(prev[r.run_id] ?? {}) }
              delete runMap[r.row_id]
              return { ...prev, [r.run_id]: runMap }
            })
            return
          }
          const r = newRow as { id: string; run_id: string; row_id: string; status: TestStatus; comment: string; bug_id: string }
          if (!r.run_id || !r.row_id) return
          // Get old status before patching (for stats delta)
          const prevStatus = resultsMapRef.current[r.run_id]?.[r.row_id]?.status
          const newStatus = r.status
          // Patch exactly one cell in resultsMap
          setResultsMap(prev => {
            const runMap = { ...(prev[r.run_id] ?? {}) }
            runMap[r.row_id] = { id: r.id, runId: r.run_id, rowId: r.row_id, status: newStatus, comment: r.comment ?? '', bugId: r.bug_id ?? '' }
            return { ...prev, [r.run_id]: runMap }
          })
          // Update stats surgically — only if this is a case row and status actually changed
          const isCaseRow = rowsRef.current.find(row => row.id === r.row_id)?.type === 'case'
          if (!isCaseRow || prevStatus === newStatus) return
          if (r.run_id === activeRunIdRef.current && topStatsRef.current) {
            setTopStats(applyStatusChange(topStatsRef.current, prevStatus, newStatus))
          }
          const oldRunSt = perRunStatsRef.current[r.run_id]
          if (oldRunSt && allRunsStatsRef.current) {
            const newRunSt = applyStatusChange(oldRunSt, prevStatus, newStatus)
            setPerRunStats(prev => ({ ...prev, [r.run_id]: newRunSt }))
            setAllRunsStats(prev => {
              if (!prev) return prev
              const u = { ...prev,
                pass: prev.pass - oldRunSt.pass + newRunSt.pass,
                fail: prev.fail - oldRunSt.fail + newRunSt.fail,
                blocked: prev.blocked - oldRunSt.blocked + newRunSt.blocked,
                query: prev.query - oldRunSt.query + newRunSt.query,
                exclude: prev.exclude - oldRunSt.exclude + newRunSt.exclude,
                done: prev.done - oldRunSt.done + newRunSt.done,
                total: prev.total - oldRunSt.total + newRunSt.total,
              }
              u.pct = u.total > 0 ? Math.round((u.pass / u.total) * 100) : 0
              return u
            })
          }
        })
      // Run deleted — full reload needed to clear activeRunId if it was deleted
      // Filter by script_id client-side since Realtime only supports single-column filters
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'runs',
        filter: `plan_id=eq.${planId}` }, ({ old: r }) => {
        const deletedScriptId = (r as { script_id?: string }).script_id
        if (deletedScriptId && deletedScriptId !== scriptId) return // ignore runs from other scripts
        reload(activeRunIdRef.current)
      })
      // THIS script deleted by another user → show notice + redirect to plan page
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'scripts',
        filter: `id=eq.${scriptId}` }, () => {
        setDeletedNotice('This script was deleted by another team member.')
        setTimeout(() => router.replace(`/projects/${id}/plan/${planId}`), 2500)
      })
      // Parent plan deleted by another user → redirect to project
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'plans',
        filter: `id=eq.${planId}` }, () => {
        setDeletedNotice('This test plan was deleted by another team member.')
        setTimeout(() => router.replace(`/projects/${id}`), 2500)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [scriptId, planId, activeRunId, reload, id, router])

  // Polling + visibility-based refresh — guarantees structural changes (new rows,
  // new runs) from other team members appear within a few seconds.
  // Results are intentionally excluded — Realtime handles them surgically so
  // polling never wipes or replaces resultsMap.
  const runsRefForPoll = useRef<TestRun[]>([])
  useEffect(() => { runsRefForPoll.current = runs }, [runs])

  const forceReload = useCallback(async () => {
    // Only invalidate rows/runs cache — never invalidate results cache.
    // resultsMap is kept alive in memory and updated surgically via Realtime.
    invalidateCache(`rows:${scriptId}`, `runs:${scriptId}`, `runs:${planId}`, `scripts:${planId}`)
    // skipResults=true: reload rows+runs structure but never touch resultsMap
    await reload(activeRunIdRef.current, true)
  }, [scriptId, planId, reload])

  // Track editing state in a ref so the polling loop can skip refresh while
  // the user is mid-edit (otherwise the polling reload replaces the rows array
  // and visually flashes the just-spawned blanks).
  const editingRowIdRef = useRef<string | null>(null)
  useEffect(() => { editingRowIdRef.current = editingRowId }, [editingRowId])

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !editingRowIdRef.current) forceReload()
    }, 5000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !editingRowIdRef.current) forceReload()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [forceReload])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-rowmenu]')) setRowMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  // Auto-scroll the editing row into view whenever it changes — covers
  // Shift+Enter spawning a blank past the bottom of the viewport, and the
  // chained Enter advancing through pre-spawned blanks.
  useEffect(() => {
    if (!editingRowId) return
    // RAF so the DOM has the new row painted before we measure.
    const id = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-row-id="${editingRowId}"]`) as HTMLElement | null
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [editingRowId])

  // Global Shift+Enter: insert blank row above selected row (when not already editing)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.shiftKey && activeRowId && !editingRowId) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        insertBlankRowAbove(activeRowId)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [activeRowId, editingRowId])


  const caseRows = useMemo(() => rows.filter(r => r.type === 'case'), [rows])

  const startEditingRow = (rowId: string, title: string) => {
    setEditingRowId(rowId)
    setEditTitle(title)
    setActiveRowId(rowId)
  }

  const insertBlankRowAbove = (rowId: string) => {
    const newId = generateId()
    const idx = rows.findIndex(r => r.id === rowId)
    const newRow: TestRow = { id: newId, scriptId, order: idx, type: 'case', number: '', title: '' }
    setRows(prev => { const c = [...prev]; c.splice(idx < 0 ? 0 : idx, 0, newRow); return c })
    startEditingRow(newId, '')
    insertRowBefore(scriptId, rowId, 'case', newId).catch(console.error)
  }

  // ── Add row ──
  const handleAddRow = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()

    // ── Shift+Enter: save current text (if any), spawn ONE blank at the bottom,
    // and immediately enter edit mode on it. The cursor lands directly in the
    // new blank so the user can keep typing without ever losing focus. To
    // create another blank below, they press Enter (with text) which saves +
    // spawns the next blank automatically (see handleEditSaveCb).
    if (e.shiftKey) {
      const currentRows = rowsRef.current
      let baseLen = currentRows.length
      const title = newTitle.trim()
      if (title) {
        const savedId = generateId()
        const order = baseLen
        setRows(prev => [...prev, { id: savedId, scriptId, order, type: 'case', number: '', title }])
        saveRow(scriptId, title, '', 'case', { id: savedId, order }).catch(console.error)
        baseLen += 1
        setNewTitle('')
      }
      const blankId = generateId()
      const blankOrder = baseLen
      setRows(prev => [...prev, { id: blankId, scriptId, order: blankOrder, type: 'case', number: '', title: '' }])
      saveRow(scriptId, '', '', 'case', { id: blankId, order: blankOrder }).catch(console.error)
      // Drop the cursor directly into the new blank (also moves the highlight).
      startEditingRow(blankId, '')
      return
    }

    // ── Enter on empty input: jump into the first blank row in edit mode ──
    if (!newTitle.trim()) {
      const firstBlank = rowsRef.current.find(r => r.type === 'case' && !r.title.trim())
      if (firstBlank) startEditingRow(firstBlank.id, '')
      return
    }

    // ── Enter with text: save normally (existing behavior) ──
    const title = newTitle.trim()
    const newId = generateId()
    const order = rows.length
    setNewTitle('')
    setRows(prev => [...prev, { id: newId, scriptId, order, type: 'case', number: '', title }])
    setTimeout(() => addInputRef.current?.focus(), 30)
    saveRow(scriptId, title, '', 'case', { id: newId, order }).catch(console.error)
  }

  // ── Add run ──
  const handleAddRun = (e: React.FormEvent) => {
    e.preventDefault()
    const tester = runTester.trim() || 'anyone'
    setRunTester(''); setAddingRun(false)
    const now = new Date()
    const newId = generateId()
    const number = runs.length + 1
    const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    const newRun: TestRun = { id: newId, planId, scriptId, number, tester, date, time, build: '', status: 'in_progress' }
    const caseCount = rows.filter(r => r.type === 'case').length
    setRuns(prev => [...prev, newRun])
    setResultsMap(prev => ({ ...prev, [newId]: {} }))
    setActiveRunId(newId)
    setPanelVisible(true)
    setTopStats({ pass:0, fail:0, blocked:0, query:0, exclude:0, done:0, total:caseCount, pct:0 })
    setAllRunsStats(prev => prev ? { ...prev, total: prev.total + caseCount } : { pass:0, fail:0, blocked:0, query:0, exclude:0, done:0, total:caseCount, pct:0 })
    const first = rows.find(r => r.type === 'case')
    if (first) { setActiveRowId(first.id); setPanelComment(''); setPanelBugId('') }
    saveTestRun(planId, scriptId, tester, '', { id: newId, number, date, time }).catch(console.error)
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
  // Now synchronous — DetailPanel handles its own detail fetching when detailRowId changes
  // Stable — uses refs so deps array is empty and callback never changes
  const activeRunIdRef = useRef(activeRunId)
  activeRunIdRef.current = activeRunId
  const activeRowIdRef = useRef(activeRowId)
  activeRowIdRef.current = activeRowId

  const handleCellClick = useCallback((runId: string, rowId: string) => {
    // Skip all state updates if clicking the already-active row in the same run
    if (activeRunIdRef.current === runId && activeRowIdRef.current === rowId) return
    if (activeRunIdRef.current !== runId) setActiveRunId(runId)
    setActiveRowId(rowId)
    const res = resultsMapRef.current[runId]?.[rowId]
    setPanelComment(res?.comment || '')
    setPanelBugId(res?.bugId || '')
    if (detailRowIdRef.current) setDetailRowId(rowId)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Panel: set status + auto-advance ──
  const handlePanelStatus = (status: TestStatus) => {
    if (!activeRunId || !activeRowId) return
    const runId = activeRunId
    const rowId = activeRowId
    const comment = getPanelComment()
    const bugId = getPanelBugId()
    const prevStatus = resultsMap[runId]?.[rowId]?.status

    // Build the updated map for local stats computation
    const updatedMap = {
      ...resultsMap,
      [runId]: { ...resultsMap[runId], [rowId]: { id: resultsMap[runId]?.[rowId]?.id || '', runId, rowId, status, comment, bugId } },
    }

    // 1. Optimistic result update — instant
    setResultsMap(updatedMap)

    // 2. Optimistic topStats update — instant, computed locally
    if (topStats) setTopStats(applyStatusChange(topStats, prevStatus, status))

    // 3. Optimistic allRunsStats — O(1) delta using perRunStats, no row iteration
    const oldRunSt = perRunStats[runId]
    if (oldRunSt && allRunsStats) {
      const newRunSt = applyStatusChange(oldRunSt, prevStatus, status)
      setPerRunStats(prev => ({ ...prev, [runId]: newRunSt }))
      const newAll = { ...allRunsStats,
        pass: allRunsStats.pass - oldRunSt.pass + newRunSt.pass,
        fail: allRunsStats.fail - oldRunSt.fail + newRunSt.fail,
        blocked: allRunsStats.blocked - oldRunSt.blocked + newRunSt.blocked,
        query: allRunsStats.query - oldRunSt.query + newRunSt.query,
        exclude: allRunsStats.exclude - oldRunSt.exclude + newRunSt.exclude,
        done: allRunsStats.done - oldRunSt.done + newRunSt.done,
        total: allRunsStats.total - oldRunSt.total + newRunSt.total,
      }
      newAll.pct = newAll.total > 0 ? Math.round((newAll.pass / newAll.total) * 100) : 0
      setAllRunsStats(newAll)
    } else {
      // Fallback: full recompute (only on first mark before perRunStats is populated)
      setAllRunsStats(sumStats(runs.map(run => computeStats(caseRows, Object.values(updatedMap[run.id] || {})))))
    }

    // 4. Advance to next case — instant
    const idx = caseRows.findIndex(r => r.id === rowId)
    const next = caseRows[idx + 1]
    if (next) {
      setActiveRowId(next.id)
      const res = resultsMap[runId]?.[next.id]
      setPanelComment(res?.comment || '')
      setPanelBugId(res?.bugId || '')
      // DetailPanel auto-fetches when detailRowId changes
      if (detailRowId) setDetailRowId(next.id)
      // Prefetch the row after next so DetailPanel gets it from cache
      const afterNext = caseRows[idx + 2]
      if (afterNext && !detailCacheRef.current[afterNext.id]) {
        getDetail(afterNext.id).then(d => { detailCacheRef.current[afterNext.id] = d }).catch(console.error)
      }
    }

    // 5. Persist in background — UI never waits
    setResult(runId, rowId, status, comment, bugId).catch(console.error)
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
    // DetailPanel auto-fetches when detailRowId changes
    if (detailRowId) setDetailRowId(next.id)
  }

  const savePanelNote = () => {
    if (!activeRunId || !activeRowId) return
    const existing = resultsMap[activeRunId]?.[activeRowId]
    if (!existing) return
    setResultsMap(prev => ({
      ...prev,
      [activeRunId]: { ...prev[activeRunId], [activeRowId]: { ...existing, comment: getPanelComment(), bugId: getPanelBugId() } },
    }))
    setResult(activeRunId, activeRowId, existing.status, getPanelComment(), getPanelBugId()).catch(console.error)
  }

  // ── Detail panel — open/close only; content managed inside <DetailPanel> ──
  const openDetail = (rowId: string) => {
    setDetailRowId(prev => prev === rowId ? null : rowId)
  }
  // Closing: just clear detailRowId. DetailPanel's cleanup effect flushes any pending save.
  const closeDetail = () => setDetailRowId(null)

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
  }, [activeRowId, detailRowId, rows])

  // ── Row right-click menu ──
  const handleRowCtx = (e: React.MouseEvent, rowId: string) => {
    e.preventDefault(); e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth  - 200 - 8)
    const y = Math.min(e.clientY, window.innerHeight - 200 - 8)
    setRowMenu({ x, y, rowId })
  }

  const makeHeading = (rowId: string) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, type: 'heading' as const, number: '' } : r))
    setRowMenu(null)
    updateRow(scriptId, rowId, { type: 'heading', number: '' }).catch(console.error)
  }
  const makeCase = (rowId: string) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, type: 'case' as const } : r))
    setRowMenu(null)
    updateRow(scriptId, rowId, { type: 'case' }).catch(console.error)
  }

  // ── Search ───────────────────────────────────────────────────────────────────
  const caseRowsRef = useRef(caseRows)
  caseRowsRef.current = caseRows

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows
    const q = searchQuery.toLowerCase()
    return rows.filter(r => r.title.toLowerCase().includes(q) || r.number.toLowerCase().includes(q))
  }, [rows, searchQuery])

  // ── Stable RowItem callbacks — never recreated, safe for React.memo ──────────
  const handleRowSelectOnly = useCallback((rowId: string) => setActiveRowId(rowId), [])
  const openDetailCb = useCallback((rowId: string) => {
    setDetailRowId(prev => prev === rowId ? null : rowId)
  }, [])
  const startEditingRowCb = useCallback((rowId: string, title: string) => {
    setEditingRowId(rowId); setEditTitle(title)
  }, [])
  const handleEditCancelCb = useCallback(() => setEditingRowId(null), [])
  const handleEditSaveCb = useCallback((rowId: string, title: string, advance: boolean = false) => {
    if (title) {
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, title } : r))
      updateRow(scriptId, rowId, { title }).catch(console.error)
    }
    if (advance) {
      // Find next blank row BELOW the saved one — jump cursor straight into it.
      // Uses rowsRef so we see the latest list (rows state may not have flushed yet).
      const list = rowsRef.current
      const idx = list.findIndex(r => r.id === rowId)
      const nextBlank = idx >= 0
        ? list.slice(idx + 1).find(r => r.type === 'case' && !r.title.trim())
        : undefined
      if (nextBlank) {
        // Reflect the just-saved title in the working list so the next iteration
        // doesn't see this row as blank again.
        if (title) {
          for (let i = 0; i < list.length; i++) {
            if (list[i].id === rowId) { list[i] = { ...list[i], title }; break }
          }
        }
        setEditingRowId(nextBlank.id)
        setEditTitle('')
        setActiveRowId(nextBlank.id)
        return
      }
      // No more blanks below → exit edit mode and return focus to the bottom add input.
      setEditingRowId(null)
      setTimeout(() => addInputRef.current?.focus(), 30)
      return
    }
    setEditingRowId(null)
  }, [scriptId])  // eslint-disable-line react-hooks/exhaustive-deps
  const handleEditInsertAboveCb = useCallback((rowId: string, title: string) => {
    if (title) {
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, title } : r))
      updateRow(scriptId, rowId, { title }).catch(console.error)
    }
    insertBlankRowAbove(rowId)
  }, [scriptId, insertBlankRowAbove])  // eslint-disable-line react-hooks/exhaustive-deps
  const handleRowCtxCb = useCallback((e: React.MouseEvent, rowId: string) => {
    e.preventDefault(); e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 200 - 8)
    const y = Math.min(e.clientY, window.innerHeight - 200 - 8)
    setRowMenu({ x, y, rowId })
  }, [])
  const handleMenuIconCb = useCallback((e: React.MouseEvent, rowId: string) => {
    e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 200 - 8)
    const y = Math.min(e.clientY, window.innerHeight - 200 - 8)
    setRowMenu({ x, y, rowId })
  }, [])


  const activeRow = useMemo(() => rows.find(r => r.id === activeRowId), [rows, activeRowId])
  const activeResult = activeRunId && activeRowId ? resultsMap[activeRunId]?.[activeRowId] : undefined
  const panelOpen = !!activeRunId && panelVisible
  const activeRun = useMemo(() => runs.find(r => r.id === activeRunId) ?? null, [runs, activeRunId])
  const runIsCompleted = activeRun?.status === 'completed'
  // Pre-compute per-run stats once per render — used by both header and PDF
  const runHeaderStatsMap = useMemo(() => {
    const m: Record<string, Stats> = {}
    for (const run of runs) {
      m[run.id] = computeStats(caseRows, Object.values(resultsMap[run.id] || {}))
    }
    return m
  }, [runs, caseRows, resultsMap])

  const markRunCompleted = () => {
    if (!activeRunId) return
    setRuns(prev => prev.map(r => r.id === activeRunId ? { ...r, status: 'completed' as const } : r))
    updateTestRun(planId, activeRunId, { status: 'completed' }).catch(console.error)
  }
  const markRunInProgress = () => {
    if (!activeRunId) return
    setRuns(prev => prev.map(r => r.id === activeRunId ? { ...r, status: 'in_progress' as const } : r))
    updateTestRun(planId, activeRunId, { status: 'in_progress' }).catch(console.error)
  }

  // jsPDF only supports Latin-1. Map common Unicode symbols to ASCII equivalents.
  const sanitizeForPDF = (text: string): string => {
    let s = text
    s = s.replace(/[\u2018\u2019\u02bc]/g, "'")           // smart single quotes
    s = s.replace(/[\u201c\u201d\u00ab\u00bb\u201e]/g, '"') // smart double quotes
    s = s.replace(/[\u2013\u2014\u2015]/g, '-')           // en/em dash
    s = s.replace(/[\u2212\ufe63\uff0d]/g, '-')           // minus sign variants
    s = s.replace(/[\u00a0\u202f\u2009\u2003]/g, ' ')   // special spaces
    s = s.replace(/\u2026/g, '...')                         // ellipsis
    s = s.replace(/[\u2022\u00b7\u25cf\u25e6\u25aa\u25b8\u25ba]/g, '-') // bullets
    s = s.replace(/[\u2192\u21d2\u27a4\u279c\u27a1]/g, '->')  // right arrows
    s = s.replace(/[\u2190\u21d0]/g, '<-')                // left arrows
    s = s.replace(/[\u00d7\u2715\u2717]/g, 'x')          // cross/multiply
    s = s.replace(/\u00f7/g, '/')                          // division
    s = s.replace(/[\u2265\u2a7e]/g, '>=')               // >=
    s = s.replace(/[\u2264\u2a7d]/g, '<=')               // <=
    s = s.replace(/\u2260/g, '!=')                        // !=
    s = s.replace(/[\u2713\u2714\u2611]/g, 'OK')        // checkmarks
    s = s.replace(/[\u2717\u2718\u2612]/g, 'FAIL')      // x-marks
    s = s.replace(/[\u2122\u00ae\u00a9]/g, '')          // TM/R/C symbols
    s = s.replace(/[^\x00-\xFF]/g, '?')                  // anything else outside Latin-1
    return s
  }

  const generatePDF = async () => {
    if (runs.length === 0) return
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 40
    let y = margin

    const sCol: Record<string, [number, number, number]> = {
      pass:    [22, 163, 74],
      fail:    [220, 38, 38],
      blocked: [217, 119, 6],
      query:   [59, 130, 246],
      exclude: [100, 116, 139],
      not_run: [180, 180, 190],
    }
    const sLabel: Record<string, string> = {
      pass: 'PASS', fail: 'FAIL', blocked: 'BLOCKED',
      query: 'QUERY', exclude: 'EXCL', not_run: '-',
    }

    const tW = pageW - margin * 2 // usable table width

    const addFooter = (pageNum: number, total: number) => {
      doc.setDrawColor(200, 205, 212)
      doc.line(margin, pageH - 30, pageW - margin, pageH - 30)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(140, 145, 155)
      doc.text(`Testra  -  ${safeScriptName}`, margin, pageH - 18)
      doc.text(`Page ${pageNum} of ${total}`, pageW - margin, pageH - 18, { align: 'right' })
    }

    // ── HEADER — clean white with green left accent ──
    // Top green accent bar
    doc.setFillColor(22, 163, 74)
    doc.rect(0, 0, pageW, 5, 'F')
    // White header area
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 5, pageW, 70, 'F')
    // Bottom border
    doc.setDrawColor(225, 228, 234)
    doc.line(0, 75, pageW, 75)

    // Logo text
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.setTextColor(22, 163, 74)
    doc.text('Testra', margin, 36)

    // "Test Report" beside logo
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(14)
    doc.setTextColor(100, 110, 130)
    doc.text('Test Report', margin + 78, 36)

    // Meta line
    doc.setFontSize(9)
    doc.setTextColor(130, 138, 150)
    const safeScriptName = sanitizeForPDF(script?.name || '')
    const dateStr = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).replace(/[^\x20-\x7E]/g, '')
    const timeStr = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true }).replace(/[^\x20-\x7E]/g, '')
    const meta = `Script: ${safeScriptName}   -   ${runs.length} Run${runs.length > 1 ? 's' : ''}   -   ${dateStr}  ${timeStr}`
    doc.text(meta, margin, 55)
    y = 90

    // ── OVERALL STATS STRIP ──
    const allSt = sumStats(runs.map(run => runHeaderStatsMap[run.id] ?? computeStats(caseRows, Object.values(resultsMap[run.id] || {}))))
    if (allSt.total > 0) {
      // Green-tinted strip
      doc.setFillColor(240, 253, 244)
      doc.roundedRect(margin, y, tW, 40, 4, 4, 'F')
      doc.setDrawColor(187, 247, 208)
      doc.roundedRect(margin, y, tW, 40, 4, 4, 'S')

      const statItems = [
        { label: 'TOTAL', value: String(allSt.total), color: [40, 50, 70] as [number,number,number] },
        { label: 'PASS', value: String(allSt.pass), color: sCol.pass },
        { label: 'FAIL', value: String(allSt.fail), color: sCol.fail },
        { label: 'BLOCKED', value: String(allSt.blocked), color: sCol.blocked },
        { label: 'QUERY', value: String(allSt.query), color: sCol.query },
        { label: 'PASS RATE', value: `${allSt.pct}%`, color: allSt.pct >= 80 ? sCol.pass : allSt.pct >= 50 ? sCol.blocked : sCol.fail },
      ]
      const slotW = tW / statItems.length
      statItems.forEach((s, i) => {
        const cx = margin + slotW * i + slotW / 2
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(...s.color)
        doc.text(s.value, cx, y + 22, { align: 'center' })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(100, 116, 139)
        doc.text(s.label, cx, y + 33, { align: 'center' })
      })
      y += 52
    }

    // ── SECTION LABEL helper ──
    const sectionHeader = (label: string) => {
      // Green left bar + text
      doc.setFillColor(22, 163, 74)
      doc.rect(margin, y + 2, 3, 14, 'F')
      doc.setTextColor(30, 40, 60)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(label, margin + 10, y + 13)
      y += 22
    }

    // ── RUNS SUMMARY TABLE ──
    sectionHeader('Runs Summary')

    const summaryCols = [30, 110, 140, 38, 38, 46, 46, 67]
    const summaryHeaders = ['Run', 'Tester', 'Date & Time', 'Pass', 'Fail', 'Blocked', 'Query', 'Pass %']
    const summaryX = (i: number) => margin + summaryCols.slice(0, i).reduce((a, b) => a + b, 0)

    // Table header — green
    doc.setFillColor(22, 163, 74)
    doc.rect(margin, y, tW, 20, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    summaryHeaders.forEach((h, i) => { doc.text(h, summaryX(i) + 5, y + 14) })
    y += 20

    // Use already-computed run stats — zero extra work
    const runStatsMap = runHeaderStatsMap

    let totPass = 0, totFail = 0, totBlocked = 0, totQuery = 0
    runs.forEach((run, idx) => {
      const st = runStatsMap[run.id]
      totPass += st.pass; totFail += st.fail; totBlocked += st.blocked; totQuery += st.query
      const bg: [number, number, number] = idx % 2 === 0 ? [255, 255, 255] : [248, 250, 253]
      doc.setFillColor(...bg)
      doc.rect(margin, y, tW, 18, 'F')
      // Left border
      doc.setDrawColor(225, 228, 234)
      doc.line(margin, y, margin, y + 18)
      doc.line(margin + tW, y, margin + tW, y + 18)
      doc.line(margin, y + 18, margin + tW, y + 18)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)

      // Mini progress bar under date
      if (st.total > 0) {
        const barX = summaryX(2) + 5
        const barW = summaryCols[2] - 10
        const barY = y + 15
        const barH = 2
        let bx = barX
        ;[{ v: st.pass, c: sCol.pass }, { v: st.fail, c: sCol.fail }, { v: st.blocked, c: sCol.blocked }, { v: st.query, c: sCol.query }].forEach(seg => {
          if (seg.v > 0) {
            const sw = (seg.v / st.total) * barW
            doc.setFillColor(...seg.c)
            doc.rect(bx, barY, sw, barH, 'F')
            bx += sw
          }
        })
      }

      const cells = [
        `#${run.number}`, run.tester.replace(/[^\x20-\x7E]/g, ''), `${run.date} - ${run.time}`,
        String(st.pass), String(st.fail), String(st.blocked), String(st.query), `${st.pct}%`
      ]
      cells.forEach((cell, i) => {
        if (i === 3) doc.setTextColor(...sCol.pass)
        else if (i === 4) doc.setTextColor(...sCol.fail)
        else if (i === 5) doc.setTextColor(...sCol.blocked)
        else if (i === 6) doc.setTextColor(...sCol.query)
        else if (i === 7) { doc.setTextColor(22, 163, 74); doc.setFont('helvetica', 'bold') }
        else doc.setTextColor(50, 55, 70)
        doc.text(cell, summaryX(i) + 5, y + 12)
        if (i === 7) doc.setFont('helvetica', 'normal')
      })
      y += 18
    })

    // Totals row
    const totDone = totPass + totFail + totBlocked + totQuery
    const totTotal = allSt.total > 0 ? allSt.total : (totDone || 1)
    const totPct = totTotal > 0 ? Math.round((totPass / totTotal) * 100) : 0
    doc.setFillColor(240, 253, 244)
    doc.rect(margin, y, tW, 18, 'F')
    doc.setDrawColor(187, 247, 208)
    doc.line(margin, y + 18, margin + tW, y + 18)

    // Mini progress bar in totals
    if (totDone > 0) {
      const barX = summaryX(2) + 5
      const barW = summaryCols[2] - 10
      const barY = y + 15
      const barH = 2
      let bx = barX
      ;[{ v: totPass, c: sCol.pass }, { v: totFail, c: sCol.fail }, { v: totBlocked, c: sCol.blocked }, { v: totQuery, c: sCol.query }].forEach(seg => {
        if (seg.v > 0) {
          const sw = (seg.v / totDone) * barW
          doc.setFillColor(...seg.c)
          doc.rect(bx, barY, sw, barH, 'F')
          bx += sw
        }
      })
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(30, 40, 60)
    doc.text('Total', summaryX(1) + 5, y + 12)
    const totCells = ['', '', '', String(totPass), String(totFail), String(totBlocked), String(totQuery), `${totPct}%`]
    totCells.forEach((cell, i) => {
      if (!cell) return
      if (i === 3) doc.setTextColor(...sCol.pass)
      else if (i === 4) doc.setTextColor(...sCol.fail)
      else if (i === 5) doc.setTextColor(...sCol.blocked)
      else if (i === 6) doc.setTextColor(...sCol.query)
      else if (i === 7) doc.setTextColor(22, 163, 74)
      doc.text(cell, summaryX(i) + 5, y + 12)
    })
    y += 30

    // ── DETAILED RESULTS TABLE ──
    if (y > pageH - 120) { doc.addPage(); y = margin }
    sectionHeader('Detailed Results — All Runs')

    const caseRowsOnly = rows.filter(r => r.type === 'case')
    const numCol = 28
    const titleColW = Math.max(150, Math.min(250, tW - numCol - 55 * runs.length))
    const runColW = Math.floor((tW - numCol - titleColW) / Math.max(runs.length, 1))

    // Header row — green
    doc.setFillColor(22, 163, 74)
    doc.rect(margin, y, tW, 24, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('#', margin + 6, y + 16)
    doc.text('Test Case', margin + numCol + 6, y + 16)
    runs.forEach((run, i) => {
      const cx = margin + numCol + titleColW + runColW * i + runColW / 2
      doc.setFontSize(8)
      doc.text(`#${run.number}`, cx, y + 10, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(210, 240, 220)
      doc.text(run.tester.split(' ')[0].substring(0, 7), cx, y + 20, { align: 'center' })
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
    })
    y += 24

    caseRowsOnly.forEach((row, idx) => {
      doc.setFontSize(8.5)
      const title = sanitizeForPDF(row.number ? `${row.number}: ${row.title}` : row.title)
      const titleLines: string[] = doc.splitTextToSize(title, titleColW - 12)
      const lineH = 13
      const rowH = Math.max(20, titleLines.length * lineH + 6)

      // Page break check with actual row height — footer added in final pass
      if (y + rowH > pageH - 50) {
        doc.addPage()
        y = margin
      }

      const bg: [number, number, number] = idx % 2 === 0 ? [255, 255, 255] : [248, 250, 253]
      doc.setFillColor(...bg)
      doc.rect(margin, y, tW, rowH, 'F')
      doc.setDrawColor(235, 238, 242)
      doc.line(margin, y + rowH, margin + tW, y + rowH)

      // Row number — vertically centred
      doc.setTextColor(160, 168, 180)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text(String(idx + 1), margin + 6, y + rowH / 2 + 2.5)

      // Full title — all lines
      doc.setTextColor(40, 45, 60)
      doc.setFontSize(8.5)
      titleLines.forEach((line: string, li: number) => {
        doc.text(line, margin + numCol + 6, y + 12 + li * lineH)
      })

      // Status badges — vertically centred in the row
      runs.forEach((run, i) => {
        const res = resultsMap[run.id]?.[row.id]
        const status = res?.status || 'not_run'
        const cx = margin + numCol + titleColW + runColW * i + runColW / 2
        doc.setTextColor(...sCol[status])
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.text(sLabel[status], cx, y + rowH / 2 + 2.5, { align: 'center' })
      })
      y += rowH
    })

    // ── FOOTER all pages ──
    const totalPages = doc.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      addFooter(p, totalPages)
    }

    doc.save(`Testra-Test-Report-${script?.name || 'script'}-${runs.length}runs.pdf`)
  }

  // ── Deleted notice overlay ──
  if (deletedNotice) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 'calc(100vh - var(--topnav-height) - 48px)',
        background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
        borderRadius: 14, flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26,
        }}>🗑️</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            {deletedNotice}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Redirecting you back…</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - var(--topnav-height) - 48px)',
      overflow: 'hidden',
      background: 'var(--bg-surface)',
      border: '1px solid rgba(14,165,233,0.18)',
      borderTop: '3px solid #0ea5e9',
      borderRadius: 14,
      boxShadow: '0 2px 20px rgba(14,165,233,0.08), var(--shadow-md)',
    }}>

      {/* ══ MAIN ══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 16px',
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border-strong)',
          flexShrink: 0, borderRadius: '14px 14px 0 0',
          flexWrap: 'wrap', rowGap: 6,
        }}>

          {/* ── Back ── */}
          <button onClick={() => router.back()}
            style={{
              display:'flex', alignItems:'center', gap:5,
              fontSize:12.5, color:'var(--text-secondary)',
              background:'var(--bg-surface)', border:'1px solid var(--border-strong)',
              borderRadius:8, cursor:'pointer', padding:'5px 12px',
              fontWeight:600, transition:'all 0.14s', flexShrink:0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.borderColor='var(--border-accent)'; e.currentTarget.style.background='var(--bg-depth)' }}
            onMouseLeave={e => { e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.borderColor='var(--border-strong)'; e.currentTarget.style.background='var(--bg-surface)' }}>
            <span style={{ fontSize:11 }}>←</span> Back
          </button>

          {/* ── Divider ── */}
          <div style={{ width:1, height:20, background:'var(--border-strong)', flexShrink:0 }} />

          {/* ── Script name ── */}
          <div style={{
            display:'flex', alignItems:'center', gap:7, flexShrink:0,
            background:'linear-gradient(135deg, rgba(14,165,233,0.12) 0%, rgba(14,165,233,0.06) 100%)',
            border:'1px solid rgba(14,165,233,0.28)',
            borderRadius:8, padding:'5px 13px',
          }}>
            <span style={{
              width:6, height:6, borderRadius:'50%', flexShrink:0,
              background:'#0ea5e9', display:'inline-block',
              boxShadow:'0 0 5px rgba(14,165,233,0.8)',
            }} />
            <span style={{ fontSize:13, color:'var(--text-primary)', fontWeight:700, letterSpacing:'-0.2px', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{script?.name}</span>
          </div>

          {/* ── Stats chips ── */}
          {allRunsStats && (
            <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
              {/* Pass */}
              <div style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 9px', borderRadius:20, background:'rgba(34,197,94,0.10)', border:'1px solid rgba(34,197,94,0.25)' }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'#22c55e', display:'inline-block', flexShrink:0 }} />
                <span style={{ fontSize:12, fontWeight:700, color:'#22c55e', lineHeight:1 }}>{allRunsStats.pass}</span>
              </div>
              {/* Fail */}
              <div style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 9px', borderRadius:20, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.25)' }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'#ef4444', display:'inline-block', flexShrink:0 }} />
                <span style={{ fontSize:12, fontWeight:700, color:'#ef4444', lineHeight:1 }}>{allRunsStats.fail}</span>
              </div>
              {/* Blocked */}
              <div style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 9px', borderRadius:20, background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.25)' }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'#f59e0b', display:'inline-block', flexShrink:0 }} />
                <span style={{ fontSize:12, fontWeight:700, color:'#f59e0b', lineHeight:1 }}>{allRunsStats.blocked}</span>
              </div>
              {/* Progress */}
              <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, background:'var(--bg-depth)', border:'1px solid var(--border-strong)' }}>
                <span style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', lineHeight:1 }}>{allRunsStats.done}/{allRunsStats.total}</span>
                <div style={{ width:36, height:4, borderRadius:2, background:'var(--border-track)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${allRunsStats.pct}%`, background:'linear-gradient(90deg,#0ea5e9,#0284c7)', borderRadius:2, transition:'width 0.3s' }} />
                </div>
                <span style={{ fontSize:11, fontWeight:600, color:'var(--accent)', lineHeight:1 }}>{allRunsStats.pct}%</span>
              </div>
            </div>
          )}

          {/* ── Search ── */}
          <div style={{ display:'flex', alignItems:'center', gap:7, background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:8, padding:'5px 11px', marginLeft:'auto', transition:'border-color 0.14s' }}
            onFocus={() => {}} >
            <span style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1, flexShrink:0 }}>⌕</span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search cases..."
              style={{ background:'none', border:'none', outline:'none', fontSize:12.5, color:'var(--text-body)', width:140, minWidth:70 }}
              onFocus={e => (e.currentTarget.parentElement!.style.borderColor = 'rgba(14,165,233,0.5)')}
              onBlur={e  => (e.currentTarget.parentElement!.style.borderColor = 'var(--border-strong)')}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--text-muted)', padding:0, lineHeight:1, flexShrink:0 }}>✕</button>
            )}
          </div>

          {/* ── Report ── */}
          {runs.length > 0 && (
            <button onClick={generatePDF}
              style={{
                display:'flex', alignItems:'center', gap:5,
                padding:'6px 13px',
                background:'var(--bg-surface)', color:'var(--text-secondary)',
                border:'1px solid var(--border-strong)', borderRadius:8,
                fontSize:12.5, fontWeight:600, cursor:'pointer', transition:'all 0.14s', flexShrink:0,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-accent)'; e.currentTarget.style.color='var(--accent)'; e.currentTarget.style.background='var(--bg-depth)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-strong)'; e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.background='var(--bg-surface)' }}>
              <span style={{ fontSize:11 }}>↓</span> Report
            </button>
          )}

          {/* ── New Run ── */}
          <button onClick={() => setAddingRun(true)}
            style={{
              display:'flex', alignItems:'center', gap:7,
              padding:'7px 18px',
              background:'linear-gradient(135deg, #0ea5e9 0%, #0284c7 55%, #0369a1 100%)',
              color:'white', border:'none',
              borderRadius:9,
              fontSize:13, fontWeight:700, cursor:'pointer',
              letterSpacing:'0.01em', flexShrink:0,
              boxShadow:'0 3px 14px rgba(14,165,233,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
              transition:'all 0.16s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow='0 5px 22px rgba(14,165,233,0.65), inset 0 1px 0 rgba(255,255,255,0.25)'
              e.currentTarget.style.transform='translateY(-1px)'
              e.currentTarget.style.background='linear-gradient(135deg, #38bdf8 0%, #0ea5e9 55%, #0284c7 100%)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow='0 3px 14px rgba(14,165,233,0.45), inset 0 1px 0 rgba(255,255,255,0.25)'
              e.currentTarget.style.transform='none'
              e.currentTarget.style.background='linear-gradient(135deg, #0ea5e9 0%, #0284c7 55%, #0369a1 100%)'
            }}>
            <span style={{ fontSize:11, opacity:0.9 }}>▶</span>
            <span>New Run</span>
          </button>
        </div>

        {/* Run column headers — only shown when runs exist */}
        {runs.length > 0 && <div ref={runHeaderRef} style={{ display: 'flex', flexShrink: 0, borderBottom: '2px solid var(--border-strong)', background: 'var(--bg-base-alt)', overflowX: 'hidden' }}>
          {/* Spacer must match test-case row left section exactly: 28px + 58px (num) + 26px (icon) + flex:1 (title) */}
          <div style={{ width: 28, flexShrink: 0 }} />
          <div style={{ width: 58, flexShrink: 0 }} />
          <div style={{ width: 26, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }} />

          {/* Run columns */}
          <div style={{ display: 'flex', flexShrink: 0 }}>
            {runs.map(run => {
              const isActive = activeRunId === run.id
              const st = runHeaderStatsMap[run.id] ?? computeStats(caseRows, Object.values(resultsMap[run.id] || {}))
              return (
                <div key={run.id}
                  onClick={() => handleSelectRun(run.id)}
                  style={{
                    width: 136, padding: '8px 10px',
                    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid var(--border)',
                    borderTop: 'none',
                    cursor: 'pointer', userSelect: 'none',
                    background: isActive ? 'var(--accent-muted)' : 'transparent',
                    transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 5,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>

                  {/* Run badge + tester on same row */}
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ background: isActive ? 'var(--accent)' : 'var(--bg-depth)', borderRadius:5, padding:'1px 7px', flexShrink:0 }}>
                      <span style={{ fontSize:11, fontWeight:700, color: isActive ? 'white' : 'var(--text-secondary)', letterSpacing:'0.04em' }}>#{run.number}</span>
                    </div>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{run.tester}</span>
                  </div>

                  {/* Date + time on one line */}
                  <div style={{ fontSize:10, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{run.date} · {run.time}</div>

                  {/* Progress bar */}
                  <div style={{ height:4, background:'var(--border-track)', borderRadius:3, overflow:'hidden', display:'flex' }}>
                    {st.pass > 0    && <div style={{ flex: st.pass,    background: '#22c55e' }} />}
                    {st.fail > 0    && <div style={{ flex: st.fail,    background: '#ef4444' }} />}
                    {st.blocked > 0 && <div style={{ flex: st.blocked, background: '#f59e0b' }} />}
                    {st.query > 0   && <div style={{ flex: st.query,   background: '#3b82f6' }} />}
                    {st.total - st.pass - st.fail - st.blocked - st.query > 0 && <div style={{ flex: st.total - st.pass - st.fail - st.blocked - st.query, background:'var(--border-track)' }} />}
                  </div>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)' }}>{st.done}/{st.total} <span style={{ fontWeight:400, color:'var(--text-muted)' }}>{st.pct}%</span></div>

                  {/* Action buttons */}
                  <div style={{ display:'flex', gap:4 }}>
                    {isActive && (
                      <button onClick={e => { e.stopPropagation(); setPanelVisible(v => !v) }}
                        style={{ flex:1, background:'var(--accent-muted)', border:'1px solid var(--border-accent)', borderRadius:5, cursor:'pointer', color:'var(--accent-hover)', fontSize:10, fontWeight:600, padding:'3px 4px', textAlign:'center', transition:'all 0.12s' }}
                        onMouseEnter={e => { e.currentTarget.style.background='var(--accent-soft)' }}
                        onMouseLeave={e => { e.currentTarget.style.background='var(--accent-muted)' }}>
                        {panelVisible ? '× Panel' : '▶ Panel'}
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); if (confirm('Delete run?')) { setRuns(prev => prev.filter(r => r.id !== run.id)); setResultsMap(prev => { const n = { ...prev }; delete n[run.id]; return n }); if (activeRunId === run.id) { setActiveRunId(null); setActiveRowId(null); setTopStats(null) } deleteTestRun(planId, run.id, scriptId).catch(console.error) } }}
                      style={{ flex:1, background:'none', border:'1px solid var(--border)', borderRadius:5, cursor:'pointer', color:'var(--text-muted)', fontSize:10, padding:'3px 4px', textAlign:'center', transition:'all 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.1)'; e.currentTarget.style.color='#f87171'; e.currentTarget.style.borderColor='rgba(239,68,68,0.3)' }}
                      onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.borderColor='var(--border)' }}>
                      ✕ Remove
                    </button>
                  </div>
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
        </div>}

        {/* ── Rows ── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}
          onScroll={e => { if (runHeaderRef.current) runHeaderRef.current.scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft }}
          onClick={() => { setActiveRowId(null) }}>

          {/* Hint when no runs */}
          {runs.length === 0 && (
            <div style={{ margin: '16px 24px', padding: '12px 16px', background: 'var(--accent-soft)', border: '1px solid var(--accent-glow)', borderRadius: 8, fontSize: 12, color: 'var(--accent-hover)' }}>
              💡 Click <strong>▶ New Run</strong> at the top to add a test run, then click the run column to start marking results.
            </div>
          )}

          {searchQuery && filteredRows.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No test cases match "{searchQuery}"
            </div>
          )}
          {filteredRows.map((row, idx) => (
            <RowItem
              key={row.id}
              row={row}
              idx={idx}
              runs={runs}
              isActiveRow={activeRowId === row.id}
              activeRunId={activeRunId}
              resultsMap={resultsMap}
              editingRowId={editingRowId}
              editTitle={editTitle}
              detailRowId={detailRowId}
              onContextMenu={handleRowCtxCb}
              onRowSelectOnly={handleRowSelectOnly}
              onCellClick={handleCellClick}
              onOpenDetail={openDetailCb}
              onStartEditing={startEditingRowCb}
              onEditTitleChange={setEditTitle}
              onEditSave={handleEditSaveCb}
              onEditInsertAbove={handleEditInsertAboveCb}
              onEditCancel={handleEditCancelCb}
              onMenuIcon={handleMenuIconCb}
            />
          ))}

          {/* Add new row input */}
          <div style={{ display: 'flex', alignItems: 'center', minHeight: 42, borderBottom: '1px solid var(--border-subtle)', minWidth: 'max-content' }}>
            <div style={{ width: 28, flexShrink: 0 }} />
            <div style={{ width: 58, padding: '0 10px 0 4px', fontSize: 11.5, color: 'var(--text-dim)', fontFamily: 'monospace', flexShrink: 0, textAlign: 'right' }}>
              {String(rows.length + 1).padStart(4, '0')}
            </div>
            <div style={{ width: 26, flexShrink: 0 }} />
            <input ref={addInputRef} value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={handleAddRow}
              placeholder="Add test case..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-secondary)', padding: '8px 14px' }} />
          </div>

        </div>
      </div>

      {/* ══ RIGHT PANEL (TestPad-style floating) ══ */}
      {panelOpen && (
        <div style={{
          width: 'min(365px, 38vw)',
          minWidth: 260,
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
                  <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', flexShrink:0, height:90, boxSizing:'border-box', display:'flex', flexDirection:'column' }}>
                    <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:4, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', flexShrink:0 }}>Testing:</div>
                    <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
                      <p style={{ fontSize:12.5, color:'var(--text-body)', margin:0, lineHeight:1.5 }}>
                        {activeRow.number ? `${activeRow.number}: ` : ''}{activeRow.title}
                      </p>
                      {activeResult && activeResult.status !== 'not_run' && (
                        <div style={{ marginTop:4, fontSize:10, padding:'2px 7px', borderRadius:5, display:'inline-block', fontWeight:700, textTransform:'uppercase',
                          background: activeResult.status==='pass' ? 'rgba(34,197,94,0.15)' : activeResult.status==='fail' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                          color: activeResult.status==='pass' ? '#22c55e' : activeResult.status==='fail' ? '#ef4444' : '#f59e0b',
                        }}>
                          Current: {activeResult.status}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {!activeRow && (
                  <div style={{ padding:'16px 14px', fontSize:12, color:'var(--text-muted)', fontStyle:'italic', height:90, boxSizing:'border-box' }}>
                    Click a test case row to start marking results.
                  </div>
                )}

                {/* Comments */}
                <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
                  <label style={{ fontSize:10, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6, display:'block' }}>COMMENTS</label>
                  <textarea ref={panelCommentRef} onBlur={savePanelNote}
                    placeholder="Add observations or notes for this test case..."
                    rows={3}
                    style={{ width:'100%', padding:'7px 10px', background:'var(--bg-depth)', border:'1px solid var(--border-mid)', borderRadius:6, fontSize:12, color:'var(--text-body)', resize:'none', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                </div>

                {/* Bug tracking */}
                <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>BUG TRACKING</label>
                  <input ref={panelBugIdRef} onBlur={savePanelNote}
                    placeholder="Bug ID or ticket reference (e.g. BUG-123)"
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
                  <div style={{ marginBottom:8 }}>
                    <button
                      onClick={() => {
                        if (!activeRunId || !activeRowId) return
                        const runId = activeRunId
                        const rowId = activeRowId
                        const prevStatus = resultsMap[runId]?.[rowId]?.status
                        // 1. Build updated map with entry removed
                        const updatedMap = { ...resultsMap, [runId]: { ...resultsMap[runId] } }
                        delete updatedMap[runId][rowId]
                        // 2. Optimistic UI — instant, no reload
                        setResultsMap(updatedMap)
                        if (topStats) setTopStats(applyStatusChange(topStats, prevStatus, 'not_run'))
                        setAllRunsStats(sumStats(runs.map(run =>
                          computeStats(caseRows, Object.values(updatedMap[run.id] || {}))
                        )))
                        // 3. Persist in background
                        setResult(runId, rowId, 'not_run', getPanelComment(), getPanelBugId()).catch(console.error)
                      }}
                      style={{ width:'100%', padding:'8px', background:'var(--bg-depth)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer', letterSpacing:'0.04em', transition:'all 0.13s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor='rgba(239,68,68,0.6)' }}
                      onMouseLeave={e => { e.currentTarget.style.background='var(--bg-depth)'; e.currentTarget.style.borderColor='rgba(239,68,68,0.3)' }}>
                      ✕ CLEAR RESULT
                    </button>
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

      {/* ══ DETAIL PANEL — extracted memo component; typing only re-renders DetailPanel ══ */}
      {detailRowId && (
        <DetailPanel
          key={detailRowId}
          rowId={detailRowId}
          row={rows.find(r => r.id === detailRowId)}
          panelOpen={panelOpen}
          cacheRef={detailCacheRef}
          onClose={closeDetail}
        />
      )}

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
            <MenuItem icon="✕" label="Delete row" onClick={() => { const id = rowMenu.rowId; setRows(prev => prev.filter(r => r.id !== id)); setRowMenu(null); deleteRow(scriptId, id).catch(console.error) }} danger />
          </div>
        </>,
        document.body
      )}

      {/* New Run modal */}
      {addingRun && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,12,20,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 16,
            width: 380,
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}>
            {/* Modal header */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(22,163,74,0.12) 0%, rgba(22,163,74,0.04) 100%)',
              borderBottom: '1px solid rgba(22,163,74,0.15)',
              padding: '18px 24px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'linear-gradient(135deg,#16a34a 0%,#15803d 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(22,163,74,0.35)',
                fontSize: 15, color: 'white', flexShrink: 0, lineHeight: 1,
              }}>⚡</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>New Test Run</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{script?.name}</div>
              </div>
            </div>

            {/* Form body */}
            <form onSubmit={handleAddRun} style={{ padding: '20px 24px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 7 }}>Tester Name</label>
                <input autoFocus value={runTester} onChange={e => setRunTester(e.target.value)}
                  placeholder="Enter tester name"
                  style={{
                    width: '100%', padding: '10px 14px',
                    background: 'var(--bg-depth)',
                    border: '1.5px solid var(--border-strong)',
                    borderRadius: 9, fontSize: 13.5,
                    color: 'var(--text-primary)', outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(22,163,74,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => { setAddingRun(false); setRunTester('') }}
                  style={{
                    flex: 1, padding: '10px', background: 'transparent',
                    color: 'var(--text-secondary)', border: '1px solid var(--border-strong)',
                    borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.14s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-depth)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
                  Cancel
                </button>
                <button type="submit"
                  style={{
                    flex: 2, padding: '10px',
                    background: 'linear-gradient(135deg,#16a34a 0%,#15803d 100%)',
                    color: 'white', border: 'none', borderRadius: 9,
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(22,163,74,0.4)', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(22,163,74,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(22,163,74,0.4)'; e.currentTarget.style.transform = 'none' }}>
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

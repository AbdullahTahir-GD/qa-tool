import { supabase } from './supabase'

// ─────────────────────────────────────────────────────
// DEV MODE — skip auth during development
// Set to false when auth is implemented (Phase 5)
// ─────────────────────────────────────────────────────
export const DEV_MODE = true
export const DEV_USER_ID = 'dev-user-00000001'

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36) }
export function generateId() { return uid() }
function notify() { if (typeof window !== 'undefined') setTimeout(() => window.dispatchEvent(new CustomEvent('qaflow:change')), 0) }

// ─────────────────────────────────────────────────────
// MODULE-LEVEL READ CACHE — survives React re-mounts so
// back-navigation is instant. Invalidated on every write.
// ─────────────────────────────────────────────────────
const _c = new Map<string, { v: unknown; t: number }>()
const _TTL = 300_000 // 5 minutes — reduces Supabase round trips on repeated navigation
function _get<T>(k: string): T | null {
  const e = _c.get(k)
  if (!e) return null
  if (Date.now() - e.t > _TTL) { _c.delete(k); return null }
  return e.v as T
}
function _set(k: string, v: unknown) { _c.set(k, { v, t: Date.now() }) }
function _del(...keys: string[]) { keys.forEach(k => _c.delete(k)) }

/** Read from cache synchronously without triggering a fetch — for useState initializers */
export function peekCache<T>(key: string): T | null { return _get<T>(key) }

function getCurrentUserId(): string {
  if (DEV_MODE) return DEV_USER_ID
  throw new Error('Auth not implemented yet — keep DEV_MODE = true until Phase 5')
}

// ─────────────────────────────────────────────────────
// TYPES — identical to store.ts
// ─────────────────────────────────────────────────────
export type TestStatus = 'pass' | 'fail' | 'blocked' | 'query' | 'exclude' | 'not_run'

export interface Project { id: string; name: string; createdAt: string }
export interface TestPlan { id: string; projectId: string; name: string; createdAt: string }
export interface Folder { id: string; planId: string; name: string; order: number }
export interface Script { id: string; planId: string; folderId: string; name: string; description: string; order: number }
export interface TestRow {
  id: string; scriptId: string; order: number
  type: 'case' | 'heading'
  number: string
  title: string
}
export interface TestRun {
  id: string; planId: string; number: number
  tester: string; date: string; time: string; build: string
  status: 'in_progress' | 'completed'
}
export interface TestResult {
  id: string; runId: string; rowId: string
  status: TestStatus; comment: string; bugId: string
}
export interface TestCaseDetail {
  preConditions: string
  steps: string
  expected: string
  actual: string
  notes: string
}

// ─────────────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────────────
export async function getProjects(): Promise<Project[]> {
  const cached = _get<Project[]>('projects')
  if (cached) return cached
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) { console.error('getProjects:', error); return [] }
  const result = data.map(r => ({ id: r.id, name: r.name, createdAt: r.created_at }))
  _set('projects', result)
  return result
}

export async function saveProject(name: string): Promise<Project> {
  const userId = getCurrentUserId()
  const id = uid()
  const { error } = await supabase.from('projects').insert({ id, name })
  if (error) throw error
  await supabase.from('project_members').insert({
    id: uid(), project_id: id, user_id: userId, role: 'admin',
  })
  _del('projects')
  notify()
  return { id, name, createdAt: new Date().toISOString() }
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
  _del('projects')
  notify()
}

export async function updateProject(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('projects').update({ name }).eq('id', id)
  if (error) throw error
  _del('projects')
  notify()
}

// ─────────────────────────────────────────────────────
// PLANS
// ─────────────────────────────────────────────────────
export async function getPlans(projectId: string): Promise<TestPlan[]> {
  const key = `plans:${projectId}`
  const cached = _get<TestPlan[]>(key)
  if (cached) return cached
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) { console.error('getPlans:', error); return [] }
  const result = data.map(r => ({ id: r.id, projectId: r.project_id, name: r.name, createdAt: r.created_at }))
  _set(key, result)
  return result
}

export async function savePlan(projectId: string, name: string): Promise<TestPlan> {
  const id = uid()
  const { error } = await supabase.from('plans').insert({ id, project_id: projectId, name })
  if (error) throw error
  _del(`plans:${projectId}`)
  return { id, projectId, name, createdAt: new Date().toISOString() }
}

export async function deletePlan(projectId: string, id: string): Promise<void> {
  const { error } = await supabase.from('plans').delete().eq('id', id)
  if (error) throw error
  _del(`plans:${projectId}`)
}

export async function updatePlan(projectId: string, id: string, name: string): Promise<void> {
  const { error } = await supabase.from('plans').update({ name }).eq('id', id)
  if (error) throw error
  _del(`plans:${projectId}`)
}

// ─────────────────────────────────────────────────────
// FOLDERS
// ─────────────────────────────────────────────────────
export async function getFolders(planId: string): Promise<Folder[]> {
  const key = `folders:${planId}`
  const cached = _get<Folder[]>(key)
  if (cached) return cached
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('plan_id', planId)
    .order('sort_order', { ascending: true })
  if (error) { console.error('getFolders:', error); return [] }
  const result = data.map(r => ({ id: r.id, planId: r.plan_id, name: r.name, order: r.sort_order }))
  _set(key, result)
  return result
}

export async function saveFolder(planId: string, name: string, preOrder?: number): Promise<Folder> {
  const id = uid()
  const order = preOrder ?? (await getFolders(planId)).length
  _del(`folders:${planId}`)
  const { error } = await supabase.from('folders').insert({ id, plan_id: planId, name, sort_order: order })
  if (error) throw error
  return { id, planId, name, order }
}

export async function deleteFolder(planId: string, id: string): Promise<void> {
  const { error } = await supabase.from('folders').delete().eq('id', id)
  if (error) throw error
  _del(`folders:${planId}`)
}

export async function updateFolder(planId: string, id: string, name: string): Promise<void> {
  const { error } = await supabase.from('folders').update({ name }).eq('id', id)
  if (error) throw error
  _del(`folders:${planId}`)
}

// ─────────────────────────────────────────────────────
// SCRIPTS
// ─────────────────────────────────────────────────────
export async function getScripts(planId: string): Promise<Script[]> {
  const key = `scripts:${planId}`
  const cached = _get<Script[]>(key)
  if (cached) return cached
  const { data, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('plan_id', planId)
    .order('sort_order', { ascending: true })
  if (error) { console.error('getScripts:', error); return [] }
  const result = data.map(r => ({ id: r.id, planId: r.plan_id, folderId: r.folder_id, name: r.name, description: r.description, order: r.sort_order }))
  _set(key, result)
  return result
}

export async function saveScript(planId: string, folderId: string, name: string, desc = '', preOrder?: number): Promise<Script> {
  const id = uid()
  const order = preOrder ?? (await getScripts(planId)).length
  _del(`scripts:${planId}`)
  const { error } = await supabase.from('scripts').insert({ id, plan_id: planId, folder_id: folderId, name, description: desc, sort_order: order })
  if (error) throw error
  return { id, planId, folderId, name, description: desc, order }
}

export async function deleteScript(planId: string, id: string): Promise<void> {
  const { error } = await supabase.from('scripts').delete().eq('id', id)
  if (error) throw error
  _del(`scripts:${planId}`)
}

export async function updateScript(planId: string, id: string, upd: Partial<Script>): Promise<void> {
  const dbUpd: Record<string, unknown> = {}
  if (upd.name !== undefined) dbUpd.name = upd.name
  if (upd.description !== undefined) dbUpd.description = upd.description
  if (upd.order !== undefined) dbUpd.sort_order = upd.order
  if (upd.folderId !== undefined) dbUpd.folder_id = upd.folderId
  const { error } = await supabase.from('scripts').update(dbUpd).eq('id', id)
  if (error) throw error
  _del(`scripts:${planId}`)
}

// Chunk an array into sub-arrays of at most `size` elements
function _chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Run async tasks with a concurrency cap — safe for large-scale folder duplication
async function _pool<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = []
  let idx = 0
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
  return results
}

const BULK_CHUNK = 1000 // rows per INSERT batch — 1 call per 1000 rows, well within Supabase's 1MB body limit

// Internal: duplicate a script given the source object
// targetFolderId: override the folder (used by duplicateFolder to place scripts in the new folder)
async function _dupScript(planId: string, src: Script, preOrder?: number, targetFolderId?: string): Promise<Script> {
  const folderId = targetFolderId ?? src.folderId

  // ── Phase 1 (parallel): create script + fetch source rows simultaneously ──
  const [copy, srcRows] = await Promise.all([
    saveScript(planId, folderId, src.name + ' (Copy)', src.description, preOrder),
    getRows(src.id),
  ])

  if (srcRows.length === 0) { _del(`scripts:${planId}`); return copy }

  const newIds = srcRows.map(() => uid())
  const newRows: TestRow[] = srcRows.map((r, i) => ({
    id: newIds[i], scriptId: copy.id, order: r.order, type: r.type, number: r.number, title: r.title,
  }))
  const rowPayloads = newRows.map(r => ({
    id: r.id, script_id: copy.id, type: r.type, number: r.number, title: r.title, sort_order: r.order,
  }))

  // ── Phase 2 (parallel): INSERT rows + fetch source details simultaneously ──
  // NOTE: .in() with >100 IDs creates a URL that's too long for PostgREST — batch into chunks of 100
  const srcRowIds = srcRows.map(r => r.id)
  const [rowResults, allDetailResults] = await Promise.all([
    Promise.all(_chunk(rowPayloads, BULK_CHUNK).map(chunk => supabase.from('rows').insert(chunk))),
    Promise.all(_chunk(srcRowIds, 100).map(ids =>
      supabase.from('case_details')
        .select('row_id, pre_conditions, steps, expected, actual, notes')
        .in('row_id', ids)
    )),
  ])
  const rowError = rowResults.find(r => r.error)?.error
  if (rowError) throw rowError
  const detailData = allDetailResults.flatMap(r => r.data ?? [])

  // Pre-populate row cache — navigating to the new script is instant, no cold Supabase fetch
  _set(`rows:${copy.id}`, newRows)

  // ── Phase 3: INSERT details if any exist ──
  const detailMap = new Map((detailData ?? []).map(d => [d.row_id, d]))
  const detailPayloads = srcRows
    .map((r, i) => {
      const d = detailMap.get(r.id)
      if (!d || (!d.pre_conditions && !d.steps && !d.expected && !d.actual && !d.notes)) return null
      return { row_id: newIds[i], pre_conditions: d.pre_conditions, steps: d.steps, expected: d.expected, actual: d.actual, notes: d.notes }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (detailPayloads.length > 0) {
    const detailResults = await Promise.all(_chunk(detailPayloads, BULK_CHUNK).map(chunk => supabase.from('case_details').insert(chunk)))
    const detailError = detailResults.find(r => r.error)?.error
    if (detailError) throw detailError
  }

  _del(`scripts:${planId}`)
  return copy
}

export async function duplicateScript(planId: string, scriptId: string): Promise<Script> {
  const scripts = await getScripts(planId)
  const src = scripts.find(s => s.id === scriptId)
  if (!src) throw new Error('Script not found')
  // Pass preOrder so saveScript skips an extra getScripts call
  const copy = await _dupScript(planId, src, scripts.length)
  _del(`scripts:${planId}`)
  // NOTE: no notify() here — the caller (plan page) calls reload() explicitly after awaiting.
  // notify() would cause a second concurrent reload() via the qaflow:change event listener.
  return copy
}

export async function duplicateFolder(planId: string, folderId: string): Promise<Folder> {
  const [folders, scripts] = await Promise.all([getFolders(planId), getScripts(planId)])
  const src = folders.find(f => f.id === folderId)
  if (!src) throw new Error('Folder not found')
  const folderScripts = scripts.filter(s => s.folderId === folderId)
  const copy = await saveFolder(planId, src.name + ' (Copy)', folders.length)
  // Bounded concurrency — run at most 5 script duplications at once regardless of folder size
  // Pass copy.id so scripts are placed in the NEW folder, not the original
  await _pool(
    folderScripts.map((script, i) => () => _dupScript(planId, script, scripts.length + i, copy.id)),
    5
  )
  _del(`folders:${planId}`, `scripts:${planId}`)
  // NOTE: no notify() — the caller calls reload() explicitly after awaiting.
  return copy
}

// ─────────────────────────────────────────────────────
// ROWS
// ─────────────────────────────────────────────────────
export async function getRows(scriptId: string): Promise<TestRow[]> {
  const key = `rows:${scriptId}`
  const cached = _get<TestRow[]>(key)
  if (cached) return cached
  const { data, error } = await supabase
    .from('rows')
    .select('*')
    .eq('script_id', scriptId)
    .order('sort_order', { ascending: true })
    .limit(5000) // Override PostgREST default cap of 1000
  if (error) { console.error('getRows:', error); return [] }
  const result = data.map(r => ({ id: r.id, scriptId: r.script_id, order: r.sort_order, type: r.type, number: r.number, title: r.title }))
  _set(key, result)
  return result
}

export async function saveRow(scriptId: string, title: string, number: string, type: 'case' | 'heading' = 'case', pre?: { id: string; order: number }): Promise<TestRow> {
  const id = pre?.id ?? uid()
  const order = pre?.order ?? (await getRows(scriptId)).length
  _del(`rows:${scriptId}`)
  const { error } = await supabase.from('rows').insert({ id, script_id: scriptId, type, number, title, sort_order: order })
  if (error) throw error
  return { id, scriptId, order, type, number, title }
}

export async function insertRowBefore(scriptId: string, beforeRowId: string, type: 'case' | 'heading' = 'case', preId?: string): Promise<TestRow> {
  _del(`rows:${scriptId}`)
  const rows = await getRows(scriptId)
  const beforeRow = rows.find(r => r.id === beforeRowId)
  if (!beforeRow) return saveRow(scriptId, '', '', type, preId ? { id: preId, order: 0 } : undefined)
  const id = preId ?? uid()
  const toShift = rows.filter(r => r.order >= beforeRow.order)
  // Batch into groups of 50 to avoid overwhelming the connection pool
  const SHIFT_BATCH = 50
  for (let i = 0; i < toShift.length; i += SHIFT_BATCH) {
    await Promise.all(
      toShift.slice(i, i + SHIFT_BATCH).map(r =>
        supabase.from('rows').update({ sort_order: r.order + 1 }).eq('id', r.id)
      )
    )
  }
  const { error } = await supabase.from('rows').insert({ id, script_id: scriptId, type, number: '', title: '', sort_order: beforeRow.order })
  if (error) throw error
  return { id, scriptId, order: beforeRow.order, type, number: '', title: '' }
}

export async function updateRow(scriptId: string, id: string, upd: Partial<TestRow>): Promise<void> {
  const dbUpd: Record<string, unknown> = {}
  if (upd.title !== undefined) dbUpd.title = upd.title
  if (upd.number !== undefined) dbUpd.number = upd.number
  if (upd.type !== undefined) dbUpd.type = upd.type
  if (upd.order !== undefined) dbUpd.sort_order = upd.order
  const { error } = await supabase.from('rows').update(dbUpd).eq('id', id)
  if (error) throw error
  _del(`rows:${scriptId}`)
}

export async function deleteRow(scriptId: string, id: string): Promise<void> {
  const { error } = await supabase.from('rows').delete().eq('id', id)
  if (error) throw error
  _del(`rows:${scriptId}`)
}

export async function reorderRows(scriptId: string, rows: TestRow[]): Promise<void> {
  _del(`rows:${scriptId}`)
  const updates = rows.map((r, i) => supabase.from('rows').update({ sort_order: i }).eq('id', r.id))
  await Promise.all(updates)
}

// ─────────────────────────────────────────────────────
// TEST RUNS
// ─────────────────────────────────────────────────────
export async function getTestRuns(planId: string): Promise<TestRun[]> {
  const key = `runs:${planId}`
  const cached = _get<TestRun[]>(key)
  if (cached) return cached
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true })
  if (error) { console.error('getTestRuns:', error); return [] }
  const result = data.map(r => ({ id: r.id, planId: r.plan_id, number: r.number, tester: r.tester, date: r.run_date, time: r.run_time, build: r.build, status: r.status }))
  _set(key, result)
  return result
}

export async function saveTestRun(planId: string, tester: string, build: string, pre?: { id: string; number: number; date: string; time: string }): Promise<TestRun> {
  const now = new Date()
  const id = pre?.id ?? uid()
  const number = pre?.number ?? ((await getTestRuns(planId)).length + 1)
  const date = pre?.date ?? now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = pre?.time ?? now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  _del(`runs:${planId}`)
  const { error } = await supabase.from('runs').insert({ id, plan_id: planId, number, tester, build, status: 'in_progress', run_date: date, run_time: time })
  if (error) throw error
  return { id, planId, number, tester, date, time, build, status: 'in_progress' }
}

export async function deleteTestRun(planId: string, id: string): Promise<void> {
  const { error } = await supabase.from('runs').delete().eq('id', id)
  if (error) throw error
  _del(`runs:${planId}`)
}

export async function updateTestRun(planId: string, id: string, upd: Partial<TestRun>): Promise<void> {
  const dbUpd: Record<string, unknown> = {}
  if (upd.status !== undefined) dbUpd.status = upd.status
  if (upd.tester !== undefined) dbUpd.tester = upd.tester
  if (upd.build !== undefined) dbUpd.build = upd.build
  const { error } = await supabase.from('runs').update(dbUpd).eq('id', id)
  if (error) throw error
  _del(`runs:${planId}`)
}

// ─────────────────────────────────────────────────────
// RESULTS
// ─────────────────────────────────────────────────────
export async function getResults(runId: string): Promise<TestResult[]> {
  const key = `results:${runId}`
  const cached = _get<TestResult[]>(key)
  if (cached) return cached
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('run_id', runId)
    .limit(10000) // a run can have results for many rows across many scripts
  if (error) { console.error('getResults:', error); return [] }
  const result = data.map(r => ({ id: r.id, runId: r.run_id, rowId: r.row_id, status: r.status, comment: r.comment, bugId: r.bug_id }))
  _set(key, result)
  return result
}

export async function setResult(runId: string, rowId: string, status: TestStatus, comment = '', bugId = ''): Promise<void> {
  _del(`results:${runId}`)
  // Single-trip upsert — requires unique constraint on (run_id, row_id)
  const { error } = await supabase.from('results').upsert(
    { run_id: runId, row_id: rowId, status, comment, bug_id: bugId },
    { onConflict: 'run_id,row_id' }
  )
  if (!error) return
  // Fallback for schemas without a unique constraint on (run_id, row_id)
  const { data: existing } = await supabase
    .from('results').select('id').eq('run_id', runId).eq('row_id', rowId).maybeSingle()
  if (existing) {
    const { error: e2 } = await supabase.from('results').update({ status, comment, bug_id: bugId }).eq('id', existing.id)
    if (e2) throw e2
  } else {
    const { error: e3 } = await supabase.from('results').insert({ id: uid(), run_id: runId, row_id: rowId, status, comment, bug_id: bugId })
    if (e3) throw e3
  }
}

export async function getResult(runId: string, rowId: string): Promise<TestResult | undefined> {
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('run_id', runId)
    .eq('row_id', rowId)
    .maybeSingle()
  if (error || !data) return undefined
  return { id: data.id, runId: data.run_id, rowId: data.row_id, status: data.status, comment: data.comment, bugId: data.bug_id }
}

// ─────────────────────────────────────────────────────
// CASE DETAILS
// ─────────────────────────────────────────────────────
const EMPTY_DETAIL: TestCaseDetail = { preConditions: '', steps: '', expected: '', actual: '', notes: '' }

export async function getDetail(rowId: string): Promise<TestCaseDetail> {
  const { data, error } = await supabase
    .from('case_details')
    .select('pre_conditions, steps, expected, actual, notes')
    .eq('row_id', rowId)
    .maybeSingle()
  if (error || !data) return { ...EMPTY_DETAIL }
  return { preConditions: data.pre_conditions, steps: data.steps, expected: data.expected, actual: data.actual, notes: data.notes }
}

export async function saveDetail(rowId: string, d: TestCaseDetail): Promise<void> {
  const { error } = await supabase.from('case_details').upsert({
    row_id: rowId,
    pre_conditions: d.preConditions,
    steps: d.steps,
    expected: d.expected,
    actual: d.actual,
    notes: d.notes,
  }, { onConflict: 'row_id' })
  if (error) throw error
}

// ─────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────
export async function getScriptStats(scriptId: string, runId: string) {
  const [allRows, results] = await Promise.all([getRows(scriptId), getResults(runId)])
  const rows = allRows.filter(r => r.type === 'case')
  const resultMap = new Map(results.map(r => [r.rowId, r.status]))
  const pass    = rows.filter(r => resultMap.get(r.id) === 'pass').length
  const fail    = rows.filter(r => resultMap.get(r.id) === 'fail').length
  const blocked = rows.filter(r => resultMap.get(r.id) === 'blocked').length
  const query   = rows.filter(r => resultMap.get(r.id) === 'query').length
  const exclude = rows.filter(r => resultMap.get(r.id) === 'exclude').length
  const done    = pass + fail + blocked + query
  const total   = rows.length - exclude
  const pct     = total > 0 ? Math.round((pass / total) * 100) : 0
  return { pass, fail, blocked, query, exclude, done, total, pct }
}

export async function getFolderStats(planId: string, folderId: string, runId: string) {
  const scripts = (await getScripts(planId)).filter(s => s.folderId === folderId)
  const allStats = await Promise.all(scripts.map(s => getScriptStats(s.id, runId)))
  let pass=0, fail=0, blocked=0, query=0, done=0, total=0
  allStats.forEach(st => { pass+=st.pass; fail+=st.fail; blocked+=st.blocked; query+=st.query; done+=st.done; total+=st.total })
  const pct = total > 0 ? Math.round((pass / total) * 100) : 0
  return { pass, fail, blocked, query, done, total, pct }
}

export async function getScriptStatsAllRuns(planId: string, scriptId: string) {
  const runs = await getTestRuns(planId)
  if (runs.length === 0) {
    const rows = (await getRows(scriptId)).filter(r => r.type === 'case')
    return { pass:0, fail:0, blocked:0, query:0, exclude:0, done:0, total:rows.length, pct:0 }
  }
  const allStats = await Promise.all(runs.map(run => getScriptStats(scriptId, run.id)))
  let pass=0, fail=0, blocked=0, query=0, exclude=0, done=0, total=0
  allStats.forEach(st => { pass+=st.pass; fail+=st.fail; blocked+=st.blocked; query+=st.query; exclude+=st.exclude; done+=st.done; total+=st.total })
  const pct = total > 0 ? Math.round((pass / total) * 100) : 0
  return { pass, fail, blocked, query, exclude, done, total, pct }
}

export async function getFolderStatsAllRuns(planId: string, folderId: string) {
  const scripts = (await getScripts(planId)).filter(s => s.folderId === folderId)
  const allStats = await Promise.all(scripts.map(s => getScriptStatsAllRuns(planId, s.id)))
  let pass=0, fail=0, blocked=0, query=0, done=0, total=0
  allStats.forEach(st => { pass+=st.pass; fail+=st.fail; blocked+=st.blocked; query+=st.query; done+=st.done; total+=st.total })
  const pct = total > 0 ? Math.round((pass / total) * 100) : 0
  return { pass, fail, blocked, query, done, total, pct }
}

// ─────────────────────────────────────────────────────
// PURE STATS — computed from already-loaded data, zero Supabase calls
// ─────────────────────────────────────────────────────
export type Stats = {
  pass: number; fail: number; blocked: number; query: number
  exclude: number; done: number; total: number; pct: number
}

export function computeStats(caseRows: TestRow[], results: TestResult[]): Stats {
  const resultMap = new Map(results.map(r => [r.rowId, r.status]))
  const pass    = caseRows.filter(r => resultMap.get(r.id) === 'pass').length
  const fail    = caseRows.filter(r => resultMap.get(r.id) === 'fail').length
  const blocked = caseRows.filter(r => resultMap.get(r.id) === 'blocked').length
  const query   = caseRows.filter(r => resultMap.get(r.id) === 'query').length
  const exclude = caseRows.filter(r => resultMap.get(r.id) === 'exclude').length
  const done    = pass + fail + blocked + query
  const total   = caseRows.length - exclude
  const pct     = total > 0 ? Math.round((pass / total) * 100) : 0
  return { pass, fail, blocked, query, exclude, done, total, pct }
}

export function sumStats(statsArray: Stats[]): Stats {
  let pass=0, fail=0, blocked=0, query=0, exclude=0, done=0, total=0
  for (const s of statsArray) {
    pass+=s.pass; fail+=s.fail; blocked+=s.blocked; query+=s.query
    exclude+=s.exclude; done+=s.done; total+=s.total
  }
  const pct = total > 0 ? Math.round((pass / total) * 100) : 0
  return { pass, fail, blocked, query, exclude, done, total, pct }
}

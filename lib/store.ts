// ─────────────────────────────────────────────────────
// QAFLOW LOCAL STORE — localStorage only, no database
// ─────────────────────────────────────────────────────
export type TestStatus = 'pass' | 'fail' | 'blocked' | 'query' | 'exclude' | 'not_run'

export interface Project { id: string; name: string; createdAt: string }
export interface TestPlan { id: string; projectId: string; name: string; createdAt: string }
export interface Folder { id: string; planId: string; name: string; order: number }
export interface Script { id: string; planId: string; folderId: string; name: string; description: string; order: number }
export interface TestRow {
  id: string; scriptId: string; order: number
  type: 'case' | 'heading'
  number: string  // e.g. TC-01
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

function uid() { return Math.random().toString(36).slice(2,10) + Date.now().toString(36) }
function load<T>(key: string, fb: T): T {
  if (typeof window === 'undefined') return fb
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb } catch { return fb }
}
function save(key: string, v: unknown) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(v))
  setTimeout(() => window.dispatchEvent(new CustomEvent('qaflow:change')), 0)
}

// Projects
export const getProjects = (): Project[] => load('qf_projects', [])
export const saveProject = (name: string): Project => {
  const p: Project = { id: uid(), name, createdAt: new Date().toISOString() }
  save('qf_projects', [...getProjects(), p]); return p
}
export const deleteProject = (id: string) => save('qf_projects', getProjects().filter(p => p.id !== id))
export const updateProject = (id: string, name: string) =>
  save('qf_projects', getProjects().map(p => p.id === id ? { ...p, name } : p))

// Plans
export const getPlans = (projectId: string): TestPlan[] => load('qf_plans_' + projectId, [])
export const savePlan = (projectId: string, name: string): TestPlan => {
  const p: TestPlan = { id: uid(), projectId, name, createdAt: new Date().toISOString() }
  save('qf_plans_' + projectId, [...getPlans(projectId), p]); return p
}
export const deletePlan = (projectId: string, id: string) =>
  save('qf_plans_' + projectId, getPlans(projectId).filter(p => p.id !== id))
export const updatePlan = (projectId: string, id: string, name: string) =>
  save('qf_plans_' + projectId, getPlans(projectId).map(p => p.id === id ? { ...p, name } : p))

// Folders
export const getFolders = (planId: string): Folder[] => load('qf_folders_' + planId, [])
export const saveFolder = (planId: string, name: string): Folder => {
  const folders = getFolders(planId)
  const f: Folder = { id: uid(), planId, name, order: folders.length }
  save('qf_folders_' + planId, [...folders, f]); return f
}
export const deleteFolder = (planId: string, id: string) =>
  save('qf_folders_' + planId, getFolders(planId).filter(f => f.id !== id))
export const updateFolder = (planId: string, id: string, name: string) =>
  save('qf_folders_' + planId, getFolders(planId).map(f => f.id === id ? { ...f, name } : f))

// Scripts
export const getScripts = (planId: string): Script[] => load('qf_scripts_' + planId, [])
export const saveScript = (planId: string, folderId: string, name: string, desc = ''): Script => {
  const all = getScripts(planId)
  const s: Script = { id: uid(), planId, folderId, name, description: desc, order: all.length }
  save('qf_scripts_' + planId, [...all, s]); return s
}
export const deleteScript = (planId: string, id: string) =>
  save('qf_scripts_' + planId, getScripts(planId).filter(s => s.id !== id))
export const updateScript = (planId: string, id: string, upd: Partial<Script>) =>
  save('qf_scripts_' + planId, getScripts(planId).map(s => s.id === id ? { ...s, ...upd } : s))

function copyRowsWithDetails(srcScriptId: string, destScriptId: string) {
  const rows = getRows(srcScriptId)
  const newRows = rows.map(r => {
    const newId = uid()
    const detail = load('qf_detail_' + r.id, null)
    if (detail) save('qf_detail_' + newId, detail)
    return { ...r, id: newId, scriptId: destScriptId }
  })
  save('qf_rows_' + destScriptId, newRows)
}

export const duplicateScript = (planId: string, scriptId: string): Script => {
  const src = getScripts(planId).find(s => s.id === scriptId)
  if (!src) throw new Error('Script not found')
  const copy = saveScript(planId, src.folderId, src.name + ' (Copy)', src.description)
  copyRowsWithDetails(scriptId, copy.id)
  return copy
}

export const duplicateFolder = (planId: string, folderId: string): Folder => {
  const src = getFolders(planId).find(f => f.id === folderId)
  if (!src) throw new Error('Folder not found')
  const copy = saveFolder(planId, src.name + ' (Copy)')
  const folderScripts = getScripts(planId).filter(s => s.folderId === folderId)
  folderScripts.forEach(script => {
    const scriptCopy = saveScript(planId, copy.id, script.name, script.description)
    copyRowsWithDetails(script.id, scriptCopy.id)
  })
  return copy
}

// Test Rows (cases + headings)
export const getRows = (scriptId: string): TestRow[] => load('qf_rows_' + scriptId, [])
export const saveRow = (scriptId: string, title: string, number: string, type: 'case' | 'heading' = 'case'): TestRow => {
  const rows = getRows(scriptId)
  const r: TestRow = { id: uid(), scriptId, order: rows.length, type, number, title }
  save('qf_rows_' + scriptId, [...rows, r]); return r
}
export const updateRow = (scriptId: string, id: string, upd: Partial<TestRow>) =>
  save('qf_rows_' + scriptId, getRows(scriptId).map(r => r.id === id ? { ...r, ...upd } : r))
export const deleteRow = (scriptId: string, id: string) =>
  save('qf_rows_' + scriptId, getRows(scriptId).filter(r => r.id !== id))
export const reorderRows = (scriptId: string, rows: TestRow[]) =>
  save('qf_rows_' + scriptId, rows)

// Test Runs
export const getTestRuns = (planId: string): TestRun[] => load('qf_runs_' + planId, [])
export const saveTestRun = (planId: string, tester: string, build: string): TestRun => {
  const runs = getTestRuns(planId)
  const now = new Date()
  const r: TestRun = {
    id: uid(), planId, number: runs.length + 1, tester, build,
    date: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    status: 'in_progress',
  }
  save('qf_runs_' + planId, [...runs, r]); return r
}
export const deleteTestRun = (planId: string, id: string) =>
  save('qf_runs_' + planId, getTestRuns(planId).filter(r => r.id !== id))
export const updateTestRun = (planId: string, id: string, upd: Partial<TestRun>) =>
  save('qf_runs_' + planId, getTestRuns(planId).map(r => r.id === id ? { ...r, ...upd } : r))

// Results
export const getResults = (runId: string): TestResult[] => load('qf_results_' + runId, [])
export const setResult = (runId: string, rowId: string, status: TestStatus, comment = '', bugId = '') => {
  const results = getResults(runId)
  const existing = results.find(r => r.rowId === rowId)
  if (existing) {
    save('qf_results_' + runId, results.map(r => r.rowId === rowId ? { ...r, status, comment, bugId } : r))
  } else {
    save('qf_results_' + runId, [...results, { id: uid(), runId, rowId, status, comment, bugId }])
  }
}
export const getResult = (runId: string, rowId: string): TestResult | undefined =>
  getResults(runId).find(r => r.rowId === rowId)

// Test Case Details (per row, independent of runs)
export interface TestCaseDetail {
  preConditions: string
  steps: string
  expected: string
  actual: string
  notes: string
}
const EMPTY_DETAIL: TestCaseDetail = { preConditions: '', steps: '', expected: '', actual: '', notes: '' }
export const getDetail = (rowId: string): TestCaseDetail => load('qf_detail_' + rowId, EMPTY_DETAIL)
export const saveDetail = (rowId: string, d: TestCaseDetail) => save('qf_detail_' + rowId, d)

// Stats
export function getScriptStats(scriptId: string, runId: string) {
  const rows = getRows(scriptId).filter(r => r.type === 'case')
  const results = getResults(runId)
  const pass = rows.filter(r => results.find(x => x.rowId === r.id && x.status === 'pass')).length
  const fail = rows.filter(r => results.find(x => x.rowId === r.id && x.status === 'fail')).length
  const blocked = rows.filter(r => results.find(x => x.rowId === r.id && x.status === 'blocked')).length
  const query = rows.filter(r => results.find(x => x.rowId === r.id && x.status === 'query')).length
  const exclude = rows.filter(r => results.find(x => x.rowId === r.id && x.status === 'exclude')).length
  const done = pass + fail + blocked + query
  const total = rows.length - exclude
  const pct = total > 0 ? Math.round((pass / total) * 100) : 0
  return { pass, fail, blocked, query, exclude, done, total, pct }
}
export function getFolderStats(planId: string, folderId: string, runId: string) {
  const scripts = getScripts(planId).filter(s => s.folderId === folderId)
  let pass=0,fail=0,blocked=0,query=0,done=0,total=0
  scripts.forEach(s => { const st = getScriptStats(s.id, runId); pass+=st.pass; fail+=st.fail; blocked+=st.blocked; query+=st.query; done+=st.done; total+=st.total })
  const pct = total > 0 ? Math.round((pass/total)*100) : 0
  return { pass, fail, blocked, query, done, total, pct }
}

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { DEV_USER_ID } from '@/lib/db'

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36) }

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const SECTION_TITLES = [
  'Login & Authentication',
  'User Profile Management',
  'Dashboard Overview',
  'Project Creation',
  'Test Plan Management',
  'Script Editor',
  'Run Execution',
  'Results & Reporting',
  'Search & Filters',
  'Settings & Preferences',
]

const CASE_TEMPLATES = [
  'Verify {x} loads within acceptable time',
  'Validate {x} input accepts valid data',
  'Confirm {x} rejects invalid input',
  'Check {x} displays correct error message',
  'Ensure {x} updates after save',
  'Test {x} with empty state',
  'Test {x} with maximum data',
  'Verify {x} navigation works correctly',
  'Confirm {x} button is enabled when required',
  'Validate {x} exports correct data',
]

export async function GET() {
  try {
    const projectId = uid()
    const planId = uid()
    const folderId = uid()
    const scriptId = uid()

    // 1. Project
    const { error: e1 } = await supabase
      .from('projects')
      .insert({ id: projectId, name: '🧪 Load Test — 1K Rows' })
    if (e1) throw e1

    // 2. Project member
    await supabase.from('project_members').insert({
      id: uid(), project_id: projectId, user_id: DEV_USER_ID, role: 'admin',
    })

    // 3. Plan
    const { error: e3 } = await supabase
      .from('plans')
      .insert({ id: planId, project_id: projectId, name: 'Performance Test Plan' })
    if (e3) throw e3

    // 4. Folder
    const { error: e4 } = await supabase
      .from('folders')
      .insert({ id: folderId, plan_id: planId, name: 'Full Regression Suite', sort_order: 0 })
    if (e4) throw e4

    // 5. Script
    const { error: e5 } = await supabase
      .from('scripts')
      .insert({ id: scriptId, plan_id: planId, folder_id: folderId, name: '1000 Test Cases — Load Test', description: 'Auto-generated for performance testing', sort_order: 0 })
    if (e5) throw e5

    // 6. Build 1000 rows: a heading every ~100 cases
    const rows: { id: string; script_id: string; type: string; number: string; title: string; sort_order: number }[] = []
    let caseNum = 1
    let order = 0

    for (let section = 0; section < 10; section++) {
      // Heading row
      rows.push({
        id: uid(),
        script_id: scriptId,
        type: 'heading',
        number: '',
        title: SECTION_TITLES[section],
        sort_order: order++,
      })

      // 99 test cases per section = 990 cases + 10 headings = 1000 rows total
      for (let i = 0; i < 99; i++) {
        const template = CASE_TEMPLATES[i % CASE_TEMPLATES.length]
        const subject = `${SECTION_TITLES[section].split(' ')[0].toLowerCase()} item ${i + 1}`
        rows.push({
          id: uid(),
          script_id: scriptId,
          type: 'case',
          number: String(caseNum++).padStart(3, '0'),
          title: template.replace('{x}', subject),
          sort_order: order++,
        })
      }
    }

    // 7. Bulk insert in 500-row chunks
    const chunks = chunk(rows, 500)
    for (const c of chunks) {
      const { error } = await supabase.from('rows').insert(c)
      if (error) throw error
    }

    return NextResponse.json({
      ok: true,
      message: `Seeded: 1 project → 1 plan → 1 folder → 1 script → ${rows.length} rows (${rows.filter(r => r.type === 'case').length} cases + ${rows.filter(r => r.type === 'heading').length} headings)`,
      projectId,
      planId,
      folderId,
      scriptId,
      scriptUrl: `/projects/${projectId}/plan/${planId}/script/${scriptId}`,
    })
  } catch (err) {
    console.error('Seed error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

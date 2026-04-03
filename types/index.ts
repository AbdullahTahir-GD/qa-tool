export type Role = 'admin' | 'tester' | 'viewer'
export type TestStatus = 'pass' | 'fail' | 'blocked' | 'not_run'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type ProjectStatus = 'active' | 'archived'
export type RunStatus = 'in_progress' | 'completed' | 'archived'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: Role
  created_at: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: Role
  joined_at: string
  profile?: Profile
}

export interface TestPlan {
  id: string
  project_id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface TestItem {
  id: string
  plan_id: string
  parent_id: string | null
  title: string
  description: string | null
  priority: Priority
  sort_order: number
  created_at: string
  children?: TestItem[]
}

export interface TestRun {
  id: string
  project_id: string
  plan_id: string
  name: string
  build_tag: string | null
  status: RunStatus
  created_by: string
  created_at: string
  completed_at: string | null
}

export interface TestResult {
  id: string
  run_id: string
  item_id: string
  status: TestStatus
  notes: string | null
  bug_id: string | null
  tested_by: string | null
  updated_at: string
  test_item?: TestItem
}

export interface RunStats {
  total: number
  pass: number
  fail: number
  blocked: number
  not_run: number
  pass_rate: number
}

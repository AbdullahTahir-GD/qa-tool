import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { TestStatus, Priority, RunStats, TestResult } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function statusColor(status: TestStatus) {
  const map: Record<TestStatus, string> = {
    pass: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    fail: 'text-red-400 bg-red-400/10 border-red-400/20',
    blocked: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    not_run: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  }
  return map[status]
}

export function statusLabel(status: TestStatus) {
  const map: Record<TestStatus, string> = {
    pass: 'Pass',
    fail: 'Fail',
    blocked: 'Blocked',
    not_run: 'Not Run',
  }
  return map[status]
}

export function priorityColor(priority: Priority) {
  const map: Record<Priority, string> = {
    low: 'text-slate-400 bg-slate-400/10',
    medium: 'text-blue-400 bg-blue-400/10',
    high: 'text-amber-400 bg-amber-400/10',
    critical: 'text-red-400 bg-red-400/10',
  }
  return map[priority]
}

export function computeStats(results: TestResult[]): RunStats {
  const total = results.length
  const pass = results.filter(r => r.status === 'pass').length
  const fail = results.filter(r => r.status === 'fail').length
  const blocked = results.filter(r => r.status === 'blocked').length
  const not_run = results.filter(r => r.status === 'not_run').length
  const pass_rate = total > 0 ? Math.round((pass / total) * 100) : 0
  return { total, pass, fail, blocked, not_run, pass_rate }
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

export function initials(name: string | null | undefined, email: string) {
  if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  return email.slice(0, 2).toUpperCase()
}

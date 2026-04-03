'use client'
import { useState } from 'react'
import { ChevronDown, Bug, MessageSquare } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { TestResult, TestStatus } from '@/types'

const STATUS_OPTIONS: { value: TestStatus; label: string; color: string }[] = [
  { value: 'pass', label: 'Pass', color: 'text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-400/20' },
  { value: 'fail', label: 'Fail', color: 'text-red-400 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20' },
  { value: 'blocked', label: 'Blocked', color: 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/20' },
  { value: 'not_run', label: 'Not Run', color: 'text-slate-400 bg-slate-400/10 hover:bg-slate-400/20 border border-slate-400/20' },
]

interface ResultRowProps {
  result: TestResult
  onUpdate: (resultId: string, updates: Partial<TestResult>) => Promise<void>
  canEdit: boolean
}

export function ResultRow({ result, onUpdate, canEdit }: ResultRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState(result.notes || '')
  const [bugId, setBugId] = useState(result.bug_id || '')
  const [saving, setSaving] = useState(false)

  const handleStatusChange = async (status: TestStatus) => {
    if (!canEdit) return
    await onUpdate(result.id, { status })
  }

  const handleSaveDetails = async () => {
    setSaving(true)
    await onUpdate(result.id, { notes, bug_id: bugId })
    setSaving(false)
    setExpanded(false)
  }

  return (
    <div className="border border-[var(--border)] rounded-[10px] overflow-hidden animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-surface)]">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--text-primary)] truncate">{result.test_item?.title}</p>
        </div>

        {/* Status buttons */}
        {canEdit ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                className={cn(
                  'px-2.5 py-1 rounded-[6px] text-xs font-medium transition-all duration-150',
                  opt.color,
                  result.status === opt.value ? 'opacity-100 ring-1 ring-white/20' : 'opacity-40 hover:opacity-80'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <StatusBadge status={result.status} />
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className={cn('text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all duration-150', expanded && 'rotate-180')}
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {expanded && (
        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-elevated)] space-y-3 animate-fade-in">
          <Textarea
            label="Notes"
            placeholder="Add notes about this test case..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={!canEdit}
            className="min-h-[60px]"
          />
          <Input
            label="Bug ID"
            placeholder="e.g. BUG-123, JIRA-456"
            value={bugId}
            onChange={e => setBugId(e.target.value)}
            disabled={!canEdit}
          />
          {canEdit && (
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveDetails} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

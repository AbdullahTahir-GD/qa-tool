'use client'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Play, CheckCircle2, Clock, Tag } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import type { TestRun, RunStats } from '@/types'

interface RunCardProps {
  run: TestRun
  projectId: string
  stats?: RunStats
}

export function RunCard({ run, projectId, stats }: RunCardProps) {
  const router = useRouter()

  const statusIcon = run.status === 'completed'
    ? <CheckCircle2 size={13} className="text-emerald-400" />
    : <Play size={13} className="text-accent" />

  return (
    <Card
      hover
      onClick={() => router.push(`/projects/${projectId}/runs/${run.id}`)}
      className="p-4 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {statusIcon}
          <h3 className="text-sm font-medium text-[var(--text-primary)]">{run.name}</h3>
        </div>
        {run.build_tag && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] font-mono bg-[var(--bg-elevated)] px-2 py-0.5 rounded-[5px]">
            <Tag size={9} />
            {run.build_tag}
          </span>
        )}
      </div>

      {/* Mini progress bar */}
      {stats && (
        <div className="mb-3">
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-[var(--bg-elevated)]">
            {stats.pass > 0 && <div className="bg-emerald-400" style={{ flex: stats.pass }} />}
            {stats.fail > 0 && <div className="bg-red-400" style={{ flex: stats.fail }} />}
            {stats.blocked > 0 && <div className="bg-amber-400" style={{ flex: stats.blocked }} />}
            {stats.not_run > 0 && <div className="bg-slate-600" style={{ flex: stats.not_run }} />}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[var(--text-muted)]">
            <span className="text-emerald-400">{stats.pass} pass</span>
            <span className="text-red-400">{stats.fail} fail</span>
            <span className="text-amber-400">{stats.blocked} blocked</span>
            <span className="ml-auto font-medium text-[var(--text-secondary)]">{stats.pass_rate}%</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
        <Clock size={9} />
        {formatDate(run.created_at)}
      </div>
    </Card>
  )
}

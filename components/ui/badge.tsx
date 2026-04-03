import { cn } from '@/lib/utils'
import type { TestStatus, Priority, Role } from '@/types'
import { statusColor, statusLabel, priorityColor } from '@/lib/utils'

export function StatusBadge({ status }: { status: TestStatus }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-[5px] text-xs font-medium border', statusColor(status))}>
      {statusLabel(status)}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-[5px] text-xs font-medium capitalize', priorityColor(priority))}>
      {priority}
    </span>
  )
}

export function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    admin: 'text-violet-400 bg-violet-400/10',
    tester: 'text-blue-400 bg-blue-400/10',
    viewer: 'text-slate-400 bg-slate-400/10',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-[5px] text-xs font-medium capitalize', styles[role])}>
      {role}
    </span>
  )
}

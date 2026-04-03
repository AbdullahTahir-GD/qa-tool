import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  color?: string
  sub?: string
}

export function StatCard({ label, value, icon: Icon, color = 'text-accent', sub }: StatCardProps) {
  return (
    <Card className="p-5 flex items-start gap-4">
      <div className={cn('w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0', color.replace('text-', 'bg-') + '/10')}>
        <Icon size={17} className={color} />
      </div>
      <div>
        <p className="text-2xl font-bold text-[var(--text-primary)] leading-none">{value}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">{label}</p>
        {sub && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}

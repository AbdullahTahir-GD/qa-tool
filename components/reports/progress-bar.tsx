interface ProgressBarProps {
  label: string
  value: number
  total: number
  color: string
}

export function ProgressBar({ label, value, total, color }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--text-secondary)] w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-medium text-[var(--text-secondary)] w-8 text-right">{value}</span>
      <span className="text-xs text-[var(--text-muted)] w-10 text-right">{pct}%</span>
    </div>
  )
}

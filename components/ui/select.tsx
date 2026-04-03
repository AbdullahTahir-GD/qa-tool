import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>}
        <select
          ref={ref}
          className={cn(
            'w-full px-3 py-2 rounded-[8px] text-sm text-[var(--text-primary)]',
            'bg-[var(--bg-elevated)] border border-[var(--border)] focus:border-accent focus:ring-1 focus:ring-accent/30',
            'transition-all duration-150 outline-none appearance-none',
            className
          )}
          {...props}
        >
          {children}
        </select>
      </div>
    )
  }
)
Select.displayName = 'Select'
export { Select }

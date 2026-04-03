import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>}
        <input
          ref={ref}
          className={cn(
            'w-full px-3 py-2 rounded-[8px] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
            'bg-[var(--bg-elevated)] border border-[var(--border)] focus:border-accent focus:ring-1 focus:ring-accent/30',
            'transition-all duration-150 outline-none',
            error && 'border-red-500/50 focus:border-red-500',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
export { Input }

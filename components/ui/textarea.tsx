import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>}
        <textarea
          ref={ref}
          className={cn(
            'w-full px-3 py-2 rounded-[8px] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
            'bg-[var(--bg-elevated)] border border-[var(--border)] focus:border-accent focus:ring-1 focus:ring-accent/30',
            'transition-all duration-150 outline-none resize-none min-h-[80px]',
            className
          )}
          {...props}
        />
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
export { Textarea }

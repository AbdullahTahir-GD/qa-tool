'use client'
import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed rounded-[8px] whitespace-nowrap',
          {
            'bg-accent text-white hover:bg-[#818cf8] shadow-sm': variant === 'primary',
            'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border-strong)]': variant === 'secondary',
            'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]': variant === 'ghost',
            'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20': variant === 'danger',
          },
          {
            'px-2.5 py-1.5 text-xs': size === 'sm',
            'px-3.5 py-2 text-sm': size === 'md',
            'px-5 py-2.5 text-sm': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
export { Button }

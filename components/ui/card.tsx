import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
}

export function Card({ className, hover = false, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[10px] bg-[var(--bg-surface)] shadow-card border border-[var(--border)]',
        hover && 'transition-all duration-200 hover:shadow-card-hover hover:border-[var(--border-strong)] cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

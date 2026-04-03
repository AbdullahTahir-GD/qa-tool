'use client'
import { useTheme } from '@/components/providers/theme-provider'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        transition: 'all 0.15s',
        letterSpacing: '0.02em',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--bg-hover)'
        e.currentTarget.style.color = 'var(--text-primary)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--bg-elevated)'
        e.currentTarget.style.color = 'var(--text-secondary)'
      }}>
      {isDark
        ? <><span style={{ fontSize: 13 }}>☀</span> Light</>
        : <><span style={{ fontSize: 13 }}>☽</span> Dark</>
      }
    </button>
  )
}

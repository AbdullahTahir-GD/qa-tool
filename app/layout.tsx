import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/providers/theme-provider'

export const metadata: Metadata = {
  title: 'Testra — QA Platform',
  description: 'Collaborative QA management for modern teams',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: apply light theme vars before first paint if stored */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('qf_theme') === 'light') {
              var e = document.documentElement, L = {
                '--bg-base':'#edf0f8','--bg-base-alt':'#f4f6fc','--bg-surface':'#ffffff',
                '--bg-elevated':'#f0f2fa','--bg-depth':'#e6e9f5','--bg-hover':'#dde1f2',
                '--bg-inset':'rgba(0,0,0,0.04)','--overlay':'rgba(15,18,40,0.50)',
                '--border':'rgba(99,102,241,0.12)','--border-strong':'rgba(0,0,0,0.13)',
                '--border-mid':'rgba(0,0,0,0.08)','--border-subtle':'rgba(0,0,0,0.04)',
                '--border-track':'#c8cce6','--accent-hover':'#4f52d9',
                '--accent-muted':'rgba(99,102,241,0.10)','--accent-soft':'rgba(99,102,241,0.07)',
                '--text-primary':'#1a1c2e','--text-body':'#2e3254','--text-body-dim':'#404670',
                '--text-secondary':'#5c6382','--text-muted':'#848dab',
                '--text-dim':'#a2a9c5','--text-dimmer':'#bec5dc',
                '--sidebar-bg':'#ffffff','--sidebar-title':'#1a1c2e',
                '--sidebar-item':'#5c6382','--sidebar-item-active':'#6366f1',
                '--sidebar-item-active-bg':'rgba(99,102,241,0.08)',
                '--sidebar-empty':'#bec5dc','--topnav-bg':'rgba(237,240,248,0.92)'
              };
              for (var k in L) e.style.setProperty(k, L[k]);
            }
          } catch {}
        ` }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}

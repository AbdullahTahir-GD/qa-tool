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
        {/* Runs BEFORE first paint — no flash, no refresh needed */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('qf_theme');
            if (t === 'light' || t === null) {
              document.documentElement.classList.add('qf-light');
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

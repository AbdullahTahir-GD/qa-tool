'use client'
export const dynamic = 'force-dynamic'
import { Suspense } from 'react'
import { SidebarContent } from '@/components/layout/sidebar'
import { TopnavContent } from '@/components/layout/topnav'
import { SidebarProvider, useSidebar } from '@/components/providers/sidebar-context'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Shell>{children}</Shell>
    </SidebarProvider>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const { open, isMobile, toggle } = useSidebar()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex' }}>

      {/* ── Mobile backdrop ── */}
      {isMobile && open && (
        <div
          onClick={toggle}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 39,
          }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: open ? 'var(--sidebar-width)' : 0,
        overflow: 'hidden',
        transition: 'width 0.24s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0,
        position: 'fixed',
        top: 0, left: 0,
        height: '100vh',
        zIndex: 40,
      }}>
        <div style={{ width: 'var(--sidebar-width)', height: '100%' }}>
          <Suspense><SidebarContent /></Suspense>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{
        marginLeft: open && !isMobile ? 'var(--sidebar-width)' : 0,
        transition: 'margin-left 0.24s cubic-bezier(0.4,0,0.2,1)',
        flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh',
        minWidth: 0,
      }}>

        {/* Topnav */}
        <header style={{
          height: 'var(--topnav-height)',
          background: 'var(--topnav-bg)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 22px',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          position: 'sticky', top: 0, zIndex: 30,
          boxShadow: '0 1px 0 var(--border), 0 4px 16px rgba(0,0,0,0.18)',
        }}>
          <Suspense><TopnavContent /></Suspense>
        </header>

        {/* Page content */}
        <main style={{
          flex: 1,
          padding: '24px 16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

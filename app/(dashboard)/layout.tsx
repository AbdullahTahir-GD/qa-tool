'use client'
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
  const { open } = useSidebar()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex' }}>

      {/* Sidebar */}
      <aside style={{
        width: open ? 'var(--sidebar-width)' : 0,
        overflow: 'hidden',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        flexShrink: 0,
        position: 'fixed',
        top: 0, left: 0,
        height: '100vh',
        zIndex: 40,
      }}>
        {/* inner div keeps content from squishing during animation */}
        <div style={{ width: 'var(--sidebar-width)', height: '100%' }}>
          <SidebarContent />
        </div>
      </aside>

      {/* Main area */}
      <div style={{
        marginLeft: open ? 'var(--sidebar-width)' : 0,
        transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',
        flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh',
      }}>
        <header style={{
          height: 'var(--topnav-height)',
          background: 'var(--topnav-bg)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 20px',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          <TopnavContent />
        </header>

        <main style={{ flex: 1, padding: '20px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
        </main>
      </div>
    </div>
  )
}

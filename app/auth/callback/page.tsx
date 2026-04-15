'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // Supabase client automatically detects #access_token in the URL hash
    // and stores the session in our cookie storage.
    // We listen for the session to be ready, then redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.replace('/projects')
      }
    })

    // Also check immediately in case session is already set
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/projects')
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 13, margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 60%, #0284c7 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 18px rgba(14,165,233,0.5)',
        }}>
          <span style={{ color: 'white', fontWeight: 900, fontSize: 22 }}>T</span>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Signing you in…</div>
      </div>
    </div>
  )
}

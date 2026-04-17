'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    async function handleCallback() {
      // ── PKCE flow (Supabase v2 default) ──────────────────────────────────
      // Email confirmation / magic-link lands here as ?code=…
      const params = new URLSearchParams(window.location.search)
      const code   = params.get('code')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          router.replace('/projects')
          return
        }
        // If exchange failed fall through to hash check
      }

      // ── Implicit / hash flow (fallback) ──────────────────────────────────
      // Older magic-link format: #access_token=…
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/projects')
        return
      }

      // Still no session — listen for onAuthStateChange (hash processed async)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
        if (sess) {
          subscription.unsubscribe()
          router.replace('/projects')
        }
      })

      // Safety fallback — if nothing fires in 5 s, send to login
      const timeout = setTimeout(() => {
        subscription.unsubscribe()
        router.replace('/login')
      }, 5000)

      return () => {
        subscription.unsubscribe()
        clearTimeout(timeout)
      }
    }

    handleCallback()
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
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          <span style={{ color: 'white', fontWeight: 900, fontSize: 22 }}>T</span>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Signing you in…</div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      </div>
    </div>
  )
}

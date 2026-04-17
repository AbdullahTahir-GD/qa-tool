'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Mode = 'magic' | 'password'
type Step = 'form' | 'sent'

export default function LoginPage() {
  const [mode, setMode]       = useState<Mode>('password')
  const [step, setStep]       = useState<Step>('form')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function switchMode(m: Mode) { setMode(m); setError(''); setStep('form'); setPassword('') }

  // ── Auto-process auth tokens that landed on /login by mistake ──
  // (e.g. Supabase Site URL pointed to "/" → root redirected here with the
  // ?code= or #access_token still in the URL). Exchange the code, then go
  // straight to /projects. This is purely a safety net — the real flow lands
  // on /auth/callback.
  useEffect(() => {
    async function rescueAuthFromUrl() {
      if (typeof window === 'undefined') return
      const url    = new URL(window.location.href)
      const code   = url.searchParams.get('code')
      const hash   = window.location.hash || ''
      const hasHashToken = hash.includes('access_token=') || hash.includes('error=')

      if (!code && !hasHashToken) return

      // Try PKCE code exchange
      if (code) {
        const { error: err } = await supabase.auth.exchangeCodeForSession(code)
        if (!err) { window.location.replace('/projects'); return }
      }

      // Try hash-based — Supabase auto-detects #access_token
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { window.location.replace('/projects'); return }

      // Surface any error in the hash to the user
      if (hash.includes('error=')) {
        const params = new URLSearchParams(hash.replace(/^#/, ''))
        const desc = params.get('error_description') || params.get('error') || ''
        if (desc) setError(decodeURIComponent(desc.replace(/\+/g, ' ')))
        // Clean the URL
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
    rescueAuthFromUrl()
  }, [])

  // ── Magic link ──
  async function handleMagicLink() {
    const e = email.trim().toLowerCase()
    if (!e.includes('@')) { setError('Enter a valid email address.'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email: e,
      options: { shouldCreateUser: true, emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/auth/callback` },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setStep('sent')
  }

  // ── Password sign in / sign up ──
  async function handlePassword() {
    const e = email.trim().toLowerCase()
    if (!e.includes('@')) { setError('Enter a valid email address.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true); setError('')

    if (isSignUp) {
      const { error: err } = await supabase.auth.signUp({
        email: e,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      setLoading(false)
      if (err) { setError(err.message); return }
      // Supabase may auto-confirm or send confirmation email
      // Try signing in immediately after sign up
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: e, password })
      if (signInErr) {
        // Needs email confirmation
        setStep('sent')
      } else {
        window.location.href = '/projects'
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email: e, password })
      setLoading(false)
      if (err) {
        if (err.message.includes('Invalid login')) {
          setError('Incorrect email or password.')
        } else {
          setError(err.message)
        }
        return
      }
      window.location.href = '/projects'
    }
  }

  const tabStyle = (active: boolean) => ({
    flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600,
    border: 'none', cursor: 'pointer', borderRadius: 8, transition: 'all 0.15s',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'white' : 'var(--text-muted)',
  } as React.CSSProperties)

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 16, padding: '40px 36px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13, flexShrink: 0,
            background: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 60%, #0284c7 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 18px rgba(14,165,233,0.5)',
          }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: 22, letterSpacing: '-1px' }}>T</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Testra</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>QA Platform</div>
          </div>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 20px', letterSpacing: '-0.5px' }}>
          Sign in
        </h1>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, padding: 4,
          background: 'var(--bg-base)', borderRadius: 10,
          border: '1px solid var(--border)', marginBottom: 24,
        }}>
          <button style={tabStyle(mode === 'password')} onClick={() => switchMode('password')}>Password</button>
          <button style={tabStyle(mode === 'magic')} onClick={() => switchMode('magic')}>Magic link</button>
        </div>

        {/* ── Magic link form ── */}
        {mode === 'magic' && step === 'form' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px', lineHeight: 1.5 }}>
              Enter your email — we'll send a sign-in link instantly.
            </p>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>EMAIL ADDRESS</label>
            <input
              autoFocus type="email" value={email} placeholder="you@example.com"
              onChange={e => { setEmail(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleMagicLink()}
              style={{ width:'100%', padding:'11px 14px', borderRadius:9, fontSize:14, background:'var(--bg-base)', border:`1px solid ${error?'#f87171':'var(--border)'}`, color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }}
              onFocus={e => { if (!error) e.target.style.borderColor='var(--accent)' }}
              onBlur={e => { if (!error) e.target.style.borderColor='var(--border)' }}
            />
            {error && <div style={{ color:'#f87171', fontSize:12, marginTop:8 }}>{error}</div>}
            <button onClick={handleMagicLink} disabled={loading||!email.trim()} style={{
              width:'100%', marginTop:14, padding:'12px', borderRadius:9, border:'none',
              cursor:loading?'not-allowed':'pointer',
              background:'linear-gradient(135deg,#0ea5e9,#0284c7)',
              color:'white', fontWeight:700, fontSize:14,
              opacity:(loading||!email.trim())?0.6:1,
              boxShadow:'0 4px 14px rgba(14,165,233,0.4)', transition:'opacity 0.15s, transform 0.1s',
            }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.transform='translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform='none' }}>
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </>
        )}

        {/* ── Magic link sent ── */}
        {mode === 'magic' && step === 'sent' && (
          <>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ width:56, height:56, borderRadius:16, margin:'0 auto 16px', background:'rgba(14,165,233,0.15)', border:'1px solid rgba(14,165,233,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:26 }}>✉️</span>
              </div>
              <h2 style={{ fontSize:18, fontWeight:800, color:'var(--text-primary)', margin:'0 0 8px' }}>Check your email</h2>
              <p style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.6, margin:0 }}>
                We sent a sign-in link to<br />
                <strong style={{ color:'var(--text-secondary)' }}>{email}</strong>
              </p>
            </div>
            <div style={{ padding:'12px 16px', borderRadius:10, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', fontSize:13, color:'var(--text-muted)', lineHeight:1.6, textAlign:'center' }}>
              Click <strong style={{ color:'#22c55e' }}>"Confirm your mail"</strong> in the email to sign in.
            </div>
            <div style={{ marginTop:16, textAlign:'center' }}>
              <button onClick={() => { setStep('form'); setError('') }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'var(--text-muted)', textDecoration:'underline' }}
                onMouseEnter={e => (e.currentTarget.style.color='var(--text-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.color='var(--text-muted)')}>
                Use a different email
              </button>
            </div>
          </>
        )}

        {/* ── Password form ── */}
        {mode === 'password' && step === 'form' && (
          <>
            <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 18px', lineHeight:1.5 }}>
              {isSignUp ? 'Create a new account with email and password.' : 'Sign in with your email and password.'}
            </p>

            <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.05em', display:'block', marginBottom:8 }}>EMAIL ADDRESS</label>
            <input
              autoFocus type="email" value={email} placeholder="you@example.com"
              onChange={e => { setEmail(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handlePassword()}
              style={{ width:'100%', padding:'11px 14px', borderRadius:9, fontSize:14, background:'var(--bg-base)', border:`1px solid ${error?'#f87171':'var(--border)'}`, color:'var(--text-primary)', outline:'none', boxSizing:'border-box', marginBottom:12 }}
              onFocus={e => { if (!error) e.target.style.borderColor='var(--accent)' }}
              onBlur={e => { if (!error) e.target.style.borderColor='var(--border)' }}
            />

            <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.05em', display:'block', marginBottom:8 }}>PASSWORD</label>
            <input
              type="password" value={password} placeholder={isSignUp ? 'Min. 6 characters' : '••••••••'}
              onChange={e => { setPassword(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handlePassword()}
              style={{ width:'100%', padding:'11px 14px', borderRadius:9, fontSize:14, background:'var(--bg-base)', border:`1px solid ${error?'#f87171':'var(--border)'}`, color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }}
              onFocus={e => { if (!error) e.target.style.borderColor='var(--accent)' }}
              onBlur={e => { if (!error) e.target.style.borderColor='var(--border)' }}
            />
            {error && <div style={{ color:'#f87171', fontSize:12, marginTop:8 }}>{error}</div>}

            <button onClick={handlePassword} disabled={loading||!email.trim()||password.length<6} style={{
              width:'100%', marginTop:14, padding:'12px', borderRadius:9, border:'none',
              cursor:loading?'not-allowed':'pointer',
              background:'linear-gradient(135deg,#0ea5e9,#0284c7)',
              color:'white', fontWeight:700, fontSize:14,
              opacity:(loading||!email.trim()||password.length<6)?0.6:1,
              boxShadow:'0 4px 14px rgba(14,165,233,0.4)', transition:'opacity 0.15s, transform 0.1s',
            }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.transform='translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform='none' }}>
              {loading ? (isSignUp?'Creating account…':'Signing in…') : (isSignUp?'Create account':'Sign in')}
            </button>

            {/* Toggle sign in / sign up */}
            <div style={{ marginTop:16, textAlign:'center', fontSize:13, color:'var(--text-muted)' }}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <button onClick={() => { setIsSignUp(v=>!v); setError('') }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'var(--accent)', fontWeight:600, padding:0 }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration='underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration='none')}>
                {isSignUp ? 'Sign in' : 'Create account'}
              </button>
            </div>
          </>
        )}

        {/* ── Password: confirmation sent ── */}
        {mode === 'password' && step === 'sent' && (
          <>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ width:56, height:56, borderRadius:16, margin:'0 auto 16px', background:'rgba(14,165,233,0.15)', border:'1px solid rgba(14,165,233,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:26 }}>✉️</span>
              </div>
              <h2 style={{ fontSize:18, fontWeight:800, color:'var(--text-primary)', margin:'0 0 8px' }}>Confirm your email</h2>
              <p style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.6, margin:0 }}>
                Check <strong style={{ color:'var(--text-secondary)' }}>{email}</strong><br />
                and click the confirmation link to activate your account.
              </p>
            </div>
            <div style={{ marginTop:16, textAlign:'center' }}>
              <button onClick={() => { setStep('form'); setError('') }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'var(--text-muted)', textDecoration:'underline' }}>
                Back to sign in
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

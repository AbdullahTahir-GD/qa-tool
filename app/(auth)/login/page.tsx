'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Zap, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[120px]" style={{ background: 'rgba(99,102,241,0.05)' }} />
      </div>
      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'var(--accent)' }}>
            <Zap size={20} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>QAFlow</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Sign in to your workspace</p>
          </div>
        </div>
        <div className="rounded-[14px] border p-6" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="team@company.com"
              label="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
            <Input
              type="password"
              placeholder="••••••••"
              label="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                <AlertCircle size={13} />
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              Sign In
            </Button>
          </form>
        </div>
        <p className="text-center text-[10px] mt-5" style={{ color: 'var(--text-muted)' }}>
          Secure · Collaborative · Real-time
        </p>
      </div>
    </div>
  )
}

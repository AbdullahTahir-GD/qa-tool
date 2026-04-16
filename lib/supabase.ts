import { createClient } from '@supabase/supabase-js'

// NOTE: do NOT throw at module-load — that would crash prerender during
// `next build` if the env vars happen to be missing in the build environment.
// Instead, fall back to dummy values so the module loads, and surface a clear
// runtime error in the browser if the real values aren't present.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

if (typeof window !== 'undefined' && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  // Visible in the browser console — helps users immediately notice missing env vars in deployment
  console.error('[Testra] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Set them in Vercel → Project Settings → Environment Variables.')
}

// Store session in a cookie so the middleware (server-side) can read it.
// Default localStorage storage is invisible to Next.js middleware.
const COOKIE_NAME = 'sb-session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

const cookieStorage = {
  getItem(key: string): string | null {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : null
  },
  setItem(key: string, value: string): void {
    if (typeof document === 'undefined') return
    document.cookie = `${key}=${encodeURIComponent(value)};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`
  },
  removeItem(key: string): void {
    if (typeof document === 'undefined') return
    document.cookie = `${key}=;path=/;max-age=0`
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: COOKIE_NAME,
    storage: cookieStorage,
  },
})

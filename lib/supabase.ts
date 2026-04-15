import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
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

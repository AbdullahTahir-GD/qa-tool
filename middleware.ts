import { NextResponse, type NextRequest } from 'next/server'

// Protected routes — anything under the (dashboard) group
const PROTECTED = ['/projects', '/dashboard', '/new-project', '/team']

// Cookie name must match COOKIE_NAME in lib/supabase.ts
const SESSION_COOKIE = 'sb-session'

function hasSession(request: NextRequest): boolean {
  return !!request.cookies.get(SESSION_COOKIE)?.value
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
  const isLogin = pathname === '/login'

  const loggedIn = hasSession(request)

  // Redirect unauthenticated users away from protected pages
  if (isProtected && !loggedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from /login → /projects
  if (isLogin && loggedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/projects'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/projects/:path*',
    '/dashboard/:path*',
    '/new-project/:path*',
    '/team/:path*',
    '/login',
    // /auth/callback is intentionally excluded — it processes the magic link token
  ],
}

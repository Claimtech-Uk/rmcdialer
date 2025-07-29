import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // CRITICAL: Allow Twilio webhooks, audio endpoints, and CRON jobs to bypass authentication
  const isWebhookPath = request.nextUrl.pathname.startsWith('/api/webhooks/twilio/') || 
                       request.nextUrl.pathname.startsWith('/api/test-webhook-public') ||
                       request.nextUrl.pathname.startsWith('/api/audio/')
  
  // CRITICAL: Allow cron jobs to bypass authentication (Vercel cron doesn't send auth tokens)
  const isCronPath = request.nextUrl.pathname.startsWith('/api/cron/')
  
  if (isWebhookPath || isCronPath) {
    console.log('🔓 Bypass: Allowing unauthenticated access to', request.nextUrl.pathname)
    return NextResponse.next()
  }

  // SECURITY: Block debug/test endpoints in production if no auth token
  const isDebugPath = request.nextUrl.pathname.startsWith('/api/debug-') || 
                     request.nextUrl.pathname.startsWith('/api/test-')
  
  if (isDebugPath && process.env.NODE_ENV === 'production') {
    const debugToken = request.headers.get('x-debug-token')
    if (!debugToken || debugToken !== process.env.DEBUG_ACCESS_TOKEN) {
      console.log('🚫 Debug endpoint blocked in production:', request.nextUrl.pathname)
      return NextResponse.json({ error: 'Debug endpoints disabled in production' }, { status: 403 })
    }
  }
  
  // Protect dashboard routes
  const protectedPaths = ['/queue', '/calls', '/sms', '/magic-links', '/profile', '/dashboard']
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + '/')
  ) || request.nextUrl.pathname === '/'
  
  if (isProtectedPath) {
    const token = request.cookies.get('auth-token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '')

    // Debug logging (will show in Vercel function logs)
    console.log('Middleware check:', {
      path: request.nextUrl.pathname,
      hasToken: !!token,
      tokenLength: token?.length || 0,
      authTokenCookie: request.cookies.get('auth-token')?.value ? 'present' : 'missing'
    })

    if (!token || token === '') {
      console.log('Redirecting to login - no valid token')
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     * 
     * NOTE: Removed api exclusion to allow webhook bypass logic
     */
    '/((?!_next/static|_next/image|favicon.ico|login).*)',
  ],
} 
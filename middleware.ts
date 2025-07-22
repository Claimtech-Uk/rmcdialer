import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // CRITICAL: Allow Twilio webhooks to bypass authentication
  const isWebhookPath = request.nextUrl.pathname.startsWith('/api/webhooks/twilio/') || 
                       request.nextUrl.pathname.startsWith('/api/test-webhook-public')
  
  if (isWebhookPath) {
    console.log('🔓 Webhook bypass: Allowing unauthenticated access to', request.nextUrl.pathname)
    return NextResponse.next()
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
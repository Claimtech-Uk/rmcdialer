import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/queue') ||
      request.nextUrl.pathname.startsWith('/calls') ||
      request.nextUrl.pathname.startsWith('/sms') ||
      request.nextUrl.pathname.startsWith('/magic-links') ||
      request.nextUrl.pathname.startsWith('/profile') ||
      request.nextUrl.pathname === '/') {
    
    const token = request.cookies.get('auth-token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Note: JWT verification would be done here in production
    // For now, just check if token exists
    if (!token || token === '') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/queue/:path*', '/calls/:path*', '/sms/:path*', '/magic-links/:path*', '/profile/:path*']
} 
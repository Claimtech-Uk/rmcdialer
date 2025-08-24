import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 🧪 DEVELOPMENT ENVIRONMENT SAFETY RESTRICTIONS
function applyDevelopmentRestrictions(request: NextRequest): NextResponse | null {
  const environmentName = process.env.ENVIRONMENT_NAME || ''
  const isDevelopment = environmentName === 'staging-development'
    || environmentName === 'aws-development'
    || environmentName.endsWith('-development')
  if (!isDevelopment) return null // Skip restrictions in production
  
  const url = request.nextUrl.pathname
  const method = request.method

  const envLabel = (environmentName || 'development').toUpperCase()
  console.log(`🧪 [${envLabel}] Processing request:`, url, method)

  // 🚫 CRITICAL: Block ALL cron jobs (prevent interference with Vercel production)
  if (url.startsWith('/api/cron/')) {
    console.log('🚫 [AWS-DEV-SAFETY] Cron job blocked:', url)
    return NextResponse.json({ 
      error: 'Cron jobs disabled in development environment',
      reason: 'Production cron jobs running on Vercel',
      mode: `${environmentName || 'development'}-safety`,
      path: url 
    }, { status: 503 })
  }

  // 🚫 Block SMS sending to prevent customer contact (unless test numbers)
  if ((url.startsWith('/api/webhooks/twilio/sms') || 
       url.includes('/sms/send')) && method === 'POST') {
    
    const fromNumber = request.nextUrl.searchParams.get('From') || 
                      request.nextUrl.searchParams.get('from')
    const toNumber = request.nextUrl.searchParams.get('To') ||
                    request.nextUrl.searchParams.get('to')
    
    const allowedNumbers = (process.env.ALLOWED_TEST_NUMBERS || '').split(',').filter(n => n.trim())
    
    if ((fromNumber && !allowedNumbers.includes(fromNumber)) || 
        (toNumber && !allowedNumbers.includes(toNumber))) {
      console.log('🚫 [AWS-DEV-SAFETY] SMS blocked - unauthorized number:', { fromNumber, toNumber })
      return NextResponse.json({
        error: 'SMS blocked - development environment safety',
        allowedNumbers: allowedNumbers,
        attempted: { from: fromNumber, to: toNumber },
        mode: `${environmentName || 'development'}-safety`
      }, { status: 403 })
    }
  }

  // 🚫 Block queue modifications (read-only access to production data)
  if (url.includes('/queue/') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    console.log('🚫 [AWS-DEV-SAFETY] Queue modification blocked:', url, method)
    return NextResponse.json({
      error: 'Queue modifications disabled in development',
      reason: 'Read-only access to production data',
      mode: `${environmentName || 'development'}-safety`
    }, { status: 403 })
  }

  // ✅ Allow AI voice agent endpoints (your main development focus)
  const allowedDevPaths = [
    '/api/webhooks/twilio/voice',     // Voice webhooks for AI testing
    '/api/webhooks/twilio/voice-ai',  // AI voice webhooks (new)
    '/api/ai-voice/',                 // AI voice tokens/config (new)
    '/api/audio/',                    // Audio processing
    '/api/debug/',                    // Debug endpoints
    '/api/test-',                     // Test endpoints
    '/api/health',                    // Health checks
    '/api/transcription',             // Transcription testing
    '/api/ai-',                       // AI agent endpoints
    '/api/hume'                       // Hume AI endpoints
  ]

  const isAllowedPath = allowedDevPaths.some(path => url.startsWith(path))
  if (isAllowedPath) {
    console.log(`✅ [${envLabel}] AI voice agent endpoint allowed:`, url)
  }

  console.log(`🔍 [${envLabel}] Request passed safety checks - continuing to auth middleware`)
  return null // Continue to existing middleware
}

export function middleware(request: NextRequest) {
  // 🛡️ Apply development restrictions FIRST
  const devRestriction = applyDevelopmentRestrictions(request)
  if (devRestriction) return devRestriction

  // 🚫 PRODUCTION SAFETY: Block AI voice endpoints when feature disabled
  // Note: AI voice webhook checks are handled in the route itself for better control
  if (request.nextUrl.pathname.startsWith('/api/ai-voice/')) {
    if (process.env.ENABLE_AI_VOICE_AGENT !== 'true') {
      console.log('🚫 AI Voice agent blocked - feature disabled in production')
      return NextResponse.json({ 
        error: 'AI Voice agent disabled',
        mode: 'production-safety',
        path: request.nextUrl.pathname
      }, { status: 403 })
    }
  }
  
  // Allow voice-ai webhook to handle its own feature flag checks
  if (request.nextUrl.pathname.startsWith('/api/webhooks/twilio/voice-ai')) {
    console.log('🎙️ [AI-VOICE] Allowing voice-ai webhook to handle feature flags internally')
  }

  // CRITICAL: Allow Twilio webhooks, audio endpoints, and CRON jobs to bypass authentication
  const isWebhookPath = request.nextUrl.pathname.startsWith('/api/webhooks/twilio/') || 
                       request.nextUrl.pathname.startsWith('/api/test-webhook-public') ||
                       request.nextUrl.pathname.startsWith('/api/audio/')
  
  // CRITICAL: Allow cron jobs to bypass authentication (but already blocked in dev above)
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
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  const userAgent = request.headers.get('user-agent')
  const referer = request.headers.get('referer')
  
  return NextResponse.json({
    message: 'Domain test endpoint',
    timestamp: new Date().toISOString(),
    requestInfo: {
      origin,
      host,
      userAgent: userAgent?.substring(0, 100),
      referer,
      url: request.url,
      method: request.method
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_URL: process.env.VERCEL_URL ? 'present' : 'missing',
      API_BASE_URL: process.env.API_BASE_URL ? 'present' : 'missing'
    },
    headers: Object.fromEntries(
      Array.from(request.headers.entries())
        .filter(([key]) => !key.toLowerCase().includes('authorization'))
    )
  })
} 
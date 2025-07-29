import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get token from cookies or authorization header
    const tokenFromCookie = request.cookies.get('auth-token')?.value
    const tokenFromHeader = request.headers.get('authorization')?.replace('Bearer ', '')
    
    const token = tokenFromHeader || tokenFromCookie
    
    if (!token) {
      return NextResponse.json({ 
        error: 'No token found',
        cookiePresent: !!tokenFromCookie,
        headerPresent: !!tokenFromHeader
      }, { status: 401 })
    }

    // Return first 20 and last 20 characters for debugging (don't expose full token)
    const tokenPreview = token.length > 40 
      ? `${token.substring(0, 20)}...${token.substring(token.length - 20)}`
      : token
    
    return NextResponse.json({
      tokenFound: true,
      tokenLength: token.length,
      tokenPreview,
      source: tokenFromHeader ? 'header' : 'cookie',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check token',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 